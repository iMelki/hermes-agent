"""xAI credential-pool refresh must be serialised on the owning store lock.

``CredentialPool._refresh_entry`` posts xAI refresh tokens without a lock
on origin/dev. xAI refresh tokens are single-use, so two processes
refreshing the same pool entry at once make the second POST fail with
``invalid_grant`` and the grant is lost. This is the pool-path counterpart
of the hermes-agent#14 fix in ``hermes_cli.auth``.

These tests drive real on-disk stores under ``tmp_path`` and a fake local
token endpoint that accepts each refresh token once. No real tokens or
real auth.json files are used.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import textwrap
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

import pytest

from agent import credential_pool as CP
from agent.credential_pool import (
    AUTH_TYPE_OAUTH,
    CredentialPool,
    PooledCredential,
    load_pool,
)
from hermes_cli import auth as A

REPO_ROOT = Path(__file__).resolve().parents[2]


def _jwt(exp: int) -> str:
    def enc(obj):
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")

    return f"{enc({'alg': 'none'})}.{enc({'exp': exp})}.sig"


def _write_store(path: Path, store: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store), encoding="utf-8")


def _read_store(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _xai_store(
    access: str,
    refresh: str,
    token_endpoint: str = "https://auth.x.ai/oauth2/token",
) -> dict:
    return {
        "version": 1,
        "providers": {
            "xai-oauth": {
                "tokens": {
                    "access_token": access,
                    "refresh_token": refresh,
                    "token_type": "Bearer",
                },
                "discovery": {"token_endpoint": token_endpoint},
                "auth_mode": "oauth_device_code",
            }
        },
    }


def _entry(*, access_token: str, refresh_token: str, entry_id: str = "xai-1"):
    return PooledCredential(
        provider="xai-oauth",
        id=entry_id,
        label="xai",
        auth_type=AUTH_TYPE_OAUTH,
        priority=0,
        source="device_code",
        access_token=access_token,
        refresh_token=refresh_token,
    )


@pytest.fixture
def classic_store(tmp_path, monkeypatch):
    """One store, no distinct root (classic mode)."""
    store_path = tmp_path / "hermes" / "auth.json"
    monkeypatch.setattr(A, "_auth_file_path", lambda: store_path)
    monkeypatch.setattr(A, "_global_auth_file_path", lambda: None)
    monkeypatch.setenv("HOME", str(tmp_path / "not-the-root"))
    monkeypatch.setenv("USERPROFILE", str(tmp_path / "not-the-root"))
    return store_path


@pytest.fixture
def profile_and_root(tmp_path, monkeypatch):
    """A profile store plus a distinct root store."""
    profile_path = tmp_path / "root" / "profiles" / "seat1" / "auth.json"
    root_path = tmp_path / "root" / "auth.json"
    monkeypatch.setattr(A, "_auth_file_path", lambda: profile_path)
    monkeypatch.setattr(A, "_global_auth_file_path", lambda: root_path)
    monkeypatch.setenv("HOME", str(tmp_path / "not-the-root"))
    monkeypatch.setenv("USERPROFILE", str(tmp_path / "not-the-root"))
    _write_store(profile_path, {"version": 1, "providers": {}})
    return profile_path, root_path


# ---------------------------------------------------------------------------
# Fake xAI token endpoint (single-use refresh tokens, like the real one)
# ---------------------------------------------------------------------------


class _FakeTokenServer:
    def __init__(self, first_refresh: str, delay: float = 0.4):
        self.current_refresh = first_refresh
        self.generation = 0
        self.posts: list[str] = []
        self.delay = delay
        self.lock = threading.Lock()
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):  # quiet
                pass

            def do_POST(self):
                length = int(self.headers.get("Content-Length", "0") or 0)
                form = parse_qs(self.rfile.read(length).decode())
                presented = (form.get("refresh_token") or [""])[0]
                with outer.lock:
                    outer.posts.append(presented)
                    ok = presented == outer.current_refresh
                    if ok:
                        outer.generation += 1
                        gen = outer.generation
                        outer.current_refresh = f"fake-refresh-{gen}"
                # Widen the race window: a second process that did not wait
                # for the lock would POST the same refresh token during this
                # sleep.
                time.sleep(outer.delay)
                if ok:
                    body = json.dumps({
                        "access_token": _jwt(int(time.time()) + 3 * 3600)
                        + f".gen{gen}",
                        "refresh_token": f"fake-refresh-{gen}",
                        "token_type": "Bearer",
                        "expires_in": 10800,
                    }).encode()
                    self.send_response(200)
                else:
                    body = json.dumps({"error": "invalid_grant"}).encode()
                    self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}/oauth2/token"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.httpd.shutdown()
        self.httpd.server_close()


_CHILD_REFRESH = textwrap.dedent(
    """
    import json, os, sys, time
    from pathlib import Path
    sys.path.insert(0, {repo!r})
    from hermes_cli import auth
    auth._auth_file_path = lambda: Path({store!r})
    auth._global_auth_file_path = lambda: {root}
    auth._xai_validate_oauth_endpoint = lambda url, field: url
    auth._xai_oauth_discovery = lambda timeout: {{"token_endpoint": {endpoint!r}}}
    go = Path({go!r})
    while not go.exists():
        time.sleep(0.005)
    try:
        from agent.credential_pool import load_pool
        pool = load_pool("xai-oauth")
        if not pool._entries:
            print(json.dumps({{"ok": False, "error": "load_pool returned no entries"}}))
            raise SystemExit
        # Do not call select(): it refreshes expiring tokens as a side
        # effect and would spend the grant before try_refresh_current.
        entry = pool._entries[0]
        refreshed = pool._refresh_entry(entry, force=True)
        if refreshed is None:
            print(json.dumps({{"ok": False, "error": "refresh returned None"}}))
        else:
            print(json.dumps({{
                "ok": True,
                "access_token": refreshed.access_token,
                "refresh_token": refreshed.refresh_token,
            }}))
    except Exception as exc:
        print(json.dumps({{"ok": False, "error": type(exc).__name__ + ": " + str(exc)}}))
    """
)


def _child_env(tmp_path: Path) -> dict:
    env = dict(os.environ)
    env["HOME"] = str(tmp_path / "not-the-root")
    env["USERPROFILE"] = str(tmp_path / "not-the-root")
    env["PYTHONPATH"] = str(REPO_ROOT)
    env.pop("HERMES_XAI_REFRESH_TIMEOUT_SECONDS", None)
    # Children must not inherit a pytest seat-belt that could confuse a
    # tmp root with the real user store; HOME is already a fake dir.
    return env


def _root_expr(root_path: Path | None) -> str:
    if root_path is None:
        return "None"
    return f"Path({str(root_path)!r})"


@pytest.mark.parametrize("processes", [2, 4])
def test_concurrent_processes_post_exactly_once_shared_store(tmp_path, processes):
    """N real processes, one shared store / one pool entry -> exactly ONE POST."""
    store_path = tmp_path / "hermes" / "auth.json"
    go = tmp_path / "go"
    with _FakeTokenServer("fake-refresh-0") as server:
        _write_store(
            store_path,
            _xai_store(_jwt(int(time.time()) - 60), "fake-refresh-0", server.url),
        )
        procs = []
        for _ in range(processes):
            code = _CHILD_REFRESH.format(
                repo=str(REPO_ROOT),
                store=str(store_path),
                root="None",
                endpoint=server.url,
                go=str(go),
            )
            procs.append(
                subprocess.Popen(
                    [sys.executable, "-c", code],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=_child_env(tmp_path),
                )
            )
        time.sleep(1.5)
        go.write_text("go", encoding="utf-8")
        results = []
        for p in procs:
            out, err = p.communicate(timeout=90)
            assert p.returncode == 0, err
            results.append(json.loads(out.strip().splitlines()[-1]))

    failures = [r for r in results if not r["ok"]]
    assert not failures, f"processes failed: {failures}; posts={server.posts}"
    assert server.posts == ["fake-refresh-0"], server.posts
    keys = {r["access_token"] for r in results}
    assert len(keys) == 1 and keys.pop().endswith(".gen1")
    store = _read_store(store_path)
    assert (
        store["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "fake-refresh-1"
    )
    pool_entries = (store.get("credential_pool") or {}).get("xai-oauth") or []
    assert pool_entries
    pool_refresh = {e.get("refresh_token") for e in pool_entries if isinstance(e, dict)}
    assert pool_refresh == {"fake-refresh-1"}


@pytest.mark.parametrize("processes", [2, 4])
def test_concurrent_profile_processes_post_exactly_once_root_grant(tmp_path, processes):
    """N profiles refreshing a root-owned pool entry -> exactly ONE POST."""
    root_path = tmp_path / "root" / "auth.json"
    go = tmp_path / "go"
    with _FakeTokenServer("fake-refresh-0") as server:
        _write_store(
            root_path,
            _xai_store(_jwt(int(time.time()) - 60), "fake-refresh-0", server.url),
        )
        procs = []
        for i in range(processes):
            profile_path = tmp_path / "root" / "profiles" / f"seat{i}" / "auth.json"
            _write_store(profile_path, {"version": 1, "providers": {}})
            code = _CHILD_REFRESH.format(
                repo=str(REPO_ROOT),
                store=str(profile_path),
                root=_root_expr(root_path),
                endpoint=server.url,
                go=str(go),
            )
            procs.append(
                subprocess.Popen(
                    [sys.executable, "-c", code],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=_child_env(tmp_path),
                )
            )
        time.sleep(1.5)
        go.write_text("go", encoding="utf-8")
        results = []
        for p in procs:
            out, err = p.communicate(timeout=90)
            assert p.returncode == 0, err
            results.append(json.loads(out.strip().splitlines()[-1]))

    failures = [r for r in results if not r["ok"]]
    assert not failures, f"processes failed: {failures}; posts={server.posts}"
    assert server.posts == ["fake-refresh-0"], server.posts
    keys = {r["access_token"] for r in results}
    assert len(keys) == 1 and keys.pop().endswith(".gen1")
    root = _read_store(root_path)
    assert root["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "fake-refresh-1"


def test_reread_after_lock_skips_post_when_already_rotated(classic_store, monkeypatch):
    """Rotation by another process while we waited -> adopt it, never POST."""
    store_path = classic_store
    stale_access = _jwt(int(time.time()) - 60)
    _write_store(store_path, _xai_store(stale_access, "old-refresh"))
    rotated_access = _jwt(int(time.time()) + 3 * 3600)

    real_lock = A._auth_store_lock

    def lock_then_simulate_other(*a, **kw):
        _write_store(store_path, _xai_store(rotated_access, "rotated-refresh"))
        return real_lock(*a, **kw)

    monkeypatch.setattr(A, "_auth_store_lock", lock_then_simulate_other)
    monkeypatch.setattr(CP, "_auth_store_lock", lock_then_simulate_other)

    def no_post(*a, **kw):
        raise AssertionError("refresh POST must not happen after rotation")

    monkeypatch.setattr(A, "refresh_xai_oauth_pure", no_post)

    pool = load_pool("xai-oauth")
    assert pool._entries, "load_pool should seed the xAI device_code entry"
    entry = pool._entries[0]
    # In-memory entry still has the pre-rotation pair; the lock wrapper
    # must re-read and skip.
    refreshed = pool._refresh_entry(entry, force=True)

    assert refreshed is not None
    assert refreshed.access_token == rotated_access
    assert refreshed.refresh_token == "rotated-refresh"
    assert (
        _read_store(store_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"]
        == "rotated-refresh"
    )


def test_reread_after_root_lock_skips_post_when_already_rotated(
    profile_and_root, monkeypatch
):
    profile_path, root_path = profile_and_root
    stale_access = _jwt(int(time.time()) - 60)
    _write_store(root_path, _xai_store(stale_access, "old-refresh"))
    rotated_access = _jwt(int(time.time()) + 3 * 3600)

    real_lock = A._root_auth_store_lock

    def lock_then_simulate_other(*a, **kw):
        _write_store(root_path, _xai_store(rotated_access, "rotated-refresh"))
        return real_lock(*a, **kw)

    monkeypatch.setattr(A, "_root_auth_store_lock", lock_then_simulate_other)

    def no_post(*a, **kw):
        raise AssertionError("refresh POST must not happen after rotation")

    monkeypatch.setattr(A, "refresh_xai_oauth_pure", no_post)

    pool = load_pool("xai-oauth")
    assert pool._entries, "load_pool should seed the xAI device_code entry"
    entry = pool._entries[0]
    refreshed = pool._refresh_entry(entry, force=True)

    assert refreshed is not None
    assert refreshed.access_token == rotated_access
    assert refreshed.refresh_token == "rotated-refresh"
    assert (
        _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"]
        == "rotated-refresh"
    )


def test_pool_refresh_holds_auth_store_lock_across_post(classic_store, monkeypatch):
    """The xAI pool refresh must POST while the owning-store lock is held."""
    store_path = classic_store
    _write_store(store_path, _xai_store("stale-access", "stale-refresh"))

    lock_held: dict = {"during_post": None}
    real_lock = A._auth_store_lock
    depth = {"n": 0}

    import contextlib

    @contextlib.contextmanager
    def tracking_lock(*args, **kwargs):
        depth["n"] += 1
        try:
            with real_lock(*args, **kwargs):
                yield
        finally:
            depth["n"] -= 1

    monkeypatch.setattr(A, "_auth_store_lock", tracking_lock)
    monkeypatch.setattr(CP, "_auth_store_lock", tracking_lock)

    def fake_refresh(access_token, refresh_token, **kwargs):
        lock_held["during_post"] = depth["n"] > 0
        return {
            "access_token": "rotated-access",
            "refresh_token": "rotated-refresh",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    monkeypatch.setattr(A, "refresh_xai_oauth_pure", fake_refresh)

    entry = _entry(access_token="stale-access", refresh_token="stale-refresh")
    pool = CredentialPool("xai-oauth", [entry])
    refreshed = pool._refresh_entry(entry, force=True)

    assert refreshed is not None
    assert refreshed.access_token == "rotated-access"
    assert refreshed.refresh_token == "rotated-refresh"
    assert lock_held["during_post"] is True


def test_root_owned_pool_refresh_takes_root_lock(profile_and_root, monkeypatch):
    profile_path, root_path = profile_and_root
    _write_store(root_path, _xai_store("stale-access", "root-refresh-0"))
    entered_root_lock = []
    real_lock = A._root_auth_store_lock

    def tracking_lock(*a, **kw):
        entered_root_lock.append(True)
        return real_lock(*a, **kw)

    def fake_pure(access_token, refresh_token, **kw):
        return {
            "access_token": "root-access-1",
            "refresh_token": "root-refresh-1",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    monkeypatch.setattr(A, "_root_auth_store_lock", tracking_lock)
    monkeypatch.setattr(A, "refresh_xai_oauth_pure", fake_pure)

    pool = load_pool("xai-oauth")
    assert pool._entries, "load_pool should seed the xAI device_code entry"
    entry = pool._entries[0]
    refreshed = pool._refresh_entry(entry, force=True)

    assert entered_root_lock
    assert refreshed is not None
    assert refreshed.refresh_token == "root-refresh-1"
    assert (
        _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"]
        == "root-refresh-1"
    )


def test_profile_own_pool_entry_does_not_take_root_lock(profile_and_root, monkeypatch):
    profile_path, root_path = profile_and_root
    _write_store(profile_path, _xai_store("profile-access-0", "profile-refresh-0"))
    _write_store(root_path, _xai_store("root-access", "root-refresh"))

    def fake_pure(access_token, refresh_token, **kw):
        return {
            "access_token": "profile-access-1",
            "refresh_token": "profile-refresh-1",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    def root_lock_forbidden(*a, **kw):
        raise AssertionError("profile-own grant must not take the root lock")

    monkeypatch.setattr(A, "refresh_xai_oauth_pure", fake_pure)
    monkeypatch.setattr(A, "_root_auth_store_lock", root_lock_forbidden)

    pool = load_pool("xai-oauth")
    assert pool._entries, "load_pool should seed the xAI device_code entry"
    entry = pool._entries[0]
    refreshed = pool._refresh_entry(entry, force=True)

    assert refreshed is not None
    assert refreshed.refresh_token == "profile-refresh-1"
    assert (
        _read_store(profile_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"]
        == "profile-refresh-1"
    )
    root_tokens = _read_store(root_path)["providers"]["xai-oauth"]["tokens"]
    assert root_tokens["refresh_token"] == "root-refresh"


def test_classic_mode_has_no_separate_root_lock(classic_store):
    """No distinct root store -> root lock is a no-op (no self-deadlock)."""
    assert A._root_auth_lock_path() is None
    with A._auth_store_lock():
        with A._root_auth_store_lock(timeout_seconds=1):
            assert not CP.CredentialPool("xai-oauth", [])._xai_pool_entry_owned_by_root(
                _entry(access_token="a", refresh_token="r")
            )


_CHILD_HOLD_LOCK = textwrap.dedent(
    """
    import sys, time
    from pathlib import Path
    sys.path.insert(0, {repo!r})
    from hermes_cli import auth
    auth._auth_file_path = lambda: Path({store!r})
    auth._global_auth_file_path = lambda: {root}
    with auth.{lock_fn}(timeout_seconds=5):
        Path({ready!r}).write_text("locked", encoding="utf-8")
        time.sleep(120)
    """
)


def _start_holder(
    tmp_path: Path,
    store_path: Path,
    *,
    root_path: Path | None = None,
    lock_fn: str = "_auth_store_lock",
) -> subprocess.Popen:
    ready = tmp_path / "holder-ready"
    if ready.exists():
        ready.unlink()
    code = _CHILD_HOLD_LOCK.format(
        repo=str(REPO_ROOT),
        store=str(store_path),
        root=_root_expr(root_path),
        lock_fn=lock_fn,
        ready=str(ready),
    )
    proc = subprocess.Popen([sys.executable, "-c", code], env=_child_env(tmp_path))
    deadline = time.monotonic() + 30
    while not ready.exists():
        assert proc.poll() is None, "lock holder exited early"
        assert time.monotonic() < deadline, "lock holder never took the lock"
        time.sleep(0.02)
    return proc


def test_held_store_lock_times_out_with_clear_error(
    classic_store, tmp_path, monkeypatch
):
    store_path = classic_store
    _write_store(store_path, _xai_store("stale-access", "stale-refresh"))
    holder = _start_holder(tmp_path, store_path, lock_fn="_auth_store_lock")

    import contextlib

    real_lock = A._auth_store_lock

    @contextlib.contextmanager
    def short_lock(timeout_seconds=15, **kwargs):
        with real_lock(timeout_seconds=1.5):
            yield

    monkeypatch.setattr(A, "_auth_store_lock", short_lock)
    monkeypatch.setattr(CP, "_auth_store_lock", short_lock)

    def no_post(*a, **kw):
        raise AssertionError("must not POST while the lock cannot be acquired")

    monkeypatch.setattr(A, "refresh_xai_oauth_pure", no_post)

    try:
        pool = CredentialPool(
            "xai-oauth",
            [_entry(access_token="stale-access", refresh_token="stale-refresh")],
        )
        start = time.monotonic()
        with pytest.raises(TimeoutError) as exc:
            pool._refresh_entry(pool.entries()[0], force=True)
        elapsed = time.monotonic() - start
    finally:
        holder.kill()
        holder.wait(timeout=10)

    assert 1.0 <= elapsed < 6.0
    assert (
        "auth store lock" in str(exc.value).lower()
        or "timed out" in str(exc.value).lower()
    )


def test_lock_left_by_crashed_holder_does_not_block(
    classic_store, tmp_path, monkeypatch
):
    """A killed holder leaves the lock file on disk, but no kernel lock."""
    store_path = classic_store
    _write_store(store_path, _xai_store("stale-access", "stale-refresh"))
    holder = _start_holder(tmp_path, store_path, lock_fn="_auth_store_lock")
    holder.kill()
    holder.wait(timeout=10)
    assert store_path.with_suffix(".lock").exists()

    posts = []

    def fake_pure(access_token, refresh_token, **kw):
        posts.append(refresh_token)
        return {
            "access_token": "rotated-access",
            "refresh_token": "rotated-refresh",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    monkeypatch.setattr(A, "refresh_xai_oauth_pure", fake_pure)

    pool = load_pool("xai-oauth")
    assert pool._entries, "load_pool should seed the xAI device_code entry"
    start = time.monotonic()
    refreshed = pool._refresh_entry(pool._entries[0], force=True)
    elapsed = time.monotonic() - start

    assert elapsed < 3.0
    assert posts == ["stale-refresh"]
    assert refreshed is not None
    assert refreshed.refresh_token == "rotated-refresh"

"""Shared root xAI grant: store integrity around the refresh (hermes-agent#14).

Covers the CHANGES review on #14:

1. A root grant held only in root ``credential_pool["xai-oauth"]`` counts as
   root-sourced (root lock, root write, no profile fork).
2. Root-lock waiters outlast the longest hold (one refresh POST); OIDC
   discovery runs before the lock.
3. A shared refresh succeeds only after a verified re-read of root.
4. A failed or unverified write keeps the rotated grant in a 0600 recovery
   record, reports failure, never forks the profile, and the next run
   applies the record before any new POST.
5. Every root writer takes ``<root>/auth.lock``; a refresh and a concurrent
   non-refresh writer (login, credential pool) are serialised by it.

Real on-disk stores under ``tmp_path`` and a fake local token endpoint
only; no real tokens or real auth.json files are used.
"""

from __future__ import annotations

import base64
import json
import os
import stat
import subprocess
import sys
import textwrap
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

import pytest

from hermes_cli import auth

REPO_ROOT = Path(__file__).resolve().parents[2]


def _jwt(exp: int) -> str:
    def enc(obj):
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")

    return f"{enc({'alg': 'none'})}.{enc({'exp': exp})}.sig"


def _expired() -> str:
    return _jwt(int(time.time()) - 60)


def _write_store(path: Path, store: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store), encoding="utf-8")


def _read_store(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _xai_store(access: str, refresh: str, token_endpoint: str = "https://auth.x.ai/oauth2/token") -> dict:
    return {
        "version": 1,
        "providers": {
            "xai-oauth": {
                "tokens": {"access_token": access, "refresh_token": refresh, "token_type": "Bearer"},
                "discovery": {"token_endpoint": token_endpoint},
                "auth_mode": "oauth_device_code",
            }
        },
    }


def _pool_only_store(access: str, refresh: str) -> dict:
    return {
        "version": 1,
        "providers": {},
        "credential_pool": {
            "xai-oauth": [
                {
                    "id": "root-pool-1",
                    "label": "root",
                    "auth_type": "oauth",
                    "source": "device_code",
                    "access_token": access,
                    "refresh_token": refresh,
                }
            ]
        },
    }


@pytest.fixture
def seat(tmp_path, monkeypatch):
    """One profile store (no own xAI grant) plus a distinct root store."""
    profile_path = tmp_path / "root" / "profiles" / "seat1" / "auth.json"
    root_path = tmp_path / "root" / "auth.json"
    monkeypatch.setattr(auth, "_auth_file_path", lambda: profile_path)
    monkeypatch.setattr(auth, "_global_auth_file_path", lambda: root_path)
    monkeypatch.setenv("HOME", str(tmp_path / "not-the-root"))
    _write_store(profile_path, {"version": 1, "providers": {}})
    return profile_path, root_path


def _fake_pure(calls: list, access: str = "new-access-1", refresh: str = "new-refresh-1"):
    def fake(access_token, refresh_token, **kw):
        calls.append(refresh_token)
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "Bearer",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    return fake


def _no_post(*a, **kw):
    raise AssertionError("no refresh POST may happen here")


# ---------------------------------------------------------------------------
# Fake xAI token endpoint (single-use refresh tokens)
# ---------------------------------------------------------------------------


class _FakeTokenServer:
    def __init__(self, first_refresh: str, delay: float = 0.4):
        self.current_refresh = first_refresh
        self.generation = 0
        self.posts: list[str] = []
        self.delay = delay
        self.lock = threading.Lock()
        self.post_started = threading.Event()
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
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
                outer.post_started.set()
                time.sleep(outer.delay)
                if ok:
                    body = json.dumps({
                        "access_token": _jwt(int(time.time()) + 3 * 3600) + f".gen{gen}",
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
    profile_path = Path({profile!r})
    root_path = Path({root!r})
    auth._auth_file_path = lambda: profile_path
    auth._global_auth_file_path = lambda: root_path
    auth._xai_validate_oauth_endpoint = lambda url, field: url
    {extra}
    go = Path({go!r})
    while not go.exists():
        time.sleep(0.005)
    try:
        creds = auth.resolve_xai_oauth_runtime_credentials()
        print(json.dumps({{"ok": True, "api_key": creds["api_key"]}}))
    except Exception as exc:
        print(json.dumps({{"ok": False, "error": type(exc).__name__ + ": " + str(exc)}}))
    """
)


def _child_env(tmp_path: Path, **extra: str) -> dict:
    env = dict(os.environ)
    env["HOME"] = str(tmp_path / "not-the-root")
    env["USERPROFILE"] = str(tmp_path / "not-the-root")
    env["PYTHONPATH"] = str(REPO_ROOT)
    env.pop("HERMES_XAI_REFRESH_TIMEOUT_SECONDS", None)
    env.update(extra)
    return env


def _spawn_seat(tmp_path, profile_path, root_path, go, extra="", env_extra=None):
    code = _CHILD_REFRESH.format(
        repo=str(REPO_ROOT), profile=str(profile_path), root=str(root_path), go=str(go), extra=extra
    )
    return subprocess.Popen(
        [sys.executable, "-c", code],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=_child_env(tmp_path, **(env_extra or {})),
    )


def _result(proc) -> dict:
    out, err = proc.communicate(timeout=120)
    assert proc.returncode == 0, err
    return json.loads(out.strip().splitlines()[-1])


# ---------------------------------------------------------------------------
# Blocker 1: pool-only root grant is root-sourced
# ---------------------------------------------------------------------------


def test_pool_only_root_grant_is_reported_root_sourced(seat):
    profile_path, root_path = seat
    _write_store(root_path, _pool_only_store("pool-access", "pool-refresh-0"))
    data, from_root, locations = auth._read_xai_oauth_tokens_with_origin()
    assert data["tokens"]["refresh_token"] == "pool-refresh-0"
    assert from_root is True
    assert locations == ["pool"]


def test_profile_own_pool_entry_is_not_root_sourced(seat):
    profile_path, root_path = seat
    _write_store(profile_path, _pool_only_store("own-access", "own-refresh"))
    _write_store(root_path, {"version": 1, "providers": {}})
    _data, from_root, locations = auth._read_xai_oauth_tokens_with_origin()
    assert from_root is False and locations == []


def test_pool_only_root_grant_refresh_writes_root_pool_under_root_lock(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(root_path, _pool_only_store(_expired(), "pool-refresh-0"))
    calls: list = []
    held_during_post: list = []

    def fake(access_token, refresh_token, **kw):
        held_during_post.append(auth._root_auth_lock_held())
        return _fake_pure(calls)(access_token, refresh_token, **kw)

    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", fake)
    creds = auth.resolve_xai_oauth_runtime_credentials()
    assert calls == ["pool-refresh-0"]
    assert held_during_post == [True]
    assert creds["api_key"] == "new-access-1"
    root = _read_store(root_path)
    entry = root["credential_pool"]["xai-oauth"][0]
    assert entry["refresh_token"] == "new-refresh-1"
    assert entry["access_token"] == "new-access-1"
    assert "xai-oauth" not in (root.get("providers") or {})
    assert "xai-oauth" not in _read_store(profile_path).get("providers", {})


@pytest.mark.parametrize("seats", [2, 4])
def test_pool_only_root_grant_concurrent_seats_post_exactly_once(tmp_path, seats):
    root_path = tmp_path / "root" / "auth.json"
    go = tmp_path / "go"
    with _FakeTokenServer("fake-refresh-0") as server:
        store = _pool_only_store(_expired(), "fake-refresh-0")
        store["providers"] = {}
        _write_store(root_path, store)
        procs = []
        for i in range(seats):
            profile_path = tmp_path / "root" / "profiles" / f"seat{i}" / "auth.json"
            _write_store(profile_path, {"version": 1, "providers": {}})
            extra = (
                "auth._xai_oauth_discovery = lambda timeout: "
                f"{{'token_endpoint': {server.url!r}}}"
            )
            procs.append(_spawn_seat(tmp_path, profile_path, root_path, go, extra=extra))
        time.sleep(1.5)
        go.write_text("go", encoding="utf-8")
        results = [_result(p) for p in procs]
    assert all(r["ok"] for r in results), f"{results}; posts={server.posts}"
    assert server.posts == ["fake-refresh-0"], server.posts
    assert len({r["api_key"] for r in results}) == 1
    entry = _read_store(root_path)["credential_pool"]["xai-oauth"][0]
    assert entry["refresh_token"] == "fake-refresh-1"
    for i in range(seats):
        prof = _read_store(tmp_path / "root" / "profiles" / f"seat{i}" / "auth.json")
        assert "xai-oauth" not in (prof.get("providers") or {})


# ---------------------------------------------------------------------------
# Blocker 2: lock waiters outlast the hold; discovery outside the lock
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("post_timeout", ["5", "20", "45", "120"])
def test_default_lock_wait_outlasts_refresh_post(monkeypatch, post_timeout):
    monkeypatch.setenv("HERMES_XAI_REFRESH_TIMEOUT_SECONDS", post_timeout)
    wait = auth._auth_lock_wait_seconds()
    assert wait >= float(post_timeout) + auth.AUTH_LOCK_HOLD_HEADROOM_SECONDS
    assert wait >= auth.AUTH_LOCK_TIMEOUT_SECONDS


def test_discovery_runs_before_root_lock(seat, monkeypatch):
    profile_path, root_path = seat
    store = _xai_store(_expired(), "root-refresh-0")
    store["providers"]["xai-oauth"]["discovery"] = {}
    _write_store(root_path, store)
    seen: list = []

    def discovery(timeout):
        seen.append((auth._root_auth_lock_held(), auth._auth_lock_held()))
        return {"token_endpoint": "https://auth.x.ai/oauth2/token"}

    monkeypatch.setattr(auth, "_xai_oauth_discovery", discovery)
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure([]))
    auth.resolve_xai_oauth_runtime_credentials()
    assert seen == [(False, False)]


_CHILD_ROOT_MODE_WAITER = textwrap.dedent(
    """
    import json, sys, time
    from pathlib import Path
    sys.path.insert(0, {repo!r})
    from hermes_cli import auth
    root_path = Path({root!r})
    # Root-mode process: its own store IS the root store.
    auth._auth_file_path = lambda: root_path
    auth._global_auth_file_path = lambda: None
    auth.AUTH_LOCK_TIMEOUT_SECONDS = {base!r}
    started = Path({started!r})
    while not started.exists():
        time.sleep(0.005)
    t0 = time.monotonic()
    try:
        with auth._auth_store_lock():
            pass
        print(json.dumps({{"ok": True, "waited": time.monotonic() - t0}}))
    except Exception as exc:
        print(json.dumps({{"ok": False, "error": type(exc).__name__, "waited": time.monotonic() - t0}}))
    """
)


def test_root_mode_default_waiter_survives_slow_refresh_post(tmp_path):
    """A profile seat holds <root>/auth.lock across a slow POST; a root-mode
    process waiting with the DEFAULT timeout must not time out."""
    root_path = tmp_path / "root" / "auth.json"
    profile_path = tmp_path / "root" / "profiles" / "seat0" / "auth.json"
    go = tmp_path / "go"
    started = tmp_path / "post-started"
    base = 0.5      # stand-in for AUTH_LOCK_TIMEOUT_SECONDS
    post = 2.5      # POST takes longer than the base wait
    with _FakeTokenServer("fake-refresh-0", delay=post) as server:
        _write_store(root_path, _xai_store(_expired(), "fake-refresh-0", server.url))
        _write_store(profile_path, {"version": 1, "providers": {}})
        env = {"HERMES_XAI_REFRESH_TIMEOUT_SECONDS": "4"}
        seat_proc = _spawn_seat(tmp_path, profile_path, root_path, go, env_extra=env)
        waiter = subprocess.Popen(
            [sys.executable, "-c", _CHILD_ROOT_MODE_WAITER.format(
                repo=str(REPO_ROOT), root=str(root_path), base=base, started=str(started))],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            env=_child_env(tmp_path, **env),
        )
        time.sleep(1.5)
        go.write_text("go", encoding="utf-8")
        assert server.post_started.wait(30), "seat never POSTed"
        started.write_text("x", encoding="utf-8")
        seat_result = _result(seat_proc)
        waiter_result = _result(waiter)
    assert seat_result["ok"], seat_result
    assert waiter_result["ok"], waiter_result
    # It really waited behind the hold, longer than the old fixed bound.
    assert waiter_result["waited"] > base


# ---------------------------------------------------------------------------
# Blockers 3 and 4: verified write, recovery record, no fork
# ---------------------------------------------------------------------------


def _fail_root_writes(monkeypatch, root_path: Path, mode: str):
    real = auth._save_auth_store_unlocked

    def save(store, target_path=None):
        if target_path is not None and Path(target_path) == root_path:
            if mode == "raise":
                raise OSError("simulated disk full")
            if mode == "lose":
                before = root_path.read_bytes()
                real(store, target_path)
                root_path.write_bytes(before)  # write silently did not stick
                return target_path
        return real(store, target_path)

    monkeypatch.setattr(auth, "_save_auth_store_unlocked", save)


@pytest.mark.parametrize("mode", ["raise", "lose"])
def test_root_write_failure_after_post_keeps_grant_and_fails(seat, monkeypatch, mode):
    """raise: the write fails after the POST. lose: verify mismatch."""
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_expired(), "root-refresh-0"))
    calls: list = []
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure(calls, "rot-access", "rot-refresh"))
    _fail_root_writes(monkeypatch, root_path, mode)

    with pytest.raises(auth.AuthError) as exc:
        auth.resolve_xai_oauth_runtime_credentials()

    assert calls == ["root-refresh-0"]
    assert exc.value.code == "xai_store_write_failed"
    recovery = auth._xai_recovery_path(root_path)
    assert str(recovery) in str(exc.value)
    assert "rot-refresh" not in str(exc.value) and "rot-access" not in str(exc.value)
    assert recovery.exists()
    if os.name == "posix":
        assert stat.S_IMODE(recovery.stat().st_mode) == 0o600
    record = _read_store(recovery)
    assert record["tokens"]["refresh_token"] == "rot-refresh"
    assert record["tokens"]["access_token"] == "rot-access"
    # No profile fork, root unchanged.
    assert "xai-oauth" not in _read_store(profile_path).get("providers", {})
    assert _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "root-refresh-0"


def test_failure_message_and_logs_carry_no_token_values(seat, monkeypatch, caplog):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_expired(), "root-refresh-SECRET0"))
    monkeypatch.setattr(
        auth, "refresh_xai_oauth_pure", _fake_pure([], "rot-access-SECRET", "rot-refresh-SECRET")
    )
    _fail_root_writes(monkeypatch, root_path, "raise")
    with caplog.at_level("DEBUG"):
        with pytest.raises(auth.AuthError) as exc:
            auth.resolve_xai_oauth_runtime_credentials()
    assert "SECRET" not in str(exc.value)
    assert "SECRET" not in caplog.text


def test_next_run_applies_recovery_before_any_post(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_expired(), "root-refresh-0"))
    good_access = _jwt(int(time.time()) + 3 * 3600)
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure([], good_access, "rot-refresh"))
    real_save = auth._save_auth_store_unlocked
    _fail_root_writes(monkeypatch, root_path, "raise")
    with pytest.raises(auth.AuthError):
        auth.resolve_xai_oauth_runtime_credentials()

    # Storage healthy again. The next run must apply the record, not POST.
    monkeypatch.setattr(auth, "_save_auth_store_unlocked", real_save)
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _no_post)
    creds = auth.resolve_xai_oauth_runtime_credentials()
    assert creds["api_key"] == good_access
    assert _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "rot-refresh"
    assert not auth._xai_recovery_path(root_path).exists()
    assert "xai-oauth" not in _read_store(profile_path).get("providers", {})


def test_unapplied_recovery_blocks_new_post(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_expired(), "root-refresh-0"))
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure([], "rot-access", "rot-refresh"))
    _fail_root_writes(monkeypatch, root_path, "raise")
    with pytest.raises(auth.AuthError):
        auth.resolve_xai_oauth_runtime_credentials()
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _no_post)
    with pytest.raises(auth.AuthError) as exc:
        auth.resolve_xai_oauth_runtime_credentials(force_refresh=True)
    assert exc.value.code == "xai_recovery_apply_failed"
    assert auth._xai_recovery_path(root_path).exists()


def test_stale_recovery_is_kept_aside_when_root_has_other_grant(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_expired(), "root-refresh-0"))
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure([], "rot-access", "rot-refresh"))
    real_save = auth._save_auth_store_unlocked
    _fail_root_writes(monkeypatch, root_path, "raise")
    with pytest.raises(auth.AuthError):
        auth.resolve_xai_oauth_runtime_credentials()
    monkeypatch.setattr(auth, "_save_auth_store_unlocked", real_save)
    # Meanwhile the user signed in again: root has a brand-new grant.
    fresh = _jwt(int(time.time()) + 3 * 3600)
    _write_store(root_path, _xai_store(fresh, "relogin-refresh"))
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _no_post)
    creds = auth.resolve_xai_oauth_runtime_credentials()
    assert creds["api_key"] == fresh
    assert not auth._xai_recovery_path(root_path).exists()
    kept = list(root_path.parent.glob("auth.xai-oauth-recovery.stale-*.json"))
    assert len(kept) == 1
    assert _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "relogin-refresh"


def test_profile_own_grant_write_failure_keeps_recovery(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(profile_path, _xai_store(_expired(), "own-refresh-0"))
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure([], "own-access-1", "own-refresh-1"))
    real = auth._save_auth_store_unlocked

    def save(store, target_path=None):
        if target_path is None:
            raise OSError("simulated")
        return real(store, target_path)

    monkeypatch.setattr(auth, "_save_auth_store_unlocked", save)
    with pytest.raises(auth.AuthError) as exc:
        auth.resolve_xai_oauth_runtime_credentials()
    assert exc.value.code == "xai_store_write_failed"
    record = _read_store(auth._xai_recovery_path(profile_path))
    assert record["tokens"]["refresh_token"] == "own-refresh-1"


def test_terminal_error_on_root_grant_quarantines_root_not_profile(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_expired(), "dead-refresh"))

    def terminal(*a, **kw):
        raise auth.AuthError(
            "invalid_grant", provider="xai-oauth", code="xai_refresh_failed", relogin_required=True
        )

    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", terminal)
    with pytest.raises(auth.AuthError):
        auth.resolve_xai_oauth_runtime_credentials()
    root_state = _read_store(root_path)["providers"]["xai-oauth"]
    assert "refresh_token" not in root_state["tokens"]
    assert root_state["last_auth_error"]["code"] == "xai_refresh_failed"
    assert "xai-oauth" not in _read_store(profile_path).get("providers", {})


# ---------------------------------------------------------------------------
# Blocker 5: every root writer takes <root>/auth.lock
# ---------------------------------------------------------------------------


_CHILD_HOLD_ROOT_LOCK = textwrap.dedent(
    """
    import sys, time
    from pathlib import Path
    sys.path.insert(0, {repo!r})
    from hermes_cli import auth
    root_path = Path({root!r})
    auth._auth_file_path = lambda: root_path   # root-mode process
    auth._global_auth_file_path = lambda: None
    with auth._auth_store_lock(timeout_seconds=5):
        Path({ready!r}).write_text("locked", encoding="utf-8")
        time.sleep({hold!r})
    """
)


def _hold_root_lock(tmp_path: Path, root_path: Path, hold: float) -> subprocess.Popen:
    ready = tmp_path / f"holder-ready-{time.monotonic_ns()}"
    proc = subprocess.Popen(
        [sys.executable, "-c", _CHILD_HOLD_ROOT_LOCK.format(
            repo=str(REPO_ROOT), root=str(root_path), ready=str(ready), hold=hold)],
        env=_child_env(tmp_path),
    )
    deadline = time.monotonic() + 30
    while not ready.exists():
        assert proc.poll() is None, "holder exited early"
        assert time.monotonic() < deadline, "holder never took the lock"
        time.sleep(0.02)
    return proc


def _writer_login(profile_path, root_path):
    # Login path: profile save + write-through to root.
    auth._save_xai_oauth_tokens({"access_token": "login-access", "refresh_token": "login-refresh"})


def _writer_save_to_root(profile_path, root_path):
    auth._save_xai_oauth_tokens_to_root(
        {"access_token": "w-access", "refresh_token": "login-refresh"},
        previous_refresh_token="root-refresh-0",
        locations=["provider"],
    )


def _writer_pool_write_through(profile_path, root_path):
    from agent import credential_pool as CP

    with auth._auth_store_lock():
        CP._write_through_provider_state_to_global_root(
            "xai-oauth",
            {"tokens": {"access_token": "w-access", "refresh_token": "login-refresh"}},
        )


def _writer_provider_state_to_source(profile_path, root_path):
    store = auth._load_auth_store()
    with auth._auth_store_lock():
        auth._save_provider_state_to_source(
            store,
            "xai-oauth",
            {"tokens": {"access_token": "w-access", "refresh_token": "login-refresh"}},
            root_path,
        )


def _writer_save_auth_store_backstop(profile_path, root_path):
    store = _xai_store("w-access", "login-refresh")
    auth._save_auth_store(store, root_path)


def _writer_import_replace(profile_path, root_path):
    payload = json.dumps(_xai_store("w-access", "login-refresh")).encode()
    auth.replace_auth_file_locked(root_path, payload)


@pytest.mark.parametrize(
    "writer",
    [
        _writer_login,
        _writer_save_to_root,
        _writer_pool_write_through,
        _writer_provider_state_to_source,
        _writer_save_auth_store_backstop,
        _writer_import_replace,
    ],
    ids=lambda f: f.__name__.replace("_writer_", ""),
)
def test_root_writer_blocks_while_root_lock_held(seat, tmp_path, writer):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store("root-access", "root-refresh-0"))
    hold = 1.5
    holder = _hold_root_lock(tmp_path, root_path, hold)
    try:
        t0 = time.monotonic()
        writer(profile_path, root_path)
        waited = time.monotonic() - t0
    finally:
        holder.wait(timeout=30)
    assert waited >= hold * 0.6, f"{writer.__name__} did not wait for <root>/auth.lock ({waited:.2f}s)"
    assert _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "login-refresh"


def test_source_flip_between_reads_is_under_root_lock(seat, monkeypatch):
    """First read: the profile's own pool grant (not root). Before the locked
    re-read another process puts a grant in root, so the re-read resolves to
    root. That re-read, and anything it leads to, must already be under the
    root lock (the lock decision no longer depends on the first read)."""
    profile_path, root_path = seat
    _write_store(profile_path, _pool_only_store(_expired(), "own-pool-refresh"))
    _write_store(root_path, {"version": 1, "providers": {}})
    real_read = auth._read_xai_oauth_tokens_with_origin
    seen: list = []

    def read(*a, **kw):
        seen.append(auth._root_auth_lock_held())
        if len(seen) == 1:
            out = real_read(*a, **kw)
            assert out[1] is False  # first read: not root-sourced
            _write_store(root_path, _xai_store(_expired(), "root-refresh-0"))
            return out
        out = real_read(*a, **kw)
        assert out[1] is True  # re-read flipped to the root grant
        return out

    root_writes_unlocked: list = []
    real_save = auth._save_auth_store_unlocked

    def save(store, target_path=None):
        if target_path is not None and Path(target_path) == root_path:
            root_writes_unlocked.append(not auth._root_auth_lock_held())
        return real_save(store, target_path)

    monkeypatch.setattr(auth, "_read_xai_oauth_tokens_with_origin", read)
    monkeypatch.setattr(auth, "_save_auth_store_unlocked", save)
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", _fake_pure([]))
    auth.resolve_xai_oauth_runtime_credentials(force_refresh=True)
    assert seen == [False, True]
    assert not any(root_writes_unlocked)


_CHILD_LOGIN_WRITER = textwrap.dedent(
    """
    import json, sys, time
    from pathlib import Path
    sys.path.insert(0, {repo!r})
    from hermes_cli import auth
    profile_path = Path({profile!r})
    root_path = Path({root!r})
    auth._auth_file_path = lambda: profile_path
    auth._global_auth_file_path = lambda: root_path
    started = Path({started!r})
    while not started.exists():
        time.sleep(0.005)
    t0 = time.monotonic()
    {call}
    print(json.dumps({{"waited": time.monotonic() - t0}}))
    """
)

_LOGIN_CALL = (
    "auth._save_xai_oauth_tokens({'access_token': 'login-access', 'refresh_token': 'login-refresh'})"
)
_POOL_CALL = (
    "from agent import credential_pool as CP\n"
    "with auth._auth_store_lock():\n"
    "    CP._write_through_provider_state_to_global_root('xai-oauth', "
    "{'tokens': {'access_token': 'login-access', 'refresh_token': 'login-refresh'}})"
)


@pytest.mark.parametrize("call", [_LOGIN_CALL, _POOL_CALL], ids=["login", "credential_pool"])
def test_concurrent_non_refresh_writer_is_serialised_with_refresh(tmp_path, call):
    """A seat refreshes the shared grant (slow POST) while another process
    writes root through login or the credential pool. The writer must wait
    for the refresh's verified write; neither write is lost or interleaved."""
    root_path = tmp_path / "root" / "auth.json"
    seat_profile = tmp_path / "root" / "profiles" / "seat0" / "auth.json"
    writer_profile = tmp_path / "root" / "profiles" / "seat1" / "auth.json"
    go = tmp_path / "go"
    started = tmp_path / "post-started"
    delay = 1.5
    with _FakeTokenServer("fake-refresh-0", delay=delay) as server:
        _write_store(root_path, _xai_store(_expired(), "fake-refresh-0", server.url))
        _write_store(seat_profile, {"version": 1, "providers": {}})
        _write_store(writer_profile, {"version": 1, "providers": {}})
        seat_proc = _spawn_seat(tmp_path, seat_profile, root_path, go)
        writer = subprocess.Popen(
            [sys.executable, "-c", _CHILD_LOGIN_WRITER.format(
                repo=str(REPO_ROOT), profile=str(writer_profile), root=str(root_path),
                started=str(started), call=call)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=_child_env(tmp_path),
        )
        time.sleep(1.5)
        go.write_text("go", encoding="utf-8")
        assert server.post_started.wait(30)
        started.write_text("x", encoding="utf-8")
        seat_result = _result(seat_proc)
        writer_result = _result(writer)
    # The refresh succeeded with a verified root write (no interleaving).
    assert seat_result["ok"], seat_result
    assert server.posts == ["fake-refresh-0"]
    # The writer queued behind the refresh's hold on <root>/auth.lock.
    assert writer_result["waited"] > delay * 0.5, writer_result
    # Serialised order: refresh wrote first, the writer's later write is last.
    assert _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "login-refresh"

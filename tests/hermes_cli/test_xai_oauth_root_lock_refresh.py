"""Shared root xAI sign-in: refresh must be serialised on the ROOT lock.

When several profiles (Hermes "seats") have no xai-oauth tokens of their own
they all read the global-root ``auth.json`` grant through the fallback. xAI
refresh tokens are single-use, so two seats refreshing at once with the same
refresh token would make the second POST fail with ``invalid_grant`` and the
shared grant would be lost. These tests drive real on-disk stores under
``tmp_path`` and a fake local token endpoint; no real tokens are used.
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

from hermes_cli import auth

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
                # Widen the race window: a second seat that did not wait for
                # the lock would POST the same refresh token during this sleep.
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
    # The fake endpoint is plain http on loopback; skip the x.ai host check.
    auth._xai_validate_oauth_endpoint = lambda url, field: url
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


def _child_env(tmp_path: Path) -> dict:
    env = dict(os.environ)
    env["HOME"] = str(tmp_path / "not-the-root")
    env["USERPROFILE"] = str(tmp_path / "not-the-root")
    env["PYTHONPATH"] = str(REPO_ROOT)
    env.pop("HERMES_XAI_REFRESH_TIMEOUT_SECONDS", None)
    return env


@pytest.mark.parametrize("seats", [2, 4])
def test_concurrent_seat_processes_post_exactly_once(tmp_path, seats):
    """N real processes, N profiles, one shared root grant -> exactly ONE POST."""
    root_path = tmp_path / "root" / "auth.json"
    go = tmp_path / "go"
    with _FakeTokenServer("fake-refresh-0") as server:
        _write_store(root_path, _xai_store(_jwt(int(time.time()) - 60), "fake-refresh-0", server.url))
        procs = []
        for i in range(seats):
            profile_path = tmp_path / "root" / "profiles" / f"seat{i}" / "auth.json"
            _write_store(profile_path, {"version": 1, "providers": {}})
            code = _CHILD_REFRESH.format(
                repo=str(REPO_ROOT), profile=str(profile_path), root=str(root_path), go=str(go)
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
        time.sleep(1.5)  # let every child import and park on the go-file
        go.write_text("go", encoding="utf-8")
        results = []
        for p in procs:
            out, err = p.communicate(timeout=90)
            assert p.returncode == 0, err
            results.append(json.loads(out.strip().splitlines()[-1]))

    failures = [r for r in results if not r["ok"]]
    assert not failures, f"seats failed: {failures}; posts={server.posts}"
    # Exactly one refresh POST for the whole fleet, with the original token.
    assert server.posts == ["fake-refresh-0"], server.posts
    # Every seat ends up with the single rotated access token.
    keys = {r["api_key"] for r in results}
    assert len(keys) == 1 and keys.pop().endswith(".gen1")
    # The rotated refresh token landed in root (not lost), and no seat forked
    # a private copy of the chain into its own profile store.
    root = _read_store(root_path)
    assert root["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "fake-refresh-1"
    for i in range(seats):
        prof = _read_store(tmp_path / "root" / "profiles" / f"seat{i}" / "auth.json")
        assert "xai-oauth" not in (prof.get("providers") or {})


def test_reread_after_lock_skips_post_when_already_rotated(seat, monkeypatch):
    """Rotation by another seat while we waited -> adopt it, never POST."""
    profile_path, root_path = seat
    _write_store(root_path, _xai_store("old-access", "old-refresh"))
    rotated_access = _jwt(int(time.time()) + 3 * 3600)

    real_lock = auth._root_auth_store_lock

    def lock_then_simulate_other_seat(*a, **kw):
        # While we were blocked on the root lock, another seat refreshed.
        _write_store(root_path, _xai_store(rotated_access, "rotated-refresh"))
        return real_lock(*a, **kw)

    monkeypatch.setattr(auth, "_root_auth_store_lock", lock_then_simulate_other_seat)

    def no_post(*a, **kw):
        raise AssertionError("refresh POST must not happen after rotation")

    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", no_post)

    creds = auth.resolve_xai_oauth_runtime_credentials(force_refresh=True)

    assert creds["api_key"] == rotated_access
    assert _read_store(root_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "rotated-refresh"
    assert "xai-oauth" not in _read_store(profile_path)["providers"]


def test_root_sourced_refresh_posts_once_and_writes_root_only(seat, monkeypatch):
    profile_path, root_path = seat
    _write_store(root_path, _xai_store(_jwt(int(time.time()) - 60), "root-refresh-0"))
    calls = []
    entered_root_lock = []
    real_lock = auth._root_auth_store_lock

    def tracking_lock(*a, **kw):
        entered_root_lock.append(True)
        return real_lock(*a, **kw)

    def fake_pure(access_token, refresh_token, **kw):
        calls.append(refresh_token)
        return {
            "access_token": "root-access-1",
            "refresh_token": "root-refresh-1",
            "token_type": "Bearer",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    monkeypatch.setattr(auth, "_root_auth_store_lock", tracking_lock)
    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", fake_pure)

    creds = auth.resolve_xai_oauth_runtime_credentials()

    assert calls == ["root-refresh-0"]
    assert entered_root_lock
    assert creds["api_key"] == "root-access-1"
    root_tokens = _read_store(root_path)["providers"]["xai-oauth"]["tokens"]
    assert root_tokens["refresh_token"] == "root-refresh-1"
    assert "xai-oauth" not in _read_store(profile_path)["providers"]


def test_profile_own_credential_keeps_current_behaviour(seat, monkeypatch):
    """A profile with its own grant refreshes under its own lock; root untouched."""
    profile_path, root_path = seat
    _write_store(profile_path, _xai_store(_jwt(int(time.time()) - 60), "profile-refresh-0"))
    _write_store(root_path, _xai_store("root-access", "root-refresh"))
    calls = []

    def fake_pure(access_token, refresh_token, **kw):
        calls.append(refresh_token)
        return {
            "access_token": "profile-access-1",
            "refresh_token": "profile-refresh-1",
            "token_type": "Bearer",
            "last_refresh": "2026-11-19T16:00:00Z",
        }

    def root_lock_forbidden(*a, **kw):
        raise AssertionError("profile-own grant must not take the root lock")

    monkeypatch.setattr(auth, "refresh_xai_oauth_pure", fake_pure)
    monkeypatch.setattr(auth, "_root_auth_store_lock", root_lock_forbidden)

    creds = auth.resolve_xai_oauth_runtime_credentials()

    assert calls == ["profile-refresh-0"]
    assert creds["api_key"] == "profile-access-1"
    assert _read_store(profile_path)["providers"]["xai-oauth"]["tokens"]["refresh_token"] == "profile-refresh-1"
    root_tokens = _read_store(root_path)["providers"]["xai-oauth"]["tokens"]
    assert root_tokens == {"access_token": "root-access", "refresh_token": "root-refresh", "token_type": "Bearer"}


def test_classic_mode_has_no_separate_root_lock(tmp_path, monkeypatch):
    """No distinct root store -> root lock is a no-op (no self-deadlock)."""
    monkeypatch.setattr(auth, "_auth_file_path", lambda: tmp_path / "auth.json")
    monkeypatch.setattr(auth, "_global_auth_file_path", lambda: None)
    assert auth._root_auth_lock_path() is None
    with auth._auth_store_lock():
        with auth._root_auth_store_lock(timeout_seconds=1):
            pass


_CHILD_HOLD_LOCK = textwrap.dedent(
    """
    import sys, time
    from pathlib import Path
    sys.path.insert(0, {repo!r})
    from hermes_cli import auth
    profile_path = Path({profile!r})
    root_path = Path({root!r})
    auth._auth_file_path = lambda: profile_path
    auth._global_auth_file_path = lambda: root_path
    with auth._root_auth_store_lock(timeout_seconds=5):
        Path({ready!r}).write_text("locked", encoding="utf-8")
        time.sleep(120)
    """
)


def _start_holder(tmp_path: Path, profile_path: Path, root_path: Path) -> subprocess.Popen:
    ready = tmp_path / "holder-ready"
    code = _CHILD_HOLD_LOCK.format(
        repo=str(REPO_ROOT), profile=str(profile_path), root=str(root_path), ready=str(ready)
    )
    proc = subprocess.Popen([sys.executable, "-c", code], env=_child_env(tmp_path))
    deadline = time.monotonic() + 30
    while not ready.exists():
        assert proc.poll() is None, "lock holder exited early"
        assert time.monotonic() < deadline, "lock holder never took the lock"
        time.sleep(0.02)
    return proc


def test_held_root_lock_times_out_with_clear_error(seat, tmp_path):
    profile_path, root_path = seat
    holder = _start_holder(tmp_path, profile_path, root_path)
    try:
        start = time.monotonic()
        with pytest.raises(TimeoutError) as exc:
            with auth._root_auth_store_lock(timeout_seconds=1.5):
                pass
        elapsed = time.monotonic() - start
    finally:
        holder.kill()
        holder.wait(timeout=10)
    assert 1.0 <= elapsed < 6.0
    assert "root auth store lock" in str(exc.value)
    assert str(root_path.with_suffix(".lock")) in str(exc.value)


def test_lock_left_by_crashed_holder_does_not_block(seat, tmp_path):
    """A killed holder leaves the lock file on disk, but no kernel lock."""
    profile_path, root_path = seat
    holder = _start_holder(tmp_path, profile_path, root_path)
    holder.kill()
    holder.wait(timeout=10)
    assert root_path.with_suffix(".lock").exists()
    start = time.monotonic()
    with auth._root_auth_store_lock(timeout_seconds=5):
        pass
    assert time.monotonic() - start < 3.0

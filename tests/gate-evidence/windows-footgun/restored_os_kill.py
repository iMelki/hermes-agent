# Restored twin of deliberate_os_kill.py with the required suppression marker.
import os


def probe(pid: int) -> None:
    os.kill(pid, 0)  # windows-footgun: ok — POSIX liveness probe only

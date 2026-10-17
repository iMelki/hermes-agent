# Deliberate Windows footgun for negative proof (agent-settings#1130).
# Not scanned by --all (tests/ is outside that root list); pass this path
# explicitly to scripts/check-windows-footguns.py.
import os


def probe(pid: int) -> None:
    os.kill(pid, 0)

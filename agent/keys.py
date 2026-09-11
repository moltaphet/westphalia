"""Deterministic per-agent keystore.

Generates an ECDSA key on first run and persists it next to this package so
the same on-chain identity survives restarts. The key file is chmod 0600.
"""

import json
import os

from genlayer_py import create_account

_KEYS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "keys")


def _path(name: str) -> str:
    os.makedirs(_KEYS_DIR, exist_ok=True)
    return os.path.join(_KEYS_DIR, f"{name.lower()}.key.json")


def load_or_create(name: str, reset: bool = False):
    """Return the LocalAccount for `name`, creating and persisting it if new."""
    path = _path(name)
    if not reset and os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        key = data["private_key"]
        if not key.startswith("0x"):
            key = "0x" + key
        return create_account(key)

    account = create_account()
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"name": name, "private_key": account.key.hex()}, fh, indent=2)
    os.chmod(path, 0o600)
    return account


def print_addresses():
    """Summarize every persisted identity (for the demo banner / debugging)."""
    os.makedirs(_KEYS_DIR, exist_ok=True)
    for fname in sorted(os.listdir(_KEYS_DIR)):
        if not fname.endswith(".key.json"):
            continue
        with open(os.path.join(_KEYS_DIR, fname), encoding="utf-8") as fh:
            data = json.load(fh)
        acct = create_account(data["private_key"])
        yield data["name"], acct.address

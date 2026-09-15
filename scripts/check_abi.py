"""Check the frontend's hand-written ABI against the contract's real one.

`frontend/lib/contract.ts` carries DIPLOMATIC_ABI by hand: 19 method
signatures transcribed from contracts/westphalia.py. That transcription is the
one place in this repository where the contract and the frontend can drift
apart silently -- a renamed parameter or a flipped stateMutability does not
break a build, it breaks at call time, in the browser, against a live chain.

This script closes that gap using the linter's `schema` layer, which reflects
the ABI out of the contract by loading it under the exact GenVM SDK its
dependency header pins. That is the same reflection the runner does, so the
comparison is against the deployed surface rather than against a second
hand-written copy of it.

    .venv/bin/python scripts/check_abi.py

Exits 0 when the two agree, 1 when they do not (printing every difference),
and 2 when either side could not be read at all -- an unreadable side is not
agreement, and must never be reported as a pass.

Why this is not a pytest test: loading the SDK downloads a GenVM release on a
cold cache, and tests/direct/ is documented as needing no network. This runs
as its own CI step in the job that already installs the linter.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTRACT = REPO_ROOT / "contracts" / "westphalia.py"
FRONTEND_ABI = REPO_ROOT / "frontend" / "lib" / "contract.ts"

# The schema layer names GenLayer types; the ABI names the EVM-shaped types
# genlayer-js encodes against. Both are correct in their own vocabulary, so the
# comparison translates rather than demanding identical spellings. Anything not
# in this table must match exactly -- a mapping that silently accepted unknown
# types would defeat the point of the check.
RETURN_TYPE_EQUIVALENTS = {
    "dict": "json",
    "int": "uint256",
    "str": "string",
    "bool": "bool",
    # The schema reports a valueless write as the string "null"; the ABI
    # reports it as an empty outputs list. Both mean nothing comes back.
    "null": None,
    None: None,
}

EXIT_OK = 0
EXIT_DRIFT = 1
EXIT_UNREADABLE = 2


class Unreadable(Exception):
    """One side of the comparison could not be read."""


def extract_ts_array(source: str, identifier: str) -> list[dict[str, Any]]:
    """Pull the array literal assigned to `identifier` out of a TS source file.

    Deliberately strict and shallow. It converts the literal to JSON rather
    than parsing TypeScript, which works only because this array is a plain
    data literal: no interpolation, no spreads, no expressions. A line-based
    comment strip is safe here for the same reason -- the only `//` sequences
    in this file begin their line, since a URL inside a string never does.
    """
    anchor = source.find(identifier)
    if anchor < 0:
        raise Unreadable(f"{identifier} not found in {FRONTEND_ABI.name}")

    assign = source.find("=", anchor)
    start = source.find("[", assign)
    if assign < 0 or start < 0:
        raise Unreadable(f"{identifier} has no array literal")

    depth = 0
    for index in range(start, len(source)):
        char = source[index]
        if char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                body = source[start : index + 1]
                break
    else:
        raise Unreadable(f"{identifier}'s array literal is unterminated")

    body = "\n".join(
        line for line in body.splitlines() if not line.strip().startswith("//")
    )
    # Bare object keys -> quoted, so json.loads can read it.
    body = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', body)
    # Trailing commas before a closing brace/bracket are legal TS, not JSON.
    body = re.sub(r",(\s*[}\]])", r"\1", body)

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError as err:
        raise Unreadable(
            f"{identifier} is no longer a plain data literal ({err}). "
            "If it gained a spread or an expression, teach this parser about it "
            "rather than letting the check pass vacuously."
        ) from err

    if not isinstance(parsed, list) or not parsed:
        raise Unreadable(f"{identifier} parsed to {type(parsed).__name__}, not a list")
    return parsed


def contract_surface() -> dict[str, dict[str, Any]]:
    """The contract's real ABI, via the linter's SDK reflection."""
    try:
        from genvm_linter.validate.validator import validate_contract
    except ImportError as err:
        raise Unreadable(
            "genvm_linter is not installed. Install requirements.txt first."
        ) from err

    try:
        # The linter's own entry point: it loads the pinned SDK, imports the
        # contract under it, and reflects the contract class out of the module.
        # Reusing it rather than re-implementing the class lookup means this
        # script cannot disagree with `genvm-lint schema` about what the
        # contract's surface is.
        result = validate_contract(CONTRACT)
    except Exception as err:  # download failure, import failure, bad contract
        raise Unreadable(f"could not reflect the contract: {err}") from err

    if not result.ok:
        raise Unreadable(f"the contract did not validate: {result.errors}")

    methods = (result.schema or {}).get("methods")
    if not isinstance(methods, dict) or not methods:
        raise Unreadable("the contract schema carries no methods")

    surface: dict[str, dict[str, Any]] = {}
    for name, entry in methods.items():
        params = entry.get("params") or []
        surface[name] = {
            "params": [param[0] for param in params],
            "mutability": (
                "view"
                if entry.get("readonly")
                else ("payable" if entry.get("payable") else "nonpayable")
            ),
            "returns": RETURN_TYPE_EQUIVALENTS.get(entry.get("ret"), entry.get("ret")),
        }
    return surface


def frontend_surface() -> dict[str, dict[str, Any]]:
    """The ABI the browser actually calls, read out of contract.ts."""
    source = FRONTEND_ABI.read_text(encoding="utf-8")
    entries = extract_ts_array(source, "DIPLOMATIC_ABI")

    surface: dict[str, dict[str, Any]] = {}
    for entry in entries:
        for key in ("name", "stateMutability", "inputs", "outputs"):
            if key not in entry:
                raise Unreadable(f"an ABI entry is missing '{key}': {entry}")
        surface[entry["name"]] = {
            "params": [param["name"] for param in entry["inputs"]],
            "mutability": entry["stateMutability"],
            # An empty output list and a single unnamed output are the same
            # thing to a caller: nothing comes back.
            "returns": entry["outputs"][0]["type"] if entry["outputs"] else None,
        }
    return surface


def compare(
    expected: dict[str, dict[str, Any]], actual: dict[str, dict[str, Any]]
) -> list[str]:
    problems: list[str] = []

    for name in sorted(set(expected) - set(actual)):
        problems.append(f"missing from the frontend ABI: {name}")
    for name in sorted(set(actual) - set(expected)):
        problems.append(f"in the frontend ABI but not in the contract: {name}")

    for name in sorted(set(expected) & set(actual)):
        want, got = expected[name], actual[name]
        if want["mutability"] != got["mutability"]:
            problems.append(
                f"{name}: mutability is {got['mutability']} in the ABI, "
                f"{want['mutability']} in the contract"
            )
        if want["params"] != got["params"]:
            problems.append(
                f"{name}: parameters are {got['params']} in the ABI, "
                f"{want['params']} in the contract"
            )
        if want["returns"] != got["returns"]:
            problems.append(
                f"{name}: return type is {got['returns']!r} in the ABI, "
                f"{want['returns']!r} in the contract"
            )
    return problems


def main() -> int:
    try:
        expected = contract_surface()
        actual = frontend_surface()
    except Unreadable as err:
        print(f"check_abi: cannot compare -- {err}", file=sys.stderr)
        return EXIT_UNREADABLE

    problems = compare(expected, actual)
    if problems:
        print(f"check_abi: {len(problems)} difference(s):", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        print(
            "\nUpdate DIPLOMATIC_ABI in frontend/lib/contract.ts in the same "
            "commit as the contract change.",
            file=sys.stderr,
        )
        return EXIT_DRIFT

    views = sum(1 for m in expected.values() if m["mutability"] == "view")
    print(
        f"check_abi: {len(expected)} methods agree "
        f"({views} view, {len(expected) - views} write)"
    )
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())

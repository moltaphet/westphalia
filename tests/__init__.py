"""Test suites for the Westphalia protocol.

`direct/` runs the contract in an in-memory GenVM (fast, no network).
`integration/` drives the same contract through real consensus on a live
GenLayer network, and is excluded from a bare `pytest` run -- see
pyproject.toml.
"""

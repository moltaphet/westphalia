"""Expected contract state for the integration suite.

Pure data, no I/O. Kept separate from the tests so the expected shapes are
readable next to the assertions that consume them.
"""

ATTO = 10**18

# Enclave collateral and treaty bonds used across the suite, in atto-scale.
COLLATERAL = 1000 * ATTO
BOND = 1000 * ATTO

# A fresh enclave seeds at reputation 50, which prices its dispute bond at the
# 500 GEN floor. Asserted rather than assumed -- see test_dispute_bond_scales.
FRESH_REPUTATION = 50
FRESH_DISPUTE_BOND = 500 * ATTO

# Telemetry breach metrics, in basis points. The contract quantizes at
# BPS_CRITICAL = 7500 and BPS_ELEVATED = 2500, and cross-examines the two feeds
# against DIVERGENCE_BPS = 500 (>5% apart forces MALICIOUS_REPORT).
METRIC_CRITICAL = 9800
METRIC_NORMAL = 100

# What get_protocol_overview() reports on a freshly deployed, untouched contract.
EMPTY_OVERVIEW = {
    "balance": "0",
    "total_collateral": "0",
    "locked_escrow": "0",
    "reserves": "0",
    "total_claimable": "0",
    "next_treaty_id": "1",
    "solvent": True,
}

# The typed parameter set for a DATA_SHARING treaty. The key set is exact: the
# contract rejects missing or unmapped keys at proposal time.
DATA_SHARING_PARAMS = '{"min_uptime_bps": 9900, "max_latency_bps": 250}'

# Treaties are bounded: the contract rejects a zero or >365d horizon, and the
# unilateral-exit notice window means a useful test horizon is weeks, not days.
EXPIRY_SECONDS = 90 * 86400

"""
Nelson rules for Statistical Process Control.

All 8 Nelson rules are implemented. Each function accepts a numpy array of
values, a mean, and a sigma, and returns a list of indices where the rule
is violated.  A "violation index" is the last index of the window that
triggered the rule.

References
----------
- Nelson, L. S. (1984). "The Shewhart Control Chart—Tests for Special Causes".
  Journal of Quality Technology, 16(4), 237–239.
"""

from dataclasses import dataclass
from typing import Callable, Optional

import numpy as np


@dataclass
class RuleResult:
    rule: int
    name: str
    description: str
    violation_indices: list[int]


# ---------------------------------------------------------------------------
# Rule 1: One point beyond 3σ from the mean
# ---------------------------------------------------------------------------

def rule_1(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """One point is more than 3 standard deviations from the mean."""
    if sigma == 0:
        indices = []
    else:
        indices = np.where(np.abs(values - mean) > 3 * sigma)[0].tolist()
    return RuleResult(
        rule=1,
        name="Beyond 3σ",
        description="One point is more than 3 standard deviations from the mean.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 2: Nine (or more) points in a row on the same side of the mean
# ---------------------------------------------------------------------------

def rule_2(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Nine (or more) points in a row are on the same side of the mean."""
    n = len(values)
    indices: list[int] = []
    if n < 9:
        return RuleResult(
            rule=2,
            name="9 same side",
            description="Nine or more points in a row on the same side of the mean.",
            violation_indices=indices,
        )

    above = values > mean
    below = values < mean

    run_above = 0
    run_below = 0
    for i in range(n):
        if above[i]:
            run_above += 1
            run_below = 0
        elif below[i]:
            run_below += 1
            run_above = 0
        else:
            # Exactly on the mean resets both runs
            run_above = 0
            run_below = 0

        if run_above >= 9 or run_below >= 9:
            indices.append(i)

    return RuleResult(
        rule=2,
        name="9 same side",
        description="Nine or more points in a row on the same side of the mean.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 3: Six (or more) points in a row steadily increasing or decreasing
# ---------------------------------------------------------------------------

def rule_3(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Six or more points in a row are continually increasing or decreasing."""
    n = len(values)
    indices: list[int] = []
    if n < 6:
        return RuleResult(
            rule=3,
            name="6 trending",
            description="Six or more points in a row steadily increasing or decreasing.",
            violation_indices=indices,
        )

    inc = 1
    dec = 1
    for i in range(1, n):
        if values[i] > values[i - 1]:
            inc += 1
            dec = 1
        elif values[i] < values[i - 1]:
            dec += 1
            inc = 1
        else:
            inc = 1
            dec = 1

        if inc >= 6 or dec >= 6:
            indices.append(i)

    return RuleResult(
        rule=3,
        name="6 trending",
        description="Six or more points in a row steadily increasing or decreasing.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 4: Fourteen (or more) points in a row alternating in direction
# ---------------------------------------------------------------------------

def rule_4(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Fourteen or more points in a row alternate up and down."""
    n = len(values)
    indices: list[int] = []
    if n < 14:
        return RuleResult(
            rule=4,
            name="14 alternating",
            description="Fourteen or more points in a row alternating up and down.",
            violation_indices=indices,
        )

    # Build a sign array: +1 for up, -1 for down, 0 for equal
    diffs = np.diff(values)
    signs = np.sign(diffs)

    run = 1
    for i in range(1, len(signs)):
        if signs[i] != 0 and signs[i - 1] != 0 and signs[i] != signs[i - 1]:
            run += 1
        else:
            run = 1

        if run >= 13:  # 13 alternations = 14 points
            indices.append(i + 1)  # +1 because signs is offset by 1

    return RuleResult(
        rule=4,
        name="14 alternating",
        description="Fourteen or more points in a row alternating up and down.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 5: Two out of three points beyond 2σ (same side)
# ---------------------------------------------------------------------------

def rule_5(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Two out of three consecutive points are beyond 2σ on the same side."""
    n = len(values)
    indices: list[int] = []
    if n < 3 or sigma == 0:
        return RuleResult(
            rule=5,
            name="2/3 beyond 2σ",
            description="Two out of three consecutive points beyond 2σ on the same side.",
            violation_indices=indices,
        )

    above_2s = values > (mean + 2 * sigma)
    below_2s = values < (mean - 2 * sigma)

    for i in range(2, n):
        window_above = above_2s[i - 2 : i + 1]
        window_below = below_2s[i - 2 : i + 1]
        if np.sum(window_above) >= 2 or np.sum(window_below) >= 2:
            indices.append(i)

    return RuleResult(
        rule=5,
        name="2/3 beyond 2σ",
        description="Two out of three consecutive points beyond 2σ on the same side.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 6: Four out of five points beyond 1σ (same side)
# ---------------------------------------------------------------------------

def rule_6(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Four out of five consecutive points beyond 1σ on the same side."""
    n = len(values)
    indices: list[int] = []
    if n < 5 or sigma == 0:
        return RuleResult(
            rule=6,
            name="4/5 beyond 1σ",
            description="Four out of five consecutive points beyond 1σ on the same side.",
            violation_indices=indices,
        )

    above_1s = values > (mean + sigma)
    below_1s = values < (mean - sigma)

    for i in range(4, n):
        window_above = above_1s[i - 4 : i + 1]
        window_below = below_1s[i - 4 : i + 1]
        if np.sum(window_above) >= 4 or np.sum(window_below) >= 4:
            indices.append(i)

    return RuleResult(
        rule=6,
        name="4/5 beyond 1σ",
        description="Four out of five consecutive points beyond 1σ on the same side.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 7: Fifteen points in a row within 1σ of the mean (either side)
# ---------------------------------------------------------------------------

def rule_7(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Fifteen points in a row are all within 1σ of the mean."""
    n = len(values)
    indices: list[int] = []
    if n < 15 or sigma == 0:
        return RuleResult(
            rule=7,
            name="15 within 1σ",
            description="Fifteen points in a row are all within 1σ of the mean (reduced variability).",
            violation_indices=indices,
        )

    within_1s = np.abs(values - mean) < sigma
    run = 0
    for i in range(n):
        if within_1s[i]:
            run += 1
        else:
            run = 0

        if run >= 15:
            indices.append(i)

    return RuleResult(
        rule=7,
        name="15 within 1σ",
        description="Fifteen points in a row are all within 1σ of the mean (reduced variability).",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Rule 8: Eight points in a row beyond 1σ (on both sides)
# ---------------------------------------------------------------------------

def rule_8(values: np.ndarray, mean: float, sigma: float) -> RuleResult:
    """Eight points in a row are all beyond 1σ from the mean (mixture)."""
    n = len(values)
    indices: list[int] = []
    if n < 8 or sigma == 0:
        return RuleResult(
            rule=8,
            name="8 beyond 1σ",
            description="Eight points in a row beyond 1σ (on both sides), suggesting mixture.",
            violation_indices=indices,
        )

    beyond_1s = np.abs(values - mean) > sigma
    run = 0
    for i in range(n):
        if beyond_1s[i]:
            run += 1
        else:
            run = 0

        if run >= 8:
            indices.append(i)

    return RuleResult(
        rule=8,
        name="8 beyond 1σ",
        description="Eight points in a row beyond 1σ (on both sides), suggesting mixture.",
        violation_indices=indices,
    )


# ---------------------------------------------------------------------------
# Run selected rules
# ---------------------------------------------------------------------------

RULE_FUNCTIONS: dict[int, Callable] = {
    1: rule_1,
    2: rule_2,
    3: rule_3,
    4: rule_4,
    5: rule_5,
    6: rule_6,
    7: rule_7,
    8: rule_8,
}


def evaluate_rules(
    values: np.ndarray,
    mean: float,
    sigma: float,
    active_rules: Optional[set[int]] = None,
) -> list[RuleResult]:
    """
    Run selected Nelson rules.

    Parameters
    ----------
    values : np.ndarray
        Data series
    mean : float
        Process mean
    sigma : float
        Process standard deviation
    active_rules : set[int], optional
        Set of rule numbers (1-8) to evaluate. If None, evaluates no rules.

    Returns
    -------
    list[RuleResult]
        Results for evaluated rules (including rules with no violations)
    """
    rules_to_run = active_rules if active_rules is not None else set()
    return [
        RULE_FUNCTIONS[r](values, mean, sigma)
        for r in sorted(rules_to_run)
        if r in RULE_FUNCTIONS
    ]


def evaluate_all_rules(
    values: np.ndarray, mean: float, sigma: float
) -> list[RuleResult]:
    """Run all 8 Nelson rules and return results (including rules with no violations)."""
    return evaluate_rules(values, mean, sigma, set(range(1, 9)))

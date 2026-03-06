"""
Control chart calculations for SPC analysis.

Computes mean, standard deviation, and control limits (1σ, 2σ, 3σ)
for a given metric series extracted from readings.
"""

from typing import Optional

import numpy as np

from models import ControlLimits


VALID_METRICS = {
    "temp_c_cal",
    "temp_f_cal",
    "rh_cal",
    "temp_c_raw",
    "rh_raw",
    "dew_point_f_cal",
    "abs_humidity_gm3_cal",
}


def extract_metric(readings: list[dict], metric: str) -> np.ndarray:
    """Pull a single metric column from a list of reading dicts."""
    if metric not in VALID_METRICS:
        raise ValueError(f"Invalid metric '{metric}'. Choose from: {VALID_METRICS}")
    return np.array([r[metric] for r in readings], dtype=np.float64)


def compute_control_limits(
    values: np.ndarray,
    mean_override: Optional[float] = None,
    sigma_override: Optional[float] = None,
) -> ControlLimits:
    """
    Compute control limits from an array of values.

    Parameters
    ----------
    values : np.ndarray
        The data series.
    mean_override : float, optional
        Use a fixed mean (e.g. from a historical baseline) instead of
        computing from the data.
    sigma_override : float, optional
        Use a fixed sigma instead of computing from the data.

    Returns
    -------
    ControlLimits
        Mean, sigma, and ±1/2/3 sigma limits.
    """
    if len(values) < 2:
        raise ValueError("Need at least 2 data points to compute control limits")

    mean = float(mean_override if mean_override is not None else np.mean(values))
    sigma = float(sigma_override if sigma_override is not None else np.std(values, ddof=1))

    return ControlLimits(
        mean=round(mean, 6),
        sigma=round(sigma, 6),
        ucl_1sigma=round(mean + sigma, 6),
        lcl_1sigma=round(mean - sigma, 6),
        ucl_2sigma=round(mean + 2 * sigma, 6),
        lcl_2sigma=round(mean - 2 * sigma, 6),
        ucl_3sigma=round(mean + 3 * sigma, 6),
        lcl_3sigma=round(mean - 3 * sigma, 6),
    )

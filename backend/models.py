from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DeviceInfo(BaseModel):
    device_id: str
    first_seen: datetime
    last_seen: datetime
    total_readings: int


class Reading(BaseModel):
    time_utc: datetime
    device_id: str
    seq: Optional[int] = None
    temp_c_raw: float
    rh_raw: float
    temp_c_cal: float
    temp_f_cal: float
    rh_cal: float
    dew_point_f_cal: float
    abs_humidity_gm3_cal: float
    sensor_serial: Optional[str] = None
    firmware_version: Optional[str] = None
    sample_count: Optional[int] = None  # present in aggregated results


class ControlLimits(BaseModel):
    mean: float
    sigma: float
    ucl_1sigma: float
    lcl_1sigma: float
    ucl_2sigma: float
    lcl_2sigma: float
    ucl_3sigma: float
    lcl_3sigma: float


class NelsonViolation(BaseModel):
    rule: int
    rule_name: str
    description: str
    indices: list[int]
    timestamps: list[datetime]
    values: list[float]


class SPCAnalysis(BaseModel):
    metric: str
    device_id: str
    start: datetime
    end: datetime
    bucket: Optional[str]
    resolved_bucket: str  # the actual aggregation used: "raw", "1min", etc.
    control_limits: ControlLimits
    readings: list[Reading]
    violations: list[NelsonViolation]
    total_violation_count: int

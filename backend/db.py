from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg

from config import settings

pool: Optional[asyncpg.Pool] = None


async def init_pool() -> asyncpg.Pool:
    global pool
    pool = await asyncpg.create_pool(
        host=settings.pg_host,
        port=settings.pg_port,
        database=settings.pg_database,
        user=settings.pg_user,
        password=settings.pg_password,
        min_size=settings.pg_pool_min,
        max_size=settings.pg_pool_max,
    )
    return pool


async def close_pool():
    global pool
    if pool:
        await pool.close()
        pool = None


def get_pool() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("Database pool not initialised")
    return pool


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------

def _auto_bucket(start: datetime, end: datetime) -> tuple[Optional[timedelta], str]:
    """Choose a TimescaleDB time_bucket interval based on the requested range.

    Returns (timedelta_or_None, human_label).
    """
    delta = end - start
    if delta <= timedelta(hours=1):
        return None, "10s (raw)"
    elif delta <= timedelta(hours=6):
        return timedelta(minutes=1), "1 min"
    elif delta <= timedelta(hours=24):
        return timedelta(minutes=5), "5 min"
    elif delta <= timedelta(days=7):
        return timedelta(minutes=15), "15 min"
    else:
        return timedelta(hours=1), "1 hour"


VALID_BUCKETS = {"10s", "1min", "5min", "15min", "1hour", "1day"}

_BUCKET_TO_INTERVAL: dict[str, tuple[Optional[timedelta], str]] = {
    "10s":   (None,                  "10s (raw)"),
    "1min":  (timedelta(minutes=1),  "1 min"),
    "5min":  (timedelta(minutes=5),  "5 min"),
    "15min": (timedelta(minutes=15), "15 min"),
    "1hour": (timedelta(hours=1),    "1 hour"),
    "1day":  (timedelta(days=1),     "1 day"),
}


def resolve_bucket(
    start: datetime, end: datetime, bucket: Optional[str]
) -> tuple[Optional[timedelta], str]:
    """Return (timedelta_interval_or_None, human_label)."""
    if bucket and bucket in _BUCKET_TO_INTERVAL:
        return _BUCKET_TO_INTERVAL[bucket]
    return _auto_bucket(start, end)


async def fetch_devices() -> list[dict]:
    """Return distinct device_ids and their last reading time."""
    q = """
        SELECT device_id,
               MIN(time_utc) AS first_seen,
               MAX(time_utc) AS last_seen,
               COUNT(*)      AS total_readings
        FROM readings
        GROUP BY device_id
        ORDER BY device_id;
    """
    rows = await get_pool().fetch(q)
    return [dict(r) for r in rows]


async def fetch_readings(
    device_id: str,
    start: datetime,
    end: datetime,
    bucket: Optional[str] = None,
) -> tuple[list[dict], str]:
    """Fetch readings, optionally aggregated with time_bucket.

    Returns (rows, resolved_bucket_label).
    """
    interval, bucket_label = resolve_bucket(start, end, bucket)

    if interval is None:
        # Raw data
        q = """
            SELECT time_utc, device_id, seq, temp_c_raw, rh_raw,
                   temp_c_cal, temp_f_cal, rh_cal,
                   dew_point_f_cal, abs_humidity_gm3_cal,
                   sensor_serial, firmware_version
            FROM readings
            WHERE device_id = $1 AND time_utc >= $2 AND time_utc <= $3
            ORDER BY time_utc;
        """
        rows = await get_pool().fetch(q, device_id, start, end)
    else:
        q = """
            SELECT time_bucket($4, time_utc) AS time_utc,
                   device_id,
                   AVG(temp_c_raw)::REAL  AS temp_c_raw,
                   AVG(rh_raw)::REAL      AS rh_raw,
                   AVG(temp_c_cal)::REAL  AS temp_c_cal,
                   AVG(temp_f_cal)::REAL  AS temp_f_cal,
                   AVG(rh_cal)::REAL      AS rh_cal,
                   AVG(dew_point_f_cal)::REAL       AS dew_point_f_cal,
                   AVG(abs_humidity_gm3_cal)::REAL  AS abs_humidity_gm3_cal,
                   COUNT(*)               AS sample_count
            FROM readings
            WHERE device_id = $1 AND time_utc >= $2 AND time_utc <= $3
            GROUP BY time_bucket($4, time_utc), device_id
            ORDER BY time_utc;
        """
        rows = await get_pool().fetch(q, device_id, start, end, interval)

    return [dict(r) for r in rows], bucket_label


async def fetch_latest_reading(device_id: str) -> Optional[dict]:
    """Fetch the single most recent reading for a device."""
    q = """
        SELECT time_utc, device_id, seq, temp_c_raw, rh_raw,
               temp_c_cal, temp_f_cal, rh_cal,
               dew_point_f_cal, abs_humidity_gm3_cal,
               sensor_serial, firmware_version
        FROM readings
        WHERE device_id = $1
        ORDER BY time_utc DESC
        LIMIT 1;
    """
    row = await get_pool().fetchrow(q, device_id)
    return dict(row) if row else None


async def fetch_latest_readings(
    device_id: str, after: datetime
) -> list[dict]:
    """Fetch readings newer than `after` for real-time updates."""
    q = """
        SELECT time_utc, device_id, seq, temp_c_raw, rh_raw,
               temp_c_cal, temp_f_cal, rh_cal,
               dew_point_f_cal, abs_humidity_gm3_cal,
               sensor_serial, firmware_version
        FROM readings
        WHERE device_id = $1 AND time_utc > $2
        ORDER BY time_utc;
    """
    rows = await get_pool().fetch(q, device_id, after)
    return [dict(r) for r in rows]

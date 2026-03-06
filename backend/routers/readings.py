"""
Endpoints for device listing, reading queries, and SPC analysis.
"""

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

import db
from models import (
    ControlLimits,
    DeviceInfo,
    NelsonViolation,
    Reading,
    SPCAnalysis,
)
from spc.control_charts import compute_control_limits, extract_metric
from spc.nelson_rules import evaluate_rules

router = APIRouter(prefix="/api", tags=["readings"])


# ---------------------------------------------------------------------------
# GET /api/devices
# ---------------------------------------------------------------------------

@router.get("/devices", response_model=list[DeviceInfo])
async def list_devices():
    """Return all known device_ids with metadata."""
    rows = await db.fetch_devices()
    return rows


# ---------------------------------------------------------------------------
# GET /api/latest
# ---------------------------------------------------------------------------

@router.get("/latest", response_model=Optional[Reading])
async def latest_reading(
    device_id: str = Query(..., description="Sensor device ID"),
):
    """Return the most recent reading for a device."""
    row = await db.fetch_latest_reading(device_id)
    if row is None:
        return None
    return row


# ---------------------------------------------------------------------------
# GET /api/readings
# ---------------------------------------------------------------------------

@router.get("/readings", response_model=list[Reading])
async def get_readings(
    device_id: str = Query(..., description="Sensor device ID"),
    start: datetime = Query(..., description="Start of time range (ISO 8601)"),
    end: datetime = Query(..., description="End of time range (ISO 8601)"),
    bucket: Optional[str] = Query(
        None,
        description="Aggregation bucket: 10s, 1min, 5min, 15min, 1hour, 1day. Auto if omitted.",
    ),
):
    """Fetch readings for a device within a time range, optionally aggregated."""
    if bucket and bucket not in db.VALID_BUCKETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid bucket '{bucket}'. Valid: {db.VALID_BUCKETS}",
        )
    rows, _ = await db.fetch_readings(device_id, start, end, bucket)
    if not rows:
        return []
    return rows


# ---------------------------------------------------------------------------
# GET /api/spc/analysis
# ---------------------------------------------------------------------------

VALID_METRICS = {
    "temp_c_cal",
    "temp_f_cal",
    "rh_cal",
    "temp_c_raw",
    "rh_raw",
    "dew_point_f_cal",
    "abs_humidity_gm3_cal",
}


@router.get("/spc/analysis", response_model=SPCAnalysis)
async def spc_analysis(
    device_id: str = Query(..., description="Sensor device ID"),
    metric: str = Query("temp_f_cal", description="Metric to analyse"),
    start: datetime = Query(..., description="Start of time range"),
    end: datetime = Query(..., description="End of time range"),
    bucket: Optional[str] = Query(None, description="Aggregation bucket"),
    rules: Optional[list[int]] = Query(
        None,
        description="Nelson rules to evaluate (1-8). Default: none.",
    ),
):
    """Run SPC analysis with selected Nelson rules on a metric for the given range."""
    if metric not in VALID_METRICS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric '{metric}'. Valid: {VALID_METRICS}",
        )

    # Validate rules parameter
    active_rules = set(rules) if rules else set()
    invalid_rules = active_rules - set(range(1, 9))
    if invalid_rules:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule numbers: {sorted(invalid_rules)}. Valid: 1-8",
        )

    rows, resolved_bucket = await db.fetch_readings(device_id, start, end, bucket)
    if len(rows) < 2:
        raise HTTPException(
            status_code=400,
            detail="Not enough data points for SPC analysis (need >= 2).",
        )

    values = extract_metric(rows, metric)
    limits = compute_control_limits(values)
    rule_results = evaluate_rules(values, limits.mean, limits.sigma, active_rules)

    violations: list[NelsonViolation] = []
    total_count = 0
    for rr in rule_results:
        if rr.violation_indices:
            total_count += len(rr.violation_indices)
            violations.append(
                NelsonViolation(
                    rule=rr.rule,
                    rule_name=rr.name,
                    description=rr.description,
                    indices=rr.violation_indices,
                    timestamps=[rows[i]["time_utc"] for i in rr.violation_indices],
                    values=[float(values[i]) for i in rr.violation_indices],
                )
            )

    return SPCAnalysis(
        metric=metric,
        device_id=device_id,
        start=start,
        end=end,
        bucket=bucket,
        resolved_bucket=resolved_bucket,
        control_limits=limits,
        readings=[Reading(**r) for r in rows],
        violations=violations,
        total_violation_count=total_count,
    )


# ---------------------------------------------------------------------------
# GET /api/export/csv
# ---------------------------------------------------------------------------

@router.get("/export/csv")
async def export_csv(
    device_id: str = Query(...),
    start: datetime = Query(...),
    end: datetime = Query(...),
    bucket: Optional[str] = Query(None),
):
    """Download readings as CSV."""
    rows, _ = await db.fetch_readings(device_id, start, end, bucket)

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        for row in rows:
            writer.writerow({k: str(v) for k, v in row.items()})

    output.seek(0)
    filename = f"readings_{device_id}_{start.date()}_{end.date()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# WebSocket /api/ws/readings
# ---------------------------------------------------------------------------

@router.websocket("/ws/readings")
async def ws_readings(websocket: WebSocket):
    """
    Real-time reading updates via WebSocket.

    Client sends JSON: {"device_id": "...", "interval_ms": 10000}
    Server pushes new readings as they arrive.
    """
    await websocket.accept()

    try:
        # Wait for subscription message
        init = await websocket.receive_json()
        device_id = init.get("device_id")
        interval_s = init.get("interval_ms", 10000) / 1000.0

        if not device_id:
            await websocket.send_json({"error": "device_id required"})
            await websocket.close()
            return

        import asyncio

        last_seen = datetime.now(timezone.utc) - timedelta(seconds=30)

        while True:
            rows = await db.fetch_latest_readings(device_id, last_seen)
            if rows:
                last_seen = rows[-1]["time_utc"]
                # Serialise datetimes
                serialisable = []
                for r in rows:
                    item = {}
                    for k, v in r.items():
                        item[k] = v.isoformat() if isinstance(v, datetime) else v
                    serialisable.append(item)
                await websocket.send_json({"readings": serialisable})
            await asyncio.sleep(interval_s)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": str(e)})
            await websocket.close()
        except Exception:
            pass

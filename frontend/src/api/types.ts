export interface DeviceInfo {
  device_id: string;
  first_seen: string;
  last_seen: string;
  total_readings: number;
}

export interface Reading {
  time_utc: string;
  device_id: string;
  seq?: number;
  temp_c_raw: number;
  rh_raw: number;
  temp_c_cal: number;
  temp_f_cal: number;
  rh_cal: number;
  dew_point_f_cal: number;
  abs_humidity_gm3_cal: number;
  sensor_serial?: string;
  firmware_version?: string;
  sample_count?: number;
}

export interface ControlLimits {
  mean: number;
  sigma: number;
  ucl_1sigma: number;
  lcl_1sigma: number;
  ucl_2sigma: number;
  lcl_2sigma: number;
  ucl_3sigma: number;
  lcl_3sigma: number;
}

export interface NelsonViolation {
  rule: number;
  rule_name: string;
  description: string;
  indices: number[];
  timestamps: string[];
  values: number[];
}

export interface SPCAnalysis {
  metric: string;
  device_id: string;
  start: string;
  end: string;
  bucket: string | null;
  resolved_bucket: string;
  control_limits: ControlLimits;
  readings: Reading[];
  violations: NelsonViolation[];
  total_violation_count: number;
}

export type Metric =
  | "temp_c_cal"
  | "temp_f_cal"
  | "rh_cal"
  | "temp_c_raw"
  | "rh_raw"
  | "dew_point_f_cal"
  | "abs_humidity_gm3_cal";

export type Bucket = "10s" | "1min" | "5min" | "15min" | "1hour" | "1day" | "auto";

export const METRIC_LABELS: Record<Metric, string> = {
  temp_c_cal: "Temperature (°C)",
  temp_f_cal: "Temperature (°F)",
  rh_cal: "Relative Humidity (%)",
  temp_c_raw: "Temp Raw (°C)",
  rh_raw: "RH Raw (%)",
  dew_point_f_cal: "Dew Point (°F)",
  abs_humidity_gm3_cal: "Absolute Humidity (g/m³)",
};

export const BUCKET_LABELS: Record<Bucket, string> = {
  auto: "Auto",
  "10s": "10 seconds",
  "1min": "1 minute",
  "5min": "5 minutes",
  "15min": "15 minutes",
  "1hour": "1 hour",
  "1day": "1 day",
};

export const NELSON_RULE_COLORS: Record<number, string> = {
  1: "#ff4444",
  2: "#ff8800",
  3: "#ffcc00",
  4: "#44cc44",
  5: "#4488ff",
  6: "#8844ff",
  7: "#ff44cc",
  8: "#44cccc",
};

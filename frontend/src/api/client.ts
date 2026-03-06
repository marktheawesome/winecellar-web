import type { DeviceInfo, SPCAnalysis, Reading, Bucket } from "./types";

const BASE = "/api";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function getDevices(): Promise<DeviceInfo[]> {
  return fetchJSON<DeviceInfo[]>(`${BASE}/devices`);
}

export async function getLatestReading(deviceId: string): Promise<Reading | null> {
  const params = new URLSearchParams({ device_id: deviceId });
  const res = await fetch(`${BASE}/latest?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data ?? null;
}

export async function getReadings(
  deviceId: string,
  start: string,
  end: string,
  bucket?: Bucket
): Promise<Reading[]> {
  const params = new URLSearchParams({ device_id: deviceId, start, end });
  if (bucket && bucket !== "auto") params.set("bucket", bucket);
  return fetchJSON<Reading[]>(`${BASE}/readings?${params}`);
}

export async function getSPCAnalysis(
  deviceId: string,
  metric: string,
  start: string,
  end: string,
  bucket?: Bucket,
  enabledRules?: number[]
): Promise<SPCAnalysis> {
  const params = new URLSearchParams({
    device_id: deviceId,
    metric,
    start,
    end,
  });
  if (bucket && bucket !== "auto") params.set("bucket", bucket);
  if (enabledRules && enabledRules.length > 0) {
    enabledRules.forEach((r) => params.append("rules", r.toString()));
  }
  return fetchJSON<SPCAnalysis>(`${BASE}/spc/analysis?${params}`);
}

export function getExportCSVUrl(
  deviceId: string,
  start: string,
  end: string,
  bucket?: Bucket
): string {
  const params = new URLSearchParams({ device_id: deviceId, start, end });
  if (bucket && bucket !== "auto") params.set("bucket", bucket);
  return `${BASE}/export/csv?${params}`;
}

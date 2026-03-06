import { useEffect, useRef, useState, useCallback } from "react";
import type { Reading } from "../api/types";

interface UseRealtimeOptions {
  deviceId: string | null;
  enabled: boolean;
  intervalMs?: number;
}

export function useRealtime({ deviceId, enabled, intervalMs = 10000 }: UseRealtimeOptions) {
  const [newReadings, setNewReadings] = useState<Reading[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const clear = useCallback(() => setNewReadings([]), []);

  useEffect(() => {
    if (!enabled || !deviceId) {
      setConnected(false);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws/readings`;
    console.log("[WS] Connecting to", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected, subscribing to", deviceId);
      setConnected(true);
      ws.send(JSON.stringify({ device_id: deviceId, interval_ms: intervalMs }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          console.error("[WS] Server error:", data.error);
          return;
        }
        if (data.readings && Array.isArray(data.readings)) {
          console.log("[WS] Received", data.readings.length, "readings");
          setLastMessage(new Date().toLocaleTimeString());
          setNewReadings((prev) => [...prev, ...data.readings]);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = (e) => {
      console.error("[WS] Error:", e);
      setConnected(false);
    };
    ws.onclose = (e) => {
      console.log("[WS] Closed:", e.code, e.reason);
      setConnected(false);
    };

    return () => {
      console.log("[WS] Cleanup, closing connection");
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [deviceId, enabled, intervalMs]);

  return { newReadings, connected, lastMessage, clear };
}

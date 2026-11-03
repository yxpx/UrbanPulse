"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useCity } from "./city-context";
import {
  deriveInsights,
  heavyRainIndex,
  Insight,
  Sensor,
  Series,
} from "./operations";
const KEY = "urbanpulse_operations_v1";
const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
interface Value {
  insights: Insight[];
  sensors: Sensor[];
  data: Series | null;
  loading: boolean;
  error: string;
  live: string;
  weather: string;
  storageError: string;
  refresh: () => void;
  update: (
    id: string,
    text: string,
    status: Insight["status"],
    actor: string,
  ) => void;
}
const Context = createContext<Value | null>(null);
export function OperationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { cityConfig: c } = useCity();
  const [all, setAll] = useState<Insight[]>([]);
  const [ready, setReady] = useState(false);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [data, setData] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [live, setLive] = useState("Connecting");
  const [weather, setWeather] = useState("Checking forecast");
  const [revision, setRevision] = useState(0);
  const [loadedCity, setLoadedCity] = useState("");
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(raw))
        setAll(
          raw.filter(
            (x) =>
              x &&
              typeof x.id === "string" &&
              Array.isArray(x.timeline) &&
              Array.isArray(x.actions),
          ),
        );
    } catch {
      setStorageError(
        "Saved history could not be read. New actions remain available for this session.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Export actions before closing this session.",
      );
    }
  }, [all, ready]);
  const merge = (items: Insight[]) =>
    setAll((old) => {
      const ids = new Set(old.map((x) => x.id));
      const fresh = items.filter((x) => !ids.has(x.id));
      let changed = fresh.length > 0;
      const updated = old.map((x) => {
        const latest = items.find((n) => n.id === x.id);
        if (
          latest &&
          x.source !== "Historical" &&
          (latest.detail !== x.detail || latest.severity !== x.severity)
        ) {
          changed = true;
          return {
            ...x,
            detail: latest.detail,
            severity: latest.severity,
            period: latest.period,
          };
        }
        return x;
      });
      return changed ? [...fresh, ...updated] : old;
    });
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setSensors([]);
    Promise.all([
      fetch(c.files.sensorLocations, { signal: controller.signal }),
      fetch(c.files.timeseriesData, { signal: controller.signal }),
    ])
      .then(async (responses) => {
        if (responses.some((r) => !r.ok))
          throw Error("Traffic data could not be loaded.");
        return Promise.all(responses.map((r) => r.json()));
      })
      .then(([locations, series]) => {
        if (cancelled) return;
        setSensors(locations.sensors);
        setData(series);
        setLoadedCity(c.id);
        merge(deriveInsights(c.id, locations.sensors, series));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [c, ready, revision]);
  useEffect(() => {
    if (!ready || !sensors.length || loadedCity !== c.id) return;
    let cancelled = false;
    const controller = new AbortController();
    setLive("Connecting");
    setWeather("Checking forecast");
    const poll = async () => {
      try {
        const r = await fetch(`${API}/cv/state`, { signal: controller.signal });
        if (!r.ok) throw Error();
        const v = await r.json();
        if (cancelled) return;
        if (!v.active || v.city !== c.id) {
          setLive("No active feed for this city");
          return;
        }
        if (!v.updated_at || Date.now() - v.updated_at * 1000 > 30000) {
          setLive("Feed data is stale");
          return;
        }
        setLive(
          `Connected · ${v.vehicles} vehicles · ${v.congestion_pct}% congestion`,
        );
        if (v.congestion_pct < 45) return;
        const s = sensors[v.sensor_idx];
        if (!s) return;
        const day = new Date().toISOString().slice(0, 10);
        merge([
          {
            id: `${c.id}:cctv:${v.sensor_idx}:${day}`,
            city: c.id,
            source: "Live CCTV",
            severity: v.congestion_pct >= 70 ? "Critical" : "High",
            location: s.name || `Sensor ${v.sensor_idx + 1}`,
            corridor: s.corridor || "Network",
            title: "Camera congestion detected",
            detail: `${v.vehicles} vehicles in frame; congestion score ${v.congestion_pct}% (${v.congestion}).`,
            period: `Observed ${new Date(v.updated_at * 1000).toLocaleString()}`,
            created: new Date().toISOString(),
            status: "New",
            actions: ["personnel", "clearance", "advisory", "monitor"],
            timeline: [],
          },
        ]);
      } catch {
        if (!cancelled) setLive("CCTV backend unavailable");
      }
    };
    poll();
    const timer = setInterval(poll, 5000);
    const params = new URLSearchParams({
      latitude: String(c.center[0]),
      longitude: String(c.center[1]),
      hourly: "precipitation,precipitation_probability",
      forecast_days: "3",
      timezone: "auto",
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) => {
        if (cancelled) return;
        setWeather("48-hour weather forecast connected");
        const h = v.hourly;
        const cityNow = new Date()
          .toLocaleString("sv-SE", { timeZone: v.timezone })
          .replace(" ", "T")
          .slice(0, 16);
        const idx = heavyRainIndex(h, cityNow);
        if (idx < 0) {
          setWeather("No heavy-rain threshold crossed in next 48 hours");
          return;
        }
        merge([
          {
            id: `${c.id}:rain:${h.time[idx]}`,
            city: c.id,
            source: "Forecast",
            severity: h.precipitation[idx] >= 15 ? "Critical" : "High",
            location: c.name,
            corridor: "City-wide",
            title: "Heavy rain and waterlogging risk",
            detail: `${h.precipitation[idx]} mm rain forecast in one hour, ${h.precipitation_probability[idx]}% precipitation probability. Review low-lying roads and drainage readiness.`,
            period: `${h.time[idx].replace("T", " ")} (${v.timezone})`,
            created: new Date().toISOString(),
            status: "New",
            actions: ["pumps", "drains", "diversion", "advisory"],
            timeline: [],
          },
        ]);
      })
      .catch(() => {
        if (!cancelled) setWeather("Weather forecast unavailable");
      });
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [c, sensors, ready, revision, loadedCity]);
  const update: Value["update"] = (id, text, status, actor) =>
    setAll((old) =>
      old.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              timeline: [
                ...x.timeline,
                { at: new Date().toISOString(), actor, text, status },
              ],
            }
          : x,
      ),
    );
  return (
    <Context.Provider
      value={{
        insights: all.filter((x) => x.city === c.id),
        sensors,
        data,
        loading,
        error,
        live,
        weather,
        storageError,
        refresh: () => setRevision((x) => x + 1),
        update,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useOperations() {
  const value = useContext(Context);
  if (!value) throw Error("OperationsProvider missing");
  return value;
}

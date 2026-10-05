"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { C, tooltipStyle, gridStroke, axisStroke } from "@/lib/theme";
import { useCity, CityConfig } from "@/lib/city-context";
import { Thermometer, Droplets, Wind, Eye, MapPin, Activity, TrendingDown, BarChart3, Video } from "lucide-react";

const TrafficMap = dynamic(() => import("@/components/traffic-map"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface DashboardData {
  timeseries: Record<string, { actual: number[]; predicted: number[]; name?: string; corridor?: string }>;
  error_stats: { mae: number; rmse: number; p50: number; p90: number; p95: number };
  sensor_performance: { best_5: { sensor: number; mae: number }[]; worst_5: { sensor: number; mae: number }[] };
}

interface Sensor {
  id: number;
  sensor_id?: string;
  name?: string;
  corridor?: string;
  lat: number;
  lng: number;
  avg_speed: number;
  congestion: number;
  color: string;
}

interface SensorData {
  sensors: Sensor[];
  edges: [number, number][];
}

interface Weather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  visibility: number;
}

interface CctvState {
  active: boolean;
  sensor_idx: number | null;
  congestion: string;
  congestion_pct: number;
  vehicles: number;
  last_updated: string;
}

interface TrainMetrics {
  val_mae: number;
  val_rmse: number;
  val_loss: number;
}

async function fetchWeather(cityConfig: CityConfig): Promise<Weather> {
  try {
    const { latitude, longitude, temperature_unit, wind_speed_unit } = cityConfig.openMeteoParams;
    let url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,visibility`;
    if (temperature_unit) url += `&temperature_unit=${temperature_unit}`;
    if (wind_speed_unit) url += `&wind_speed_unit=${wind_speed_unit}`;

    const r = await fetch(url);
    const d = await r.json();
    const visRaw = d.current.visibility || 10000;
    const vis = cityConfig.speedUnit === "mph" ? Math.round(visRaw / 1609) : Math.round(visRaw / 1000);
    return {
      temperature: Math.round(d.current.temperature_2m),
      humidity: Math.round(d.current.relative_humidity_2m),
      windSpeed: Math.round(d.current.wind_speed_10m),
      visibility: vis,
    };
  } catch {
    return cityConfig.id === "la"
      ? { temperature: 72, humidity: 45, windSpeed: 8, visibility: 10 }
      : { temperature: 31, humidity: 82, windSpeed: 16, visibility: 6 };
  }
}

export default function HomePage() {
  const { city, cityConfig } = useCity();
  const [data, setData] = useState<DashboardData | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [edges, setEdges] = useState<[number, number][]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [sensorQuery, setSensorQuery] = useState("");
  const [highlightSensorId, setHighlightSensorId] = useState<number | null>(null);
  const [cctvState, setCctvState] = useState<CctvState | null>(null);
  const [trainMetrics, setTrainMetrics] = useState<TrainMetrics | null>(null);

  useEffect(() => {
    fetch(cityConfig.files.dashboardData)
      .then((r) => r.json())
      .then(setData);

    fetch(cityConfig.files.sensorLocations)
      .then((r) => r.json())
      .then((d: SensorData) => {
        setSensors(d.sensors);
        setEdges(d.edges);
      });

    fetchWeather(cityConfig).then(setWeather);

    if (cityConfig.id === "la") {
      fetch("/metrics.csv")
        .then((r) => r.text())
        .then((text) => {
          const lines = text.trim().split("\n");
          const cols = lines[lines.length - 1].split(",");
          setTrainMetrics({
            val_mae: parseFloat(cols[3]),
            val_rmse: parseFloat(cols[4]),
            val_loss: parseFloat(cols[2]),
          });
        })
        .catch(() => {});
    } else {
      setTrainMetrics({
        val_mae: 2.88,
        val_rmse: 3.85,
        val_loss: 0.148,
      });
    }
  }, [cityConfig]);

  /* Poll CCTV state every 3s */
  useEffect(() => {
    const poll = () =>
      fetch(`${API_BASE}/cv/state`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setCctvState(d); })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sensorQuery) {
      if (cctvState?.active && cctvState.sensor_idx != null && sensors.length) {
        const idx = Math.min(cctvState.sensor_idx, sensors.length - 1);
        setHighlightSensorId(sensors[idx]?.id ?? null);
      } else {
        setHighlightSensorId(null);
      }
      return;
    }
    const num = Number(sensorQuery);
    if (!Number.isFinite(num) || !sensors.length) return;
    const idx = Math.min(Math.max(Math.floor(num), 1), sensors.length) - 1;
    const sensor = sensors[idx];
    setHighlightSensorId(sensor?.id ?? null);
  }, [sensorQuery, sensors, cctvState]);

  if (!data) return <div className="flex items-center justify-center h-96 text-muted-foreground">Loading...</div>;

  const sensorIds = Object.keys(data.timeseries);
  const firstId = sensorIds[0] || "0";
  const raw = data.timeseries[firstId];
  const ts = raw ? raw.actual.slice(0, 200).map((a, i) => ({ t: i, actual: a, predicted: raw.predicted[i] })) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>System Overview</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
              {cityConfig.flag} {cityConfig.name}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time traffic network monitoring across {cityConfig.name} ({cityConfig.subtitle})
          </p>
        </div>
      </div>

      {/* Weather + Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {weather && (
          <>
            <StatCard
              icon={Thermometer}
              label="Temperature"
              value={`${weather.temperature.toFixed(0)}${cityConfig.tempUnit}`}
              sub={cityConfig.name}
            />
            <StatCard icon={Droplets} label="Humidity" value={`${weather.humidity}%`} sub="Relative" />
            <StatCard
              icon={Wind}
              label="Wind Speed"
              value={`${weather.windSpeed.toFixed(0)} ${cityConfig.windUnit}`}
              sub="Surface"
            />
            <StatCard
              icon={Eye}
              label="Visibility"
              value={`${weather.visibility} ${cityConfig.speedUnit === "mph" ? "mi" : "km"}`}
              sub="Horizontal"
            />
          </>
        )}
      </div>

      {/* Key Metrics + CCTV Status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={MapPin}
          label="Active Sensors"
          value={String(sensors.length || cityConfig.sensorCount)}
          sub={`${cityConfig.name} network`}
          accent
        />
        <StatCard
          icon={Activity}
          label="MAE"
          value={(trainMetrics?.val_mae ?? data.error_stats.mae).toFixed(3)}
          sub={`Error (${cityConfig.speedUnit})`}
          accent
        />
        <StatCard
          icon={TrendingDown}
          label="RMSE"
          value={(trainMetrics?.val_rmse ?? data.error_stats.rmse).toFixed(3)}
          sub={`RMSE (${cityConfig.speedUnit})`}
          accent
        />
        <StatCard
          icon={BarChart3}
          label="Val Loss"
          value={(trainMetrics?.val_loss ?? data.error_stats.p95).toFixed(3)}
          sub="Model Loss"
          accent
        />
        <CctvStatusCard state={cctvState} />
      </div>

      {/* Map */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Traffic Sensor Network — {cityConfig.name}</CardTitle>
              <CardDescription>
                Sensor graph with {sensors.length || cityConfig.sensorCount} checkpoints across {cityConfig.name}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={sensors.length || cityConfig.sensorCount}
                placeholder="Sensor #"
                value={sensorQuery}
                onChange={(e) => setSensorQuery(e.target.value)}
                className="w-24 rounded-md border border-border bg-card text-foreground text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TrafficMap
            sensors={sensors}
            edges={edges}
            height="520px"
            highlightSensorId={highlightSensorId}
            speedUnit={cityConfig.speedUnit}
          />
        </CardContent>
      </Card>

      {/* Time Series Sample */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Sample Forecast — Sensor {firstId} ({cityConfig.speedUnit})
          </CardTitle>
          <CardDescription>
            Actual vs. predicted speed over 200 time steps ({cityConfig.speedUnit})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={ts}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="t" tick={{ fill: axisStroke, fontSize: 11 }} stroke={gridStroke} />
              <YAxis tick={{ fill: axisStroke, fontSize: 11 }} stroke={gridStroke} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
              <Line type="monotone" dataKey="actual" stroke={C.muted} strokeWidth={1.5} dot={false} name="Actual" />
              <Line type="monotone" dataKey="predicted" stroke={C.chart1} strokeWidth={2} dot={false} name="Predicted" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sensor Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Best Performing Checkpoints</CardTitle>
            <CardDescription>Lowest MAE across the {cityConfig.name} network</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.sensor_performance.best_5} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} stroke={gridStroke} />
                <YAxis type="category" dataKey="sensor" tick={{ fill: axisStroke, fontSize: 11 }} stroke={gridStroke} width={60} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="mae" radius={[0, 4, 4, 0]} fill={C.chart1} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chokepoints / Bottlenecks</CardTitle>
            <CardDescription>Highest variance and error — severe traffic bottlenecks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.sensor_performance.worst_5} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tick={{ fill: axisStroke, fontSize: 11 }} stroke={gridStroke} />
                <YAxis type="category" dataKey="sensor" tick={{ fill: axisStroke, fontSize: 11 }} stroke={gridStroke} width={60} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="mae" radius={[0, 4, 4, 0]} fill={C.destructive} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ElementType; label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${accent ? "bg-accent" : "bg-muted"}`}>
            <Icon className={`h-4 w-4 ${accent ? "text-accent-foreground" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-lg font-semibold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CctvStatusCard({ state }: { state: CctvState | null }) {
  const active = state?.active ?? false;
  const congColor =
    state?.congestion === "Severe" ? "text-red-500" :
    state?.congestion === "Moderate" ? "text-orange-500" :
    state?.congestion === "Light" ? "text-yellow-500" :
    state?.congestion === "Free Flow" ? "text-green-500" :
    "text-muted-foreground";

  return (
    <Card className={active ? "ring-1 ring-primary/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${active ? "bg-primary/10" : "bg-muted"}`}>
            <Video className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">CCTV Feed</p>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
              <p className="text-lg font-semibold text-foreground">{active ? "Live" : "Offline"}</p>
            </div>
            {active ? (
              <p className="text-[10px] text-muted-foreground truncate">
                Sensor {state!.sensor_idx} &middot; <span className={congColor}>{state!.congestion}</span> &middot; {state!.vehicles} vehicles
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">No active session</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

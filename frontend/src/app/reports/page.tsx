"use client";
import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Printer, Save, FolderOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { button, control } from "@/components/operations-ui";
import { useCity } from "@/lib/city-context";
import { useAuth } from "@/lib/auth";
import { useOperations } from "@/lib/operations-context";
import { csv, download, mean, sensorName, valid } from "@/lib/operations";
const SECTIONS = [
  "Traffic Overview",
  "Congestion Hotspots",
  "CCTV Summary",
  "Operator Actions",
] as const;
type Section = (typeof SECTIONS)[number];
interface Saved {
  id: string;
  city: string;
  name: string;
  from: number;
  to: number;
  sections: Section[];
  saved: string;
}
const KEY = "urbanpulse_reports_v1";
export default function ReportsPage() {
  const { cityConfig: c } = useCity();
  const { user } = useAuth();
  const {
    data,
    sensors,
    insights,
    loading,
    error,
    live,
    storageError,
    refresh,
  } = useOperations();
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(288);
  const [sections, setSections] = useState<Section[]>([...SECTIONS]);
  const [name, setName] = useState("Traffic Operations Review");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [notice, setNotice] = useState("");
  const [generated, setGenerated] = useState("");
  useEffect(() => {
    setGenerated(new Date().toISOString());
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (Array.isArray(raw))
        setSaved(
          raw.filter(
            (x) => x && Array.isArray(x.sections) && typeof x.city === "string",
          ),
        );
    } catch {
      setNotice("Saved report configurations could not be read.");
    }
  }, []);
  const length = data
    ? Math.max(0, ...Object.values(data.series).map((s) => s.actual.length))
    : 0;
  useEffect(() => {
    setFrom(1);
    setTo(length || 1);
  }, [c.id, length]);
  const start = Math.max(1, Math.min(from, length || 1));
  const end = Math.max(start, Math.min(to, length || 1));
  const rows = useMemo(
    () =>
      sensors
        .flatMap((s, i) => {
          if (!data) return [];
          const sid = s.sensor_id || data.sensor_ids[i];
          const series = data.series[sid];
          if (!series) return [];
          const actual = valid(series.actual.slice(start - 1, end));
          if (!actual.length) return [];
          const reference = s.v_free || Math.max(...valid(series.actual));
          const predicted = valid(series.predicted.slice(start - 1, end));
          const congested = actual.filter((v) => v < reference * 0.4).length;
          return [
            {
              id: sid,
              location: sensorName(s, i),
              corridor: s.corridor || "Network",
              avg: mean(actual),
              predicted: mean(predicted),
              min: Math.min(...actual),
              congested,
              pct: (congested / actual.length) * 100,
              count: actual.length,
            },
          ];
        })
        .sort((a, b) => b.pct - a.pct),
    [data, sensors, start, end],
  );
  const trend = useMemo(() => {
    if (!data) return [];
    const points: { actual: number; predicted: number; sample: number }[] = [];
    const stride = Math.max(1, Math.ceil((end - start + 1) / 80));
    for (let i = start - 1; i < end; i += stride) {
      const series = Object.values(data.series);
      points.push({
        actual: mean(valid(series.map((s) => s.actual[i]))),
        predicted: mean(valid(series.map((s) => s.predicted[i]))),
        sample: i + 1,
      });
    }
    return points;
  }, [data, start, end]);
  const actions = insights
    .flatMap((x) =>
      x.timeline.map((t) => ({
        ...t,
        location: x.location,
        source: x.source,
        status: x.status,
      })),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const cameras = insights.filter((x) => x.source === "Live CCTV");
  const avg = rows.length
    ? rows.reduce((sum, r) => sum + r.avg * r.count, 0) /
      rows.reduce((sum, r) => sum + r.count, 0)
    : 0;
  const samplePct = rows.length
    ? (rows.reduce((sum, r) => sum + r.congested, 0) /
        rows.reduce((sum, r) => sum + r.count, 0)) *
      100
    : 0;
  const reportId = `UP-${c.id.toUpperCase()}-${generated.slice(0, 10).replaceAll("-", "")}-${start}-${end}`;
  function save() {
    if (!sections.length) return;
    const entry: Saved = {
      id: String(Date.now()),
      city: c.id,
      name: name.trim() || "Traffic Operations Review",
      from: start,
      to: end,
      sections,
      saved: new Date().toISOString(),
    };
    const next = [entry, ...saved].slice(0, 12);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(next);
      setNotice("Report configuration saved.");
    } catch {
      setNotice(
        "Browser storage unavailable. Export or print this report before leaving.",
      );
    }
  }
  function exportCsv() {
    const records: (string | number)[][] = [
      ["UrbanPulse", name],
      ["City", c.name],
      ["Sample range", `${start} to ${end}`],
      ["Unit", data?.unit || c.speedUnit],
    ];
    if (sections.includes("Traffic Overview"))
      records.push(
        [],
        ["Traffic overview"],
        ["Mean speed", avg.toFixed(2)],
        ["Congested samples (%)", samplePct.toFixed(2)],
        ["Sample", "Actual mean speed", "Predicted mean speed"],
        ...trend.map((x) => [
          x.sample,
          x.actual.toFixed(2),
          x.predicted.toFixed(2),
        ]),
      );
    if (sections.includes("Congestion Hotspots"))
      records.push(
        [],
        [
          "Location",
          "Corridor",
          "Mean speed",
          "Minimum speed",
          "Congested samples",
          "Congested (%)",
        ],
        ...rows.map((r) => [
          r.location,
          r.corridor,
          r.avg.toFixed(2),
          r.min.toFixed(2),
          r.congested,
          r.pct.toFixed(1),
        ]),
      );
    if (sections.includes("CCTV Summary"))
      records.push(
        [],
        [
          "CCTV location",
          "Severity",
          "Observation",
          "Observed period",
          "Status",
        ],
        ...cameras.map((x) => [
          x.location,
          x.severity,
          x.detail,
          x.period,
          x.status,
        ]),
      );
    if (sections.includes("Operator Actions"))
      records.push(
        [],
        [
          "Recorded at",
          "Operator",
          "Location",
          "Action",
          "Current insight status",
        ],
        ...actions.map((x) => [x.at, x.actor, x.location, x.text, x.status]),
      );
    download(`${reportId}.csv`, csv(records));
  }
  const unit = data?.unit || c.speedUnit;
  return (
    <div className="space-y-6 reports-page">
      <div className="report-controls flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-primary" />
            Reports &amp; Review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a traffic review with operational context and recorded
            decisions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            disabled={!data || !sections.length}
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            className={`${button} bg-primary text-primary-foreground hover:opacity-90`}
            disabled={!data || !sections.length}
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>
      <div className="report-controls grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Report configuration</CardTitle>
            <CardDescription>
              {c.name} · Select an available archived traffic window
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block text-xs text-muted-foreground">
              Report title
              <input
                maxLength={100}
                className={`${control} mt-1.5 w-full`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground">
                From sample
                <input
                  type="number"
                  min={1}
                  max={length || 1}
                  className={`${control} mt-1.5 w-full`}
                  value={from}
                  onChange={(e) => setFrom(Number(e.target.value) || 1)}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                To sample
                <input
                  type="number"
                  min={start}
                  max={length || 1}
                  className={`${control} mt-1.5 w-full`}
                  value={to}
                  onChange={(e) => setTo(Number(e.target.value) || 1)}
                />
              </label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {length} available samples. Traffic charts use this range; CCTV
              and action logs include all saved city activity.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SECTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={sections.includes(s)}
                    onChange={() =>
                      setSections((old) =>
                        old.includes(s)
                          ? old.filter((x) => x !== s)
                          : [...old, s],
                      )
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <button
              className={button}
              disabled={!data || !sections.length}
              onClick={save}
            >
              <Save className="h-3.5 w-3.5" />
              Save configuration
            </button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent configurations</CardTitle>
            <CardDescription>
              Reopen a saved layout for {c.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 space-y-2 overflow-auto">
            {!saved.filter((x) => x.city === c.id).length && (
              <p className="text-xs text-muted-foreground">
                Saved report configurations will appear here.
              </p>
            )}
            {saved
              .filter((x) => x.city === c.id)
              .map((x) => (
                <button
                  key={x.id}
                  className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted"
                  onClick={() => {
                    setName(x.name);
                    setFrom(x.from);
                    setTo(x.to);
                    setSections(x.sections.filter((s) => SECTIONS.includes(s)));
                    setNotice(
                      "Saved configuration opened with current data and activity.",
                    );
                  }}
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {x.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Samples {x.from} to {x.to} ·{" "}
                      {new Date(x.saved).toLocaleDateString()}
                    </span>
                  </span>
                </button>
              ))}
          </CardContent>
        </Card>
      </div>
      {notice && (
        <div
          role="status"
          className="report-controls rounded-md border border-primary/30 bg-primary/10 p-3 text-sm"
        >
          {notice}
        </div>
      )}
      {storageError && (
        <p role="alert" className="report-controls text-sm text-red-400">
          {storageError}
        </p>
      )}
      {error ? (
        <div
          role="alert"
          className="report-controls rounded-lg border border-border p-8 text-sm"
        >
          {error}
          <button onClick={refresh} className={`${button} ml-4`}>
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          Preparing report...
        </div>
      ) : !sections.length ? (
        <p className="p-12 text-center text-sm text-muted-foreground">
          Select at least one report section to preview.
        </p>
      ) : (
        data && (
          <article className="report-paper mx-auto max-w-[1000px]">
            <header className="report-header">
              <div>
                <div className="report-brand">
                  URBANPULSE <span>TRAFFIC INTELLIGENCE</span>
                </div>
                <p className="report-eyebrow">OPERATIONS REVIEW</p>
                <h1>{name.trim() || "Traffic Operations Review"}</h1>
                <p className="report-subtitle">
                  {c.name} · Archived samples {start} to {end}
                </p>
              </div>
              <div className="report-meta">
                <strong>{reportId}</strong>
                <span>
                  Prepared{" "}
                  {generated ? new Date(generated).toLocaleDateString() : ""}
                </span>
                <span>Prepared by {user?.username || "Operator"}</span>
                <span>{rows.length} reporting sensors</span>
              </div>
            </header>
            <div className="report-scope">
              <strong>Review scope</strong>
              <p>
                Traffic statistics use the selected archived dataset window.
                Congestion denotes valid speed samples below 40% of each
                sensor’s reference speed. CCTV observations and operator
                activity are the saved records for {c.name}.
              </p>
            </div>
            {sections.includes("Traffic Overview") && (
              <section className="report-section">
                <h2>
                  <span>01</span> Traffic overview
                </h2>
                <div className="report-metrics">
                  <div>
                    <span>Mean observed speed</span>
                    <strong>
                      {avg.toFixed(1)} <small>{unit}</small>
                    </strong>
                  </div>
                  <div>
                    <span>Congested samples</span>
                    <strong>
                      {samplePct.toFixed(1)}
                      <small>%</small>
                    </strong>
                  </div>
                  <div>
                    <span>Locations with slowdown</span>
                    <strong>
                      {rows.filter((x) => x.congested > 0).length}
                      <small> / {rows.length}</small>
                    </strong>
                  </div>
                  <div>
                    <span>Operator activities</span>
                    <strong>{actions.length}</strong>
                  </div>
                </div>
                <h3>
                  Network speed profile{" "}
                  <small>Actual and predicted · {unit}</small>
                </h3>
                <SpeedChart values={trend} />
                <p className="report-caption">
                  Sensor means at up to 80 evenly spaced samples. Zero or
                  invalid speed readings are excluded.
                </p>
              </section>
            )}
            {sections.includes("Congestion Hotspots") && (
              <section className="report-section">
                <h2>
                  <span>02</span> Congestion hotspots
                </h2>
                <p className="report-caption">
                  Top 10 locations ranked by proportion of congested samples in
                  the selected range.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Location / corridor</th>
                      <th>Mean speed</th>
                      <th>Minimum</th>
                      <th>Congested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.location}</strong>
                          <small>{r.corridor}</small>
                        </td>
                        <td>
                          {r.avg.toFixed(1)} {unit}
                        </td>
                        <td>
                          {r.min.toFixed(1)} {unit}
                        </td>
                        <td>
                          <div className="report-bar">
                            <i style={{ width: `${r.pct}%` }} />
                          </div>
                          {r.pct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
            {sections.includes("CCTV Summary") && (
              <section className="report-section">
                <h2>
                  <span>03</span> CCTV monitoring summary
                </h2>
                <p className="report-caption">
                  Current connection: {live}. Recorded camera alerts:{" "}
                  {cameras.length}.
                </p>
                {cameras.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Observation</th>
                        <th>Priority / status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cameras.map((x) => (
                        <tr key={x.id}>
                          <td>
                            <strong>{x.location}</strong>
                            <small>{x.period}</small>
                          </td>
                          <td>{x.detail}</td>
                          <td>
                            {x.severity}
                            <small>{x.status}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="report-empty">
                    No camera congestion alerts recorded for this city.
                  </div>
                )}
              </section>
            )}
            {sections.includes("Operator Actions") && (
              <section className="report-section">
                <h2>
                  <span>04</span> Operator action register
                </h2>
                <p className="report-caption">
                  All saved city activity, newest first.{" "}
                  {insights.filter((x) => x.status === "Resolved").length}{" "}
                  insights resolved.
                </p>
                {actions.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Recorded / operator</th>
                        <th>Location</th>
                        <th>Decision / activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((x, i) => (
                        <tr key={i}>
                          <td>
                            {new Date(x.at).toLocaleString()}
                            <small>{x.actor}</small>
                          </td>
                          <td>
                            {x.location}
                            <small>{x.source}</small>
                          </td>
                          <td>
                            {x.text}
                            <small>Current status: {x.status}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="report-empty">
                    No operator actions recorded. Actions saved in Traffic
                    Operations appear here.
                  </div>
                )}
              </section>
            )}
            <footer className="report-footer">
              <strong>UrbanPulse</strong>
              <span>
                {c.name} · {reportId}
              </span>
              <span>Traffic intelligence &amp; forecasting</span>
            </footer>
          </article>
        )
      )}
    </div>
  );
}
function SpeedChart({
  values,
}: {
  values: { actual: number; predicted: number; sample: number }[];
}) {
  const max = Math.max(10, ...values.flatMap((x) => [x.actual, x.predicted]));
  const path = (key: "actual" | "predicted") =>
    values
      .map(
        (x, i) =>
          `${i ? "L" : "M"}${45 + (i / Math.max(1, values.length - 1)) * 700},${175 - (x[key] / max) * 145}`,
      )
      .join(" ");
  return (
    <svg
      className="report-chart"
      viewBox="0 0 780 220"
      role="img"
      aria-label="Network actual and predicted speed across the selected sample window"
    >
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1="45"
            x2="745"
            y1={175 - v * 145}
            y2={175 - v * 145}
            stroke="#e2e8f0"
          />
          <text
            x="35"
            y={179 - v * 145}
            textAnchor="end"
            fill="#64748b"
            fontSize="10"
          >
            {(v * max).toFixed(0)}
          </text>
        </g>
      ))}
      <path d={path("actual")} fill="none" stroke="#2563eb" strokeWidth="2" />
      <path
        d={path("predicted")}
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <text x="45" y="197" fill="#64748b" fontSize="10">
        Sample {values[0]?.sample}
      </text>
      <text x="745" y="197" textAnchor="end" fill="#64748b" fontSize="10">
        Sample {values[values.length - 1]?.sample}
      </text>
      <text x="310" y="216" fill="#2563eb" fontSize="11">
        Actual
      </text>
      <text x="390" y="216" fill="#64748b" fontSize="11">
        Predicted (dashed)
      </text>
    </svg>
  );
}

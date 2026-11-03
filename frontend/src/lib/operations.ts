export const ACTIONS = {
  pumps: "Deploy dewatering crew",
  drains: "Request drainage clearance",
  personnel: "Deploy traffic personnel",
  signals: "Recommend signal adjustment",
  diversion: "Activate diversion",
  advisory: "Issue traffic advisory",
  clearance: "Request obstruction clearance",
  emergency: "Request emergency assistance",
  inspection: "Schedule road inspection",
  monitor: "Monitor / reassess",
};
export type ActionKey = keyof typeof ACTIONS;
export type Source = "Historical" | "Forecast" | "Live CCTV";
export type Status = "New" | "Acknowledged" | "Action taken" | "Resolved";
export interface Sensor {
  id: number;
  sensor_id?: string;
  name?: string;
  corridor?: string;
  avg_speed: number;
  v_free?: number;
}
export interface Series {
  sensor_ids: string[];
  series: Record<string, { actual: number[]; predicted: number[] }>;
  unit: string;
  steps: number;
  start_index: number;
}
export interface Insight {
  id: string;
  city: string;
  source: Source;
  severity: "Critical" | "High" | "Moderate";
  location: string;
  corridor: string;
  title: string;
  detail: string;
  period: string;
  created: string;
  status: Status;
  actions: ActionKey[];
  timeline: { at: string; actor: string; text: string; status?: Status }[];
  sensorId?: string;
}
export const severityRank = { Critical: 0, High: 1, Moderate: 2 };
export const mean = (a: number[]) =>
  a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
export const valid = (a: number[]) =>
  a.filter((v) => Number.isFinite(v) && v > 0);
export function sensorName(s: Sensor, i: number) {
  return s.name || `Sensor ${s.sensor_id || i + 1}`;
}
export function deriveInsights(
  city: string,
  sensors: Sensor[],
  data: Series,
): Insight[] {
  const created = new Date().toISOString();
  return sensors.flatMap((s, i) => {
    const sid = s.sensor_id || data.sensor_ids[i];
    const series = data.series[sid];
    if (!series) return [];
    const actual = valid(series.actual);
    if (!actual.length) return [];
    const reference = s.v_free || Math.max(...actual);
    const low = actual.filter((v) => v < reference * 0.4).length;
    const base = {
      city,
      location: sensorName(s, i),
      corridor: s.corridor || "Network",
      created,
      status: "New" as Status,
      timeline: [],
      sensorId: sid,
    };
    const result: Insight[] = [];
    if (low >= 3)
      result.push({
        ...base,
        id: `${city}:history:${sid}:${data.start_index}`,
        source: "Historical",
        severity: low / actual.length > 0.3 ? "High" : "Moderate",
        title: "Recorded congestion hotspot",
        detail: `${low} of ${actual.length} valid samples below 40% of reference speed (${reference.toFixed(1)} ${data.unit}). Lowest recorded speed: ${Math.min(...actual).toFixed(1)} ${data.unit}.`,
        period: `Archived samples ${data.start_index + 1} to ${data.start_index + series.actual.length}`,
        actions: ["signals", "inspection", "personnel", "monitor"],
      });
    const predicted = valid(series.predicted);
    const risk = predicted.filter((v) => v < reference * 0.3).length;
    if (risk >= 3)
      result.push({
        ...base,
        id: `${city}:forecast:${sid}:${data.start_index}`,
        source: "Forecast",
        severity: risk / predicted.length > 0.3 ? "Critical" : "High",
        title: "Forecast congestion risk",
        detail: `${risk} forecast samples below 30% of reference speed. Mean predicted speed: ${mean(predicted).toFixed(1)} ${data.unit}.`,
        period: "Model evaluation window (archived forecast)",
        actions: ["personnel", "signals", "diversion", "advisory"],
      });
    return result;
  });
}
export function csv(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              `"${String(v)
                .replace(/^[=+@\-\t\r]/, "'$&")
                .replace(/"/g, '""')}"`,
          )
          .join(","),
      )
      .join("\r\n")
  );
}
export function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Open-Meteo timestamps are local wall-clock times in the returned timezone.
export function heavyRainIndex(
  hourly: {
    time: string[];
    precipitation: number[];
    precipitation_probability: number[];
  },
  cityNow: string,
): number {
  const cutoff = new Date(Date.parse(cityNow + "Z") + 48 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  return hourly.time.findIndex(
    (t, i) =>
      t >= cityNow &&
      t <= cutoff &&
      (hourly.precipitation[i] >= 7.5 ||
        (hourly.precipitation[i] >= 4 &&
          hourly.precipitation_probability[i] >= 80)),
  );
}

// Older saved records contain only text. Recognise those without migrating or
// deleting the operator's history; new records also carry structured status.
export function recordedActions(insight: Insight) {
  return insight.timeline.filter(
    (entry) =>
      entry.status === "Action taken" ||
      Object.values(ACTIONS).some(
        (label) => entry.text === label || entry.text.startsWith(label + ":"),
      ),
  );
}
export interface InsightFilters {
  tab: string;
  source: string;
  severity: string;
  corridor: string;
  status: string;
  activity: string;
  query: string;
  sort: string;
}
export function filterInsights(insights: Insight[], filters: InsightFilters) {
  const query = filters.query.trim().toLowerCase();
  return insights
    .filter((x) => {
      const hasActions = recordedActions(x).length > 0;
      return (
        (filters.tab !== "Active insights" || x.status !== "Resolved") &&
        (filters.tab !== "History" ||
          x.timeline.length > 0 ||
          x.status === "Resolved") &&
        (filters.source === "All sources" || x.source === filters.source) &&
        (filters.severity === "All severities" ||
          x.severity === filters.severity) &&
        (filters.corridor === "All locations" ||
          x.corridor === filters.corridor) &&
        (filters.status === "All statuses" || x.status === filters.status) &&
        (filters.activity === "Any activity" ||
          (filters.activity === "Has recorded actions"
            ? hasActions
            : !hasActions)) &&
        `${x.location} ${x.title} ${x.sensorId || ""}`
          .toLowerCase()
          .includes(query)
      );
    })
    .sort((a, b) =>
      filters.sort === "Severity"
        ? severityRank[a.severity] - severityRank[b.severity] ||
          a.location.localeCompare(b.location) ||
          a.id.localeCompare(b.id)
        : b.created.localeCompare(a.created) || a.id.localeCompare(b.id),
    );
}

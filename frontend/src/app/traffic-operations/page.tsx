"use client";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { button, control, Severity, Stat } from "@/components/operations-ui";
import { useOperations } from "@/lib/operations-context";
import { useCity } from "@/lib/city-context";
import { useAuth } from "@/lib/auth";
import {
  ACTIONS,
  ActionKey,
  Insight,
  filterInsights,
  recordedActions,
} from "@/lib/operations";
export default function OperationsPage() {
  const { cityConfig } = useCity();
  const { user } = useAuth();
  const {
    insights,
    loading,
    error,
    live,
    weather,
    storageError,
    refresh,
    update,
  } = useOperations();
  const [tab, setTab] = useState("All insights");
  const [source, setSource] = useState("All sources");
  const [severity, setSeverity] = useState("All severities");
  const [corridor, setCorridor] = useState("All locations");
  const [status, setStatus] = useState("All statuses");
  const [activity, setActivity] = useState("Any activity");
  const [sort, setSort] = useState("Severity");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; key: ActionKey } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
    setPending(null);
  }, [
    tab,
    source,
    severity,
    corridor,
    status,
    activity,
    sort,
    query,
    cityConfig.id,
  ]);
  useEffect(() => {
    setCorridor("All locations");
    setNotice("");
    setExpanded(null);
  }, [cityConfig.id]);
  const visible = filterInsights(insights, {
    tab,
    source,
    severity,
    corridor,
    status,
    activity,
    query,
    sort,
  });
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 12)),
  );
  function resetFilters() {
    setSource("All sources");
    setSeverity("All severities");
    setCorridor("All locations");
    setStatus("All statuses");
    setActivity("Any activity");
    setQuery("");
    setSort("Severity");
    setPage(1);
  }
  function record(x: Insight, text: string, next: Insight["status"]) {
    update(x.id, text, next, user?.username || "Operator");
    setNotice(`${text} · ${x.location}`);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardList className="h-6 w-6 text-primary" />
            Traffic Operations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {cityConfig.name} · Forecast insights, camera alerts and operator
            response tracking
          </p>
        </div>
        <button className={button} onClick={refresh} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh sources
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Critical"
          value={
            insights.filter(
              (x) => x.severity === "Critical" && x.status !== "Resolved",
            ).length
          }
          sub="Active priority insights"
        />
        <Stat
          label="High priority"
          value={
            insights.filter(
              (x) => x.severity === "High" && x.status !== "Resolved",
            ).length
          }
        />
        <Stat
          label="Pending review"
          value={insights.filter((x) => x.status === "New").length}
        />
        <Stat
          label="Resolved"
          value={insights.filter((x) => x.status === "Resolved").length}
          sub="Saved in operator history"
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>CCTV: {live}</span>
        <span>Weather: {weather}</span>
        <span>Traffic: archived dataset and model evaluation</span>
      </div>
      {(error || storageError) && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 p-3 text-sm text-red-400"
        >
          {error || storageError}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm"
        >
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {notice}
          </span>
          <button onClick={() => setNotice("")} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex gap-4 border-b border-border">
            {["All insights", "Active insights", "History"].map((t) => (
              <button
                key={t}
                className={`pb-3 text-sm ${tab === t ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  setTab(t);
                  setStatus("All statuses");
                  setActivity("Any activity");
                  setPage(1);
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Search locations or insights"
              className={`${control} min-w-48 flex-1`}
              placeholder="Search location or insight"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {[
              [
                "Source",
                source,
                setSource,
                ["All sources", "Forecast", "Live CCTV", "Historical"],
              ],
              [
                "Severity",
                severity,
                setSeverity,
                ["All severities", "Critical", "High", "Moderate"],
              ],
              [
                "Location",
                corridor,
                setCorridor,
                [
                  "All locations",
                  ...Array.from(
                    new Set(insights.map((x) => x.corridor)),
                  ).sort(),
                ],
              ],
              [
                "Current status",
                status,
                setStatus,
                [
                  "All statuses",
                  "New",
                  "Acknowledged",
                  "Action taken",
                  ...(tab === "Active insights" ? [] : ["Resolved"]),
                ],
              ],
              [
                "Recorded activity",
                activity,
                setActivity,
                ["Any activity", "Has recorded actions", "No recorded actions"],
              ],
              ["Sort", sort, setSort, ["Severity", "Newest"]],
            ].map(([label, value, setter, values]) => (
              <select
                key={label as string}
                aria-label={label as string}
                className={control}
                value={value as string}
                onChange={(e) =>
                  (setter as (v: string) => void)(e.target.value)
                }
              >
                {(values as string[]).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ))}
            <button className={button} onClick={resetFilters}>
              Reset filters
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Current status shows where an insight stands now. Recorded activity
            also finds actions on resolved or reopened insights. Filters apply
            together.
          </p>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {visible.length} insights ·{" "}
          {tab === "History"
            ? "Recorded decisions and resolved events"
            : "Prioritised for operator review"}
        </span>
        <span>Actions saved on this browser</span>
      </div>
      {loading ? (
        <div className="rounded-lg border border-border p-12 text-center text-sm text-muted-foreground">
          Loading traffic insights...
        </div>
      ) : !visible.length ? (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="font-medium">No insights match this view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Adjust or reset the filters, or switch to All insights.
          </p>
        </div>
      ) : (
        visible.slice((currentPage - 1) * 12, currentPage * 12).map((x) => (
          <Card key={x.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Severity value={x.severity} />
                    <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {x.source}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {x.status}
                    </span>
                    {recordedActions(x).length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {recordedActions(x).length} action
                        {recordedActions(x).length === 1 ? "" : "s"} recorded
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base">{x.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {x.location} · {x.corridor}
                  </CardDescription>
                </div>
                <span className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {x.period}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{x.detail}</p>
              {x.status !== "Resolved" && (
                <div className="flex flex-wrap gap-2">
                  {x.actions.map((key) => (
                    <button
                      key={key}
                      className={button}
                      onClick={() => {
                        setPending({ id: x.id, key });
                        setNote("");
                      }}
                    >
                      {ACTIONS[key]}
                    </button>
                  ))}
                </div>
              )}
              {pending?.id === x.id && (
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-medium">{ACTIONS[pending.key]}</p>
                  <label className="block text-xs text-muted-foreground">
                    Operator note (optional)
                    <textarea
                      autoFocus
                      maxLength={500}
                      className={`${control} mt-2 h-20 w-full py-2`}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add instructions or context"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      className={`${button} bg-primary text-primary-foreground hover:opacity-90`}
                      onClick={() => {
                        record(
                          x,
                          `${ACTIONS[pending.key]}${note.trim() ? ": " + note.trim() : ""}`,
                          "Action taken",
                        );
                        setPending(null);
                      }}
                    >
                      Record action
                    </button>
                    <button className={button} onClick={() => setPending(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {x.status === "New" && (
                  <button
                    className={button}
                    onClick={() =>
                      record(x, "Insight acknowledged", "Acknowledged")
                    }
                  >
                    Acknowledge
                  </button>
                )}
                {x.status !== "Resolved" ? (
                  <button
                    className={button}
                    onClick={() => record(x, "Insight resolved", "Resolved")}
                  >
                    Mark resolved
                  </button>
                ) : (
                  <button
                    className={button}
                    onClick={() =>
                      record(x, "Insight reopened", "Acknowledged")
                    }
                  >
                    Reopen
                  </button>
                )}
                <button
                  className={`${button} ml-auto`}
                  onClick={() => setExpanded(expanded === x.id ? null : x.id)}
                >
                  Activity ({x.timeline.length})
                  {expanded === x.id ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
              {expanded === x.id && (
                <div className="space-y-3 border-l border-border pl-4">
                  {!x.timeline.length && (
                    <p className="text-xs text-muted-foreground">
                      No operator activity yet.
                    </p>
                  )}
                  {x.timeline
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <div key={i}>
                        <p className="text-sm">{entry.text}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {entry.actor} · {new Date(entry.at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
      {visible.length > 12 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {currentPage} of {Math.ceil(visible.length / 12)}
          </span>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <button
              className={button}
              disabled={currentPage * 12 >= visible.length}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

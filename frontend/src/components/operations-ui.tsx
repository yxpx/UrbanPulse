import { Insight } from "@/lib/operations";
export const control =
  "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50";
export const button =
  "inline-flex items-center justify-center gap-2 h-9 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
export function Severity({ value }: { value: Insight["severity"] }) {
  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${value === "Critical" ? "border-destructive/30 bg-destructive/10 text-red-400" : value === "High" ? "border-primary/30 bg-primary/10 text-blue-300" : "border-border text-muted-foreground"}`}
    >
      {value}
    </span>
  );
}
export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

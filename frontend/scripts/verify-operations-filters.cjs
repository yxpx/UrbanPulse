// Run from the repository root: node frontend/scripts/verify-operations-filters.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../src/lib/operations.ts"),
  "utf8",
);
const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  context,
);
const { filterInsights, recordedActions, ACTIONS } = context.exports;
const base = {
  city: "mumbai",
  source: "Historical",
  severity: "High",
  location: "WEH junction",
  corridor: "WEH",
  title: "Congestion",
  period: "Archived",
  created: "2026-11-02T10:00:00Z",
  actions: ["monitor"],
  timeline: [],
  status: "New",
};
const action = {
  at: base.created,
  actor: "operator",
  text: ACTIONS.monitor + ": Check again shortly",
};
const resolve = {
  at: base.created,
  actor: "operator",
  text: "Insight resolved",
  status: "Resolved",
};
const items = [
  {
    ...base,
    id: "resolved-action",
    status: "Resolved",
    timeline: [action, resolve],
  },
  {
    ...base,
    id: "active-action",
    status: "Action taken",
    timeline: [{ ...action, status: "Action taken" }],
  },
  {
    ...base,
    id: "resolved-no-action",
    status: "Resolved",
    timeline: [resolve],
  },
  {
    ...base,
    id: "reopened-action",
    status: "Acknowledged",
    timeline: [
      action,
      resolve,
      { ...resolve, text: "Insight reopened", status: "Acknowledged" },
    ],
  },
  { ...base, id: "new", sensorId: "1004" },
];
const defaults = {
  tab: "All insights",
  source: "All sources",
  severity: "All severities",
  corridor: "All locations",
  status: "All statuses",
  activity: "Any activity",
  query: "",
  sort: "Severity",
};
const ids = (overrides) =>
  Array.from(
    filterInsights(items, { ...defaults, ...overrides }),
    (x) => x.id,
  ).sort();
assert.equal(ids({}).length, 5);
assert.deepEqual(ids({ activity: "Has recorded actions" }), [
  "active-action",
  "reopened-action",
  "resolved-action",
]);
assert.deepEqual(
  ids({ status: "Resolved", activity: "Has recorded actions" }),
  ["resolved-action"],
);
assert.deepEqual(ids({ status: "Action taken" }), ["active-action"]);
assert.deepEqual(ids({ status: "Resolved", activity: "No recorded actions" }), [
  "resolved-no-action",
]);
assert.deepEqual(
  ids({ tab: "Active insights", activity: "Has recorded actions" }),
  ["active-action", "reopened-action"],
);
assert.equal(ids({ tab: "History" }).includes("new"), false);
assert.equal(ids({ tab: "History" }).includes("reopened-action"), true);
assert.deepEqual(ids({ query: "  1004  " }), ["new"]);
assert.equal(ids({ source: "Live CCTV" }).length, 0);
assert.equal(ids({ corridor: "EEH" }).length, 0);
assert.equal(ids({ severity: "Critical" }).length, 0);
assert.equal(recordedActions(items[0]).length, 1);
assert.equal(recordedActions(items[2]).length, 0);
assert.equal(items[0].id, "resolved-action"); // Sorting does not mutate stored history.
console.log(
  "Passed 14 filter regressions: resolved actions, reopened actions, legacy history, current status, scope, combined filters, search, and stable records.",
);

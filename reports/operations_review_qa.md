# Traffic Operations and Reports: review notes

## Insight sources

- **Historical:** examines recorded actual speed samples for observed congestion hotspots.
- **Traffic forecast:** examines model-predicted speed samples from the archived evaluation window. These are not newly generated forecasts for today's traffic.
- **Weather forecast:** checks Open-Meteo rainfall forecasts for the next 48 hours. Waterlogging is a rainfall-based risk indication, not a measured water-depth estimate.
- **Live CCTV:** polls the active camera state every five seconds. The feed must belong to the selected city and have been updated within 30 seconds.

## Severity rules

Reference speed uses configured free-flow speed where available, otherwise the maximum positive finite observed speed in the available window. Zero, negative and non-finite samples are excluded. The three qualifying samples do not need to be consecutive.

| Source | Trigger | Severity |
| --- | --- | --- |
| Historical | At least three actual samples below 40% of reference speed | High if more than 30% of valid actual samples qualify; otherwise Moderate |
| Archived traffic forecast | At least three predicted samples below 30% of reference speed | Critical if more than 30% of valid predicted samples qualify; otherwise High |
| CCTV | Congestion score at least 45% | High below 70%; Critical at 70% or above |
| Rain forecast | At least 7.5 mm/hour, or at least 4 mm/hour with precipitation probability at least 80% | Critical at 15 mm/hour or above; otherwise High |

For an 80 km/h reference speed, historical slowdown means below 32 km/h and forecast risk means below 24 km/h. These are prototype prioritisation heuristics, not validated municipal standards or measures of prediction confidence.

The existing CCTV score is an image-based proxy combining vehicle count with average pixel movement:

`round(100 * min(vehicle_count / 15, 1) * (1 - min(avg_pixel_displacement / 40, 1)))`

## Workflow and filters

An insight has one current status: New, Acknowledged, Action taken, or Resolved. Changing that status preserves previous timeline entries.

- **All insights:** includes active and resolved records.
- **Active insights:** excludes resolved records.
- **History:** includes records with operator activity or a resolved status.
- **Current status:** matches the present workflow state only.
- **Recorded activity / Has recorded actions:** finds response actions even after resolution or reopening. Acknowledgement and resolution alone do not count as response actions.
- Combine **Resolved** with **Has recorded actions** to find resolved records on which a response was recorded.
- Filters apply together. Reset filters clears the selections and pagination within the current tab. Changing tabs resets status and activity selections.

Older saved action entries are recognised by their text. New entries also store structured status metadata.

## Review questions

1. **What did this update add?** An operator workflow that turns existing observations and predictions into prioritised insights, records response decisions, and includes activity in configurable reports.
2. **Is another AI model assigning severity?** No. A deterministic rule layer interprets existing model outputs and source observations.
3. **Why these thresholds?** They are transparent initial heuristics. Calibration against labelled incidents and false-alert rates would be needed for deployment.
4. **Why can one location have two cards?** Observed slowdown and model-predicted slowdown are different evidence sources, with separate insight IDs.
5. **Does resolution remove prior actions?** No. It changes the current state and preserves the activity timeline. Recorded-activity filters still find those actions.
6. **How are responses selected?** Each insight category has a predefined set of relevant action IDs, such as pumping and drainage for rain risk or signal review and diversion for congestion.
7. **Are records shared between devices?** No. Insights, operator activity and report configurations are saved in this browser's local storage. Shared persistence would require a backend store.
8. **How are duplicate alerts controlled?** Traffic IDs include city, source, sensor and dataset window. Rain IDs include city and forecast hour. CCTV alerts are grouped by city, linked sensor and UTC day. Refreshing preserves existing workflow history.
9. **What happens when a source is unavailable?** Its status is displayed as inactive, stale or unavailable. Archived traffic analysis remains accessible without inventing live observations.
10. **What does the report period cover?** The selected sample range controls archived traffic statistics and charts. CCTV and action sections include all saved city activity, as stated in the report.
11. **How is report congestion calculated?** By counting valid actual speed samples below 40% of reference speed. Locations are ranked by their congested-sample percentage; network mean speed is weighted by valid sample count.
12. **What is exported?** Selected sections can be exported as CSV or printed through the A4 template to PDF. Saved configurations retain report settings rather than a frozen snapshot.
13. **What are the main limitations?** Archived traffic inputs, browser-local action history, heuristic thresholds, and reliance on external services for weather.
14. **What are the datasets?** METR-LA for Los Angeles and the synthetic Mumbai corridor dataset documented in [Mumbai dataset methodology](mumbai_dataset_methodology.md).

## Verification

Run `node frontend/scripts/verify-operations-filters.cjs` from the repository root for status/activity filtering regressions, including legacy records and reopened insights. Run `npx tsc --noEmit` from `frontend` to check TypeScript without starting a server.

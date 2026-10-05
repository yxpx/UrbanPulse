"""
Mumbai Frontend Data Verification Script (Step 2)
=================================================
Validates the structural integrity, data completeness, and numerical validity
of the 4 generated Mumbai frontend JSON bundles:

  1. frontend/public/mumbai-sensor-locations.json
  2. frontend/public/mumbai-dashboard-data.json
  3. frontend/public/mumbai-heatmap-data.json
  4. frontend/public/mumbai-timeseries-data.json
"""

import os
import sys
import json
import math

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC_DIR = os.path.join(ROOT, "frontend", "public")


def check_no_nans(obj, path="root"):
    """Recursively checks that no NaNs or Infinities exist in JSON structure."""
    if isinstance(obj, float):
        assert not math.isnan(obj), f"NaN found at {path}"
        assert not math.isinf(obj), f"Inf found at {path}"
    elif isinstance(obj, dict):
        for k, v in obj.items():
            check_no_nans(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            check_no_nans(v, f"{path}[{i}]")


def test_sensor_locations():
    path = os.path.join(PUBLIC_DIR, "mumbai-sensor-locations.json")
    print(f"[TEST 1/4] Verifying {os.path.basename(path)}...")
    assert os.path.exists(path), f"Missing file: {path}"

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    check_no_nans(data)
    assert "sensors" in data and "edges" in data, "Missing top-level keys"
    assert len(data["sensors"]) == 50, f"Expected 50 sensors, found {len(data['sensors'])}"
    assert len(data["edges"]) > 50, f"Expected >50 edges, found {len(data['edges'])}"

    for s in data["sensors"]:
        assert "id" in s and "sensor_id" in s and "name" in s and "corridor" in s
        assert "lat" in s and "lng" in s and "avg_speed" in s and "congestion" in s
        assert 18.9 <= s["lat"] <= 19.3, f"Lat {s['lat']} out of Mumbai bounds"
        assert 72.8 <= s["lng"] <= 73.0, f"Lng {s['lng']} out of Mumbai bounds"
        assert 0.0 <= s["congestion"] <= 1.0, f"Invalid congestion {s['congestion']}"
        assert s["avg_speed"] > 0, f"Invalid avg speed {s['avg_speed']}"

    for e in data["edges"]:
        assert len(e) == 2, f"Edge must be a pair: {e}"
        assert 0 <= e[0] < 50 and 0 <= e[1] < 50, f"Edge index out of range: {e}"
        assert e[0] != e[1], f"Self-loop edge found: {e}"

    print(f"    --> PASS: 50 sensors verified within GPS bounds, {len(data['edges'])} network edges valid.")


def test_dashboard_data():
    path = os.path.join(PUBLIC_DIR, "mumbai-dashboard-data.json")
    print(f"[TEST 2/4] Verifying {os.path.basename(path)}...")
    assert os.path.exists(path), f"Missing file: {path}"

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    check_no_nans(data)
    required_keys = [
        "scatter", "timeseries", "error_stats", "error_histogram",
        "feature_importance", "sensor_performance", "n_sensors", "n_features"
    ]
    for k in required_keys:
        assert k in data, f"Missing key: {k}"

    assert len(data["scatter"]) > 0, "Scatter list is empty"
    for pt in data["scatter"][:20]:
        assert "actual" in pt and "predicted" in pt
        assert pt["actual"] > 0 and pt["predicted"] > 0

    stats = data["error_stats"]
    assert "mae" in stats and "rmse" in stats and "r2_score" in stats
    assert stats["unit"] == "km/h", f"Expected unit 'km/h', got {stats['unit']}"
    assert stats["mae"] > 0, f"Invalid MAE: {stats['mae']}"
    assert stats["rmse"] > stats["mae"], "RMSE should be >= MAE"

    assert len(data["feature_importance"]) == 11, "Expected 11 features"
    feat_sum = sum(f["importance"] for f in data["feature_importance"])
    assert abs(feat_sum - 1.0) < 0.01, f"Feature importances should sum to ~1.0, got {feat_sum}"

    perf = data["sensor_performance"]
    assert len(perf["best_5"]) == 5 and len(perf["worst_5"]) == 5
    assert perf["best_5"][0]["mae"] <= perf["worst_5"][-1]["mae"]

    print(f"    --> PASS: Evaluated on {data['n_sensors']} sensors, MAE={stats['mae']:.2f} km/h, RMSE={stats['rmse']:.2f} km/h.")


def test_heatmap_data():
    path = os.path.join(PUBLIC_DIR, "mumbai-heatmap-data.json")
    print(f"[TEST 3/4] Verifying {os.path.basename(path)}...")
    assert os.path.exists(path), f"Missing file: {path}"

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    check_no_nans(data)
    assert len(data["sensor_ids"]) == 50
    assert len(data["hourly_actual"]) == 50
    assert len(data["hourly_predicted"]) == 50
    assert data["unit"] == "km/h"
    assert data["steps_per_hour"] == 12

    for row in data["hourly_actual"]:
        assert len(row) == 24, f"Expected 24 hourly steps per sensor, got {len(row)}"
        for v in row:
            assert v > 0, f"Speed {v} should be positive"

    print(f"    --> PASS: 50 sensors × 24 hour heatmap verified with valid km/h speed profiles.")


def test_timeseries_data():
    path = os.path.join(PUBLIC_DIR, "mumbai-timeseries-data.json")
    print(f"[TEST 4/4] Verifying {os.path.basename(path)}...")
    assert os.path.exists(path), f"Missing file: {path}"

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    check_no_nans(data)
    assert len(data["sensor_ids"]) == 50
    assert len(data["series"]) == 50
    assert data["unit"] == "km/h"
    assert data["steps"] == 200

    for sid, sdata in data["series"].items():
        assert "actual" in sdata and "predicted" in sdata
        assert len(sdata["actual"]) == 200
        assert len(sdata["predicted"]) == 200

    print(f"    --> PASS: 50 sensors × 200 timesteps verified with zero missing values.")


def main():
    print("=" * 60)
    print("Running Step 2 Verification Suite (Mumbai Frontend Bundles)")
    print("=" * 60)

    test_sensor_locations()
    test_dashboard_data()
    test_heatmap_data()
    test_timeseries_data()

    print("=" * 60)
    print("ALL 4 FRONTEND DATA TESTS PASSED WITH ZERO ERRORS!")
    print("=" * 60)


if __name__ == "__main__":
    main()

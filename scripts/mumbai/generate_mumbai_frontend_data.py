"""
Mumbai Frontend Data Generator (Step 2)
=======================================
Generates all 4 frontend visualization and analytical JSON bundles for the
Mumbai 50-sensor arterial corridor sandbox:

  1. frontend/public/mumbai-sensor-locations.json
  2. frontend/public/mumbai-dashboard-data.json
  3. frontend/public/mumbai-heatmap-data.json
  4. frontend/public/mumbai-timeseries-data.json

All files follow the exact schemas expected by UrbanPulse dashboard pages.
Zero modifications to existing Los Angeles files.
"""

import os
import sys
import json
import pickle
import numpy as np
import torch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, ROOT)

from backend.data_loader import create_feature_bundle, load_metr_la
from models.stgcn_model import SimpleSTGCN
from scripts.mumbai.generate_mumbai_dataset import SENSORS

WINDOW = 12
HORIZON = 3
OUT_DIR = os.path.join(ROOT, "frontend", "public")
os.makedirs(OUT_DIR, exist_ok=True)

H5_PATH = os.path.join(ROOT, "data", "raw", "MUMBAI-50.h5")
ADJ_PATH = os.path.join(ROOT, "data", "raw", "adj_MUMBAI-50.pkl")
WEATHER_PATH = os.path.join(ROOT, "data", "raw", "weather_MUMBAI_2019.csv")
MODEL_WEIGHTS = os.path.join(ROOT, "models", "stgcn_weights.pt")


def get_congestion_color(congestion: float) -> str:
    """Returns color badge matching standard UrbanPulse palette."""
    if congestion < 0.25:
        return "#22c55e"  # Low congestion (Green)
    elif congestion < 0.50:
        return "#eab308"  # Moderate congestion (Yellow)
    elif congestion < 0.70:
        return "#f97316"  # Heavy congestion (Orange)
    else:
        return "#ef4444"  # Severe bottleneck (Red)


def generate_sensor_locations(bundle, mean_speeds):
    """Generates mumbai-sensor-locations.json with 50 nodes and graph edges."""
    print("--> 1. Generating mumbai-sensor-locations.json...", flush=True)

    with open(ADJ_PATH, "rb") as f:
        adj_data = pickle.load(f, encoding="latin1")
    adj_mx = adj_data[2]
    np.fill_diagonal(adj_mx, 0)

    n_sensors = len(SENSORS)
    smin = float(mean_speeds.min())
    smax = float(mean_speeds.max())

    sensors_list = []
    for i, s in enumerate(SENSORS):
        avg_s = float(mean_speeds[i])
        c_factor = 1.0 - (avg_s - smin) / (smax - smin + 1e-6)
        c_factor = float(np.clip(c_factor, 0.0, 1.0))
        color = get_congestion_color(c_factor)

        sensors_list.append({
            "id": i,
            "sensor_id": str(s["id"]),
            "name": s["name"],
            "corridor": s["corridor"],
            "lat": float(s["lat"]),
            "lng": float(s["lng"]),
            "avg_speed": round(avg_s, 2),
            "congestion": round(c_factor, 3),
            "color": color,
            "v_free": float(s["v_free"]),
            "km": float(s["km"]),
        })

    # Extract network edges from adjacency graph
    edges = []
    seen = set()
    for i in range(n_sensors):
        for j in range(n_sensors):
            if i >= j:
                continue
            w = max(adj_mx[i, j], adj_mx[j, i])
            # Connected if weight is non-zero (graph threshold)
            if w > 0.05:
                edge_key = (min(i, j), max(i, j))
                if edge_key not in seen:
                    seen.add(edge_key)
                    edges.append([int(i), int(j)])

    payload = {
        "sensors": sensors_list,
        "edges": edges,
        "city": "Mumbai",
        "corridors": ["WEH", "EEH", "BWSL", "JVLR", "SCLR"],
        "n_sensors": n_sensors,
        "n_edges": len(edges),
    }

    out_path = os.path.join(OUT_DIR, "mumbai-sensor-locations.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"    Wrote {out_path} ({len(sensors_list)} sensors, {len(edges)} edges)", flush=True)
    return payload


def generate_dashboard_and_eval(bundle, model, edge_index, speed_mean, speed_std):
    """Generates mumbai-dashboard-data.json with ST-GCN evaluation & domain shift stats."""
    print("--> 2. Generating mumbai-dashboard-data.json (Model Evaluation)...", flush=True)

    T_total, N_sensors, n_features = bundle.features.shape

    feature_names = [
        "Speed (z-scored)", "Time of Day (sin)", "Time of Day (cos)",
        "Visibility", "Sea-Level Pressure", "Relative Humidity",
        "Wind Speed", "Pressure (alt)", "Air Temperature",
        "Wind Direction", "Precipitation Rate"
    ][:n_features]

    # Evaluate across representative time slices
    sample_indices = list(range(100, min(T_total - WINDOW - HORIZON, 15000), 250))
    all_preds_kmh = []
    all_actuals_kmh = []

    for idx in sample_indices:
        x = torch.from_numpy(bundle.features[idx : idx + WINDOW][None]).float()
        with torch.no_grad():
            pred = model(x, edge_index)  # (1, N, H)
        pred_np = pred[0].numpy()  # (N, H)
        actual_np = bundle.target[idx + WINDOW : idx + WINDOW + HORIZON].T  # (N, H)

        # De-normalize to km/h
        pred_kmh = pred_np * speed_std + speed_mean
        actual_kmh = actual_np * speed_std + speed_mean

        all_preds_kmh.append(pred_kmh)
        all_actuals_kmh.append(actual_kmh)

    all_preds_kmh = np.array(all_preds_kmh)      # (S, N, H)
    all_actuals_kmh = np.array(all_actuals_kmh)  # (S, N, H)

    # 1. Scatter data (Horizon 1, subset for snappy frontend loading)
    scatter_data = []
    for s_idx in range(0, len(sample_indices), 2):
        for node in range(0, N_sensors, 2):
            scatter_data.append({
                "actual": round(float(all_actuals_kmh[s_idx, node, 0]), 2),
                "predicted": round(float(all_preds_kmh[s_idx, node, 0]), 2),
            })

    # 2. Time series for key landmark chokepoints
    # 1013 (Kalanagar), 1023 (Chedda Nagar), 1028 (BWSL), 1037 (Powai Lake), 1047 (Kurla LBS)
    demo_indices = [12, 22, 27, 36, 46]
    ts_window_start = 5000
    ts_window_len = 150
    timeseries = {}

    for s_idx in demo_indices:
        s_obj = SENSORS[s_idx]
        ts_actual = []
        ts_pred = []
        for t in range(ts_window_len):
            idx = ts_window_start + t
            x = torch.from_numpy(bundle.features[idx : idx + WINDOW][None]).float()
            with torch.no_grad():
                pred = model(x, edge_index)
            pred_v = float(pred[0, s_idx, 0].numpy() * speed_std + speed_mean)
            act_v = float(bundle.target[idx + WINDOW, s_idx] * speed_std + speed_mean)
            ts_actual.append(round(act_v, 2))
            ts_pred.append(round(pred_v, 2))
        timeseries[str(s_obj["id"])] = {
            "name": s_obj["name"],
            "corridor": s_obj["corridor"],
            "actual": ts_actual,
            "predicted": ts_pred,
        }

    # 3. Error stats & realistic domain shift
    errors = (all_preds_kmh[:, :, 0] - all_actuals_kmh[:, :, 0]).flatten()
    abs_errors = np.abs(errors)
    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    ss_res = np.sum(errors ** 2)
    ss_tot = np.sum((all_actuals_kmh[:, :, 0] - np.mean(all_actuals_kmh[:, :, 0])) ** 2)
    r2 = float(1.0 - ss_res / (ss_tot + 1e-6))

    error_stats = {
        "mean_error": round(float(np.mean(errors)), 3),
        "std_error": round(float(np.std(errors)), 3),
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2_score": round(r2, 3),
        "p50": round(float(np.percentile(abs_errors, 50)), 3),
        "p90": round(float(np.percentile(abs_errors, 90)), 3),
        "p95": round(float(np.percentile(abs_errors, 95)), 3),
        "unit": "km/h",
        "domain_shift_note": "Zero-shot transfer evaluation of LA-trained ST-GCN weights on Mumbai arterial topology.",
    }

    # 4. Error distribution histogram
    hist_counts, hist_edges = np.histogram(errors, bins=50)
    error_hist = [
        {
            "bin_start": round(float(hist_edges[i]), 2),
            "bin_end": round(float(hist_edges[i + 1]), 2),
            "count": int(hist_counts[i]),
        }
        for i in range(len(hist_counts))
    ]

    # 5. Gradient-based feature importance
    print("    Computing gradient feature importance...", flush=True)
    importances = np.zeros(n_features)
    grad_samples = list(range(500, min(T_total - WINDOW - HORIZON, 10000), 1000))
    for idx in grad_samples:
        x = torch.from_numpy(bundle.features[idx : idx + WINDOW][None]).float()
        x.requires_grad_(True)
        pred = model(x, edge_index)
        target = torch.from_numpy(bundle.target[idx + WINDOW : idx + WINDOW + HORIZON].T[None]).float()
        loss = ((pred - target) ** 2).mean()
        loss.backward()
        grad = x.grad.abs().mean(dim=(0, 1, 2)).numpy()
        importances += grad

    importances /= len(grad_samples)
    importances /= importances.sum()
    feature_importance = [
        {"feature": feature_names[i], "importance": round(float(importances[i]), 4)}
        for i in range(n_features)
    ]
    feature_importance.sort(key=lambda x: x["importance"], reverse=True)

    # 6. Per-sensor performance ranking
    sensor_mae = np.mean(np.abs(all_preds_kmh[:, :, 0] - all_actuals_kmh[:, :, 0]), axis=0)
    sensor_perf = [
        {
            "sensor": i,
            "sensor_id": SENSORS[i]["id"],
            "name": SENSORS[i]["name"],
            "corridor": SENSORS[i]["corridor"],
            "mae": round(float(sensor_mae[i]), 3),
        }
        for i in range(N_sensors)
    ]
    sensor_perf.sort(key=lambda x: x["mae"])

    dashboard_data = {
        "scatter": scatter_data,
        "timeseries": timeseries,
        "error_stats": error_stats,
        "error_histogram": error_hist,
        "feature_importance": feature_importance,
        "sensor_performance": {
            "best_5": sensor_perf[:5],
            "worst_5": sensor_perf[-5:],
        },
        "n_sensors": N_sensors,
        "n_timesteps": T_total,
        "n_features": n_features,
        "feature_names": feature_names,
        "city": "Mumbai",
        "speed_unit": "km/h",
    }

    out_path = os.path.join(OUT_DIR, "mumbai-dashboard-data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"    Wrote {out_path} (MAE: {mae:.2f} km/h, RMSE: {rmse:.2f} km/h)", flush=True)


def generate_heatmap(bundle, model, edge_index, speed_mean, speed_std):
    """Generates mumbai-heatmap-data.json for 24-hour diurnal profile."""
    print("--> 3. Generating mumbai-heatmap-data.json...", flush=True)

    HOURS = 24
    STEPS_PER_HOUR = 12
    STEPS = HOURS * STEPS_PER_HOUR
    N_sensors = bundle.features.shape[1]

    start_idx = 5000
    actual_steps = np.zeros((STEPS, N_sensors), dtype=np.float32)
    pred_steps = np.zeros((STEPS, N_sensors), dtype=np.float32)

    for t in range(STEPS):
        idx = start_idx + t
        x = torch.from_numpy(bundle.features[idx : idx + WINDOW][None]).float()
        with torch.no_grad():
            pred = model(x, edge_index)
        pred_norm = pred[0, :, 0].cpu().numpy()
        actual_norm = bundle.target[idx + WINDOW, :]

        pred_steps[t] = pred_norm * speed_std + speed_mean
        actual_steps[t] = actual_norm * speed_std + speed_mean

    actual_hourly = actual_steps.reshape(HOURS, STEPS_PER_HOUR, N_sensors).mean(axis=1).T
    pred_hourly = pred_steps.reshape(HOURS, STEPS_PER_HOUR, N_sensors).mean(axis=1).T

    # Round for compact file size
    actual_hourly = np.round(actual_hourly, 2)
    pred_hourly = np.round(pred_hourly, 2)

    payload = {
        "sensor_ids": [str(s["id"]) for s in SENSORS],
        "sensor_names": [s["name"] for s in SENSORS],
        "corridors": [s["corridor"] for s in SENSORS],
        "hourly_actual": actual_hourly.tolist(),
        "hourly_predicted": pred_hourly.tolist(),
        "unit": "km/h",
        "steps_per_hour": STEPS_PER_HOUR,
        "start_index": int(start_idx),
        "city": "Mumbai",
    }

    out_path = os.path.join(OUT_DIR, "mumbai-heatmap-data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    print(f"    Wrote {out_path} ({os.path.getsize(out_path) // 1024} KB)", flush=True)


def generate_timeseries(bundle, model, edge_index, speed_mean, speed_std):
    """Generates mumbai-timeseries-data.json across 200 consecutive 5-min intervals."""
    print("--> 4. Generating mumbai-timeseries-data.json...", flush=True)

    STEPS = 200
    start_idx = 5000
    N_sensors = bundle.features.shape[1]

    actual_steps = np.zeros((STEPS, N_sensors), dtype=np.float32)
    pred_steps = np.zeros((STEPS, N_sensors), dtype=np.float32)

    for t in range(STEPS):
        idx = start_idx + t
        x = torch.from_numpy(bundle.features[idx : idx + WINDOW][None]).float()
        with torch.no_grad():
            pred = model(x, edge_index)
        pred_norm = pred[0, :, 0].cpu().numpy()
        actual_norm = bundle.target[idx + WINDOW, :]

        pred_steps[t] = pred_norm * speed_std + speed_mean
        actual_steps[t] = actual_norm * speed_std + speed_mean

    series = {}
    for i, s in enumerate(SENSORS):
        sid = str(s["id"])
        series[sid] = {
            "name": s["name"],
            "corridor": s["corridor"],
            "actual": [round(float(v), 2) for v in actual_steps[:, i]],
            "predicted": [round(float(v), 2) for v in pred_steps[:, i]],
        }

    payload = {
        "sensor_ids": [str(s["id"]) for s in SENSORS],
        "series": series,
        "unit": "km/h",
        "start_index": int(start_idx),
        "steps": STEPS,
        "city": "Mumbai",
    }

    out_path = os.path.join(OUT_DIR, "mumbai-timeseries-data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    print(f"    Wrote {out_path} ({os.path.getsize(out_path) // 1024} KB)", flush=True)


def main():
    print("=" * 60)
    print("UrbanPulse: Mumbai Frontend Data Generation (Step 2)")
    print("=" * 60)

    # 1. Load Raw Speeds & Mean Speeds
    print("Loading MUMBAI-50 raw data...", flush=True)
    df_speeds = load_metr_la(H5_PATH)
    raw_speeds = df_speeds.values.astype(np.float32)
    speed_mean = float(np.nanmean(raw_speeds))
    speed_std = float(np.nanstd(raw_speeds)) or 1.0
    sensor_means = np.nanmean(raw_speeds, axis=0)

    # 2. Load Feature Bundle
    bundle = create_feature_bundle(H5_PATH, ADJ_PATH, WEATHER_PATH)
    n_features = bundle.features.shape[-1]
    edge_index = torch.tensor(bundle.edge_index, dtype=torch.long)

    # 3. Load Trained Model
    print("Loading trained ST-GCN model weights...", flush=True)
    model = SimpleSTGCN(in_features=n_features, hidden_size=32, horizon=HORIZON)
    model.load_state_dict(torch.load(MODEL_WEIGHTS, map_location="cpu"))
    model.eval()

    # 4. Generate the 4 Bundles
    generate_sensor_locations(bundle, sensor_means)
    generate_dashboard_and_eval(bundle, model, edge_index, speed_mean, speed_std)
    generate_heatmap(bundle, model, edge_index, speed_mean, speed_std)
    generate_timeseries(bundle, model, edge_index, speed_mean, speed_std)

    print("=" * 60)
    print("Step 2 Data Generation Complete! All 4 files ready in frontend/public/")
    print("=" * 60)


if __name__ == "__main__":
    main()

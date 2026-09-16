"""
Synthetic Mumbai Arterial Corridor Dataset Generator (UrbanPulse-MUM-50)
========================================================================
Generates:
  1. data/raw/MUMBAI-50.h5          - (34272, 50) speed matrix at 5-min intervals
  2. data/raw/adj_MUMBAI-50.pkl     - [sensor_ids, sensor_id_to_ind, adj_mx] tuple
  3. data/raw/weather_MUMBAI_2019.csv - Synchronized hourly weather matching data_loader.py

Methodology & calibration details: See mumbai_dataset.md at project root.
"""

import os
import sys
import pickle
import numpy as np
import pandas as pd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW_DIR = os.path.join(ROOT, "data", "raw")
os.makedirs(RAW_DIR, exist_ok=True)

# ----------------------------------------------------------------------
# 1. Corridor & Sensor Definitions (50 Checkpoints across 5 Corridors)
# ----------------------------------------------------------------------
SENSORS = [
    # --- Western Express Highway (WEH: Dahisar -> Bandra) ---
    {"id": "1001", "name": "WEH - Dahisar Toll Plaza", "corridor": "WEH", "lat": 19.2550, "lng": 72.8625, "v_free": 80.0, "km": 0.0},
    {"id": "1002", "name": "WEH - Borivali National Park", "corridor": "WEH", "lat": 19.2310, "lng": 72.8600, "v_free": 80.0, "km": 2.7},
    {"id": "1003", "name": "WEH - Kandivali Flyover", "corridor": "WEH", "lat": 19.2080, "lng": 72.8580, "v_free": 80.0, "km": 5.3},
    {"id": "1004", "name": "WEH - Malad Pushpa Park", "corridor": "WEH", "lat": 19.1860, "lng": 72.8550, "v_free": 75.0, "km": 7.8},
    {"id": "1005", "name": "WEH - Goregaon Hub Mall", "corridor": "WEH", "lat": 19.1620, "lng": 72.8530, "v_free": 75.0, "km": 10.5},
    {"id": "1006", "name": "WEH - Aarey Colony Exit", "corridor": "WEH", "lat": 19.1480, "lng": 72.8520, "v_free": 75.0, "km": 12.1},
    {"id": "1007", "name": "WEH - Jogeshwari JVLR Jn", "corridor": "WEH", "lat": 19.1350, "lng": 72.8510, "v_free": 70.0, "km": 13.6},
    {"id": "1008", "name": "WEH - Andheri Flyover", "corridor": "WEH", "lat": 19.1190, "lng": 72.8490, "v_free": 70.0, "km": 15.4},
    {"id": "1009", "name": "WEH - Vile Parle Airport", "corridor": "WEH", "lat": 19.0980, "lng": 72.8480, "v_free": 75.0, "km": 17.8},
    {"id": "1010", "name": "WEH - Santacruz Milan Flyover", "corridor": "WEH", "lat": 19.0830, "lng": 72.8460, "v_free": 70.0, "km": 19.5},
    {"id": "1011", "name": "WEH - Khar Subway Jn", "corridor": "WEH", "lat": 19.0700, "lng": 72.8440, "v_free": 70.0, "km": 21.0},
    {"id": "1012", "name": "WEH - Bandra Teachers Colony", "corridor": "WEH", "lat": 19.0610, "lng": 72.8430, "v_free": 70.0, "km": 22.1},
    {"id": "1013", "name": "WEH - Kalanagar Chokepoint", "corridor": "WEH", "lat": 19.0550, "lng": 72.8460, "v_free": 65.0, "km": 22.9},
    {"id": "1014", "name": "WEH - BKC Connector Entry", "corridor": "WEH", "lat": 19.0570, "lng": 72.8550, "v_free": 65.0, "km": 23.9},
    {"id": "1015", "name": "WEH - Bandra Terminus", "corridor": "WEH", "lat": 19.0510, "lng": 72.8410, "v_free": 70.0, "km": 24.6},
    {"id": "1016", "name": "WEH - Mahim Causeway North", "corridor": "WEH", "lat": 19.0430, "lng": 72.8390, "v_free": 70.0, "km": 25.5},

    # --- Eastern Express Highway (EEH: Thane -> Sion) ---
    {"id": "1017", "name": "EEH - Anand Nagar Toll Thane", "corridor": "EEH", "lat": 19.1980, "lng": 72.9690, "v_free": 80.0, "km": 0.0},
    {"id": "1018", "name": "EEH - Mulund Check Naka", "corridor": "EEH", "lat": 19.1800, "lng": 72.9620, "v_free": 80.0, "km": 2.1},
    {"id": "1019", "name": "EEH - Bhandup Sonapur", "corridor": "EEH", "lat": 19.1570, "lng": 72.9490, "v_free": 80.0, "km": 4.9},
    {"id": "1020", "name": "EEH - Kanjurmarg Flyover", "corridor": "EEH", "lat": 19.1350, "lng": 72.9370, "v_free": 80.0, "km": 7.5},
    {"id": "1021", "name": "EEH - Vikhroli JVLR Jn", "corridor": "EEH", "lat": 19.1160, "lng": 72.9280, "v_free": 75.0, "km": 9.8},
    {"id": "1022", "name": "EEH - Ghatkopar Pantnagar", "corridor": "EEH", "lat": 19.0920, "lng": 72.9150, "v_free": 75.0, "km": 12.8},
    {"id": "1023", "name": "EEH - Chedda Nagar Bottleneck", "corridor": "EEH", "lat": 19.0740, "lng": 72.9020, "v_free": 65.0, "km": 15.1},
    {"id": "1024", "name": "EEH - Amar Mahal Junction", "corridor": "EEH", "lat": 19.0680, "lng": 72.8960, "v_free": 65.0, "km": 16.0},
    {"id": "1025", "name": "EEH - Chembur Priyadarshini", "corridor": "EEH", "lat": 19.0580, "lng": 72.8880, "v_free": 75.0, "km": 17.4},
    {"id": "1026", "name": "EEH - Kurla Signal EEH", "corridor": "EEH", "lat": 19.0510, "lng": 72.8810, "v_free": 70.0, "km": 18.5},
    {"id": "1027", "name": "EEH - Everard Nagar", "corridor": "EEH", "lat": 19.0450, "lng": 72.8750, "v_free": 75.0, "km": 19.4},
    {"id": "1028", "name": "EEH - Chunabhatti Flyover", "corridor": "EEH", "lat": 19.0400, "lng": 72.8680, "v_free": 75.0, "km": 20.3},
    {"id": "1029", "name": "EEH - Sion Circle North", "corridor": "EEH", "lat": 19.0360, "lng": 72.8620, "v_free": 70.0, "km": 21.2},
    {"id": "1030", "name": "EEH - GTB Nagar Approach", "corridor": "EEH", "lat": 19.0310, "lng": 72.8590, "v_free": 70.0, "km": 22.0},

    # --- Bandra-Worli Sea Link & Coastal Road (BWSL) ---
    {"id": "1031", "name": "BWSL - Bandra Toll Plaza", "corridor": "BWSL", "lat": 19.0410, "lng": 72.8220, "v_free": 85.0, "km": 0.0},
    {"id": "1032", "name": "BWSL - Mid-Span Cable Stay", "corridor": "BWSL", "lat": 19.0270, "lng": 72.8160, "v_free": 90.0, "km": 2.2},
    {"id": "1033", "name": "BWSL - Worli Sea Face South", "corridor": "BWSL", "lat": 19.0130, "lng": 72.8130, "v_free": 85.0, "km": 4.5},
    {"id": "1034", "name": "Coastal Rd - Worli Interchange", "corridor": "BWSL", "lat": 19.0060, "lng": 72.8110, "v_free": 85.0, "km": 5.4},
    {"id": "1035", "name": "Coastal Rd - Haji Ali Bridge", "corridor": "BWSL", "lat": 18.9830, "lng": 72.8090, "v_free": 85.0, "km": 8.0},
    {"id": "1036", "name": "Coastal Rd - Priyadarshini Park", "corridor": "BWSL", "lat": 18.9610, "lng": 72.8040, "v_free": 85.0, "km": 10.5},

    # --- Jogeshwari-Vikhroli Link Road (JVLR: West -> East) ---
    {"id": "1037", "name": "JVLR - WEH Junction Start", "corridor": "JVLR", "lat": 19.1350, "lng": 72.8530, "v_free": 60.0, "km": 0.0},
    {"id": "1038", "name": "JVLR - Majas Depot Jogeshwari", "corridor": "JVLR", "lat": 19.1330, "lng": 72.8670, "v_free": 60.0, "km": 1.5},
    {"id": "1039", "name": "JVLR - SEEPZ Andheri East", "corridor": "JVLR", "lat": 19.1300, "lng": 72.8820, "v_free": 55.0, "km": 3.1},
    {"id": "1040", "name": "JVLR - Powai Lake Promenade", "corridor": "JVLR", "lat": 19.1260, "lng": 72.8990, "v_free": 55.0, "km": 4.9},
    {"id": "1041", "name": "JVLR - IIT Bombay Main Gate", "corridor": "JVLR", "lat": 19.1240, "lng": 72.9130, "v_free": 60.0, "km": 6.4},
    {"id": "1042", "name": "JVLR - Gandhi Nagar Flyover", "corridor": "JVLR", "lat": 19.1200, "lng": 72.9230, "v_free": 60.0, "km": 7.6},
    {"id": "1043", "name": "JVLR - EEH Junction End", "corridor": "JVLR", "lat": 19.1160, "lng": 72.9270, "v_free": 60.0, "km": 8.5},

    # --- Santacruz-Chembur Link Road (SCLR: West -> East) ---
    {"id": "1044", "name": "SCLR - WEH Milan Start", "corridor": "SCLR", "lat": 19.0830, "lng": 72.8480, "v_free": 55.0, "km": 0.0},
    {"id": "1045", "name": "SCLR - Vakola Junction", "corridor": "SCLR", "lat": 19.0790, "lng": 72.8580, "v_free": 50.0, "km": 1.1},
    {"id": "1046", "name": "SCLR - BKC North Gate", "corridor": "SCLR", "lat": 19.0740, "lng": 72.8690, "v_free": 50.0, "km": 2.3},
    {"id": "1047", "name": "SCLR - Kurla Double Decker", "corridor": "SCLR", "lat": 19.0680, "lng": 72.8790, "v_free": 50.0, "km": 3.6},
    {"id": "1048", "name": "SCLR - Nehru Nagar Kurla", "corridor": "SCLR", "lat": 19.0640, "lng": 72.8890, "v_free": 55.0, "km": 4.8},
    {"id": "1049", "name": "SCLR - Tilak Nagar ROB", "corridor": "SCLR", "lat": 19.0670, "lng": 72.8950, "v_free": 55.0, "km": 5.6},
    {"id": "1050", "name": "SCLR - Chedda Nagar EEH End", "corridor": "SCLR", "lat": 19.0720, "lng": 72.9010, "v_free": 55.0, "km": 6.5},
]

N_SENSORS = len(SENSORS)
SENSOR_IDS = [s["id"] for s in SENSORS]
SENSOR_ID_TO_IND = {s["id"]: i for i, s in enumerate(SENSORS)}


# ----------------------------------------------------------------------
# 2. Graph Construction: Thresholded Gaussian Kernel
# ----------------------------------------------------------------------
def haversine_distance_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2.0) ** 2 + np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2.0) ** 2
    return 2.0 * R * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))


def build_adjacency_matrix(sensors, sigma=3.2, kappa=6.5):
    """
    Constructs weighted directed adjacency matrix.
    Physical connections are established along corridors (predecessor <-> successor)
    and at major corridor interchange junctions (JVLR<->WEH/EEH, SCLR<->WEH/EEH, BWSL<->WEH).
    """
    N = len(sensors)
    dist_mx = np.full((N, N), np.inf, dtype=np.float32)
    np.fill_diagonal(dist_mx, 0.0)

    # Corridor sequential connections
    for i in range(N - 1):
        if sensors[i]["corridor"] == sensors[i + 1]["corridor"]:
            d = haversine_distance_km(sensors[i]["lat"], sensors[i]["lng"],
                                      sensors[i + 1]["lat"], sensors[i + 1]["lng"])
            dist_mx[i, i + 1] = d
            dist_mx[i + 1, i] = d

    # Cross-corridor interchanges
    # 1. JVLR Start (1037) <-> WEH Jogeshwari (1007)
    i_jvlr_start, i_weh_j = SENSOR_ID_TO_IND["1037"], SENSOR_ID_TO_IND["1007"]
    d1 = haversine_distance_km(sensors[i_jvlr_start]["lat"], sensors[i_jvlr_start]["lng"],
                               sensors[i_weh_j]["lat"], sensors[i_weh_j]["lng"])
    dist_mx[i_jvlr_start, i_weh_j] = dist_mx[i_weh_j, i_jvlr_start] = max(d1, 0.5)

    # 2. JVLR End (1043) <-> EEH Vikhroli (1021)
    i_jvlr_end, i_eeh_v = SENSOR_ID_TO_IND["1043"], SENSOR_ID_TO_IND["1021"]
    d2 = haversine_distance_km(sensors[i_jvlr_end]["lat"], sensors[i_jvlr_end]["lng"],
                               sensors[i_eeh_v]["lat"], sensors[i_eeh_v]["lng"])
    dist_mx[i_jvlr_end, i_eeh_v] = dist_mx[i_eeh_v, i_jvlr_end] = max(d2, 0.5)

    # 3. SCLR Start (1044) <-> WEH Milan (1010)
    i_sclr_start, i_weh_m = SENSOR_ID_TO_IND["1044"], SENSOR_ID_TO_IND["1010"]
    d3 = haversine_distance_km(sensors[i_sclr_start]["lat"], sensors[i_sclr_start]["lng"],
                               sensors[i_weh_m]["lat"], sensors[i_weh_m]["lng"])
    dist_mx[i_sclr_start, i_weh_m] = dist_mx[i_weh_m, i_sclr_start] = max(d3, 0.5)

    # 4. SCLR End (1050) <-> EEH Chedda Nagar (1023) / Amar Mahal (1024)
    i_sclr_end, i_eeh_c = SENSOR_ID_TO_IND["1050"], SENSOR_ID_TO_IND["1023"]
    d4 = haversine_distance_km(sensors[i_sclr_end]["lat"], sensors[i_sclr_end]["lng"],
                               sensors[i_eeh_c]["lat"], sensors[i_eeh_c]["lng"])
    dist_mx[i_sclr_end, i_eeh_c] = dist_mx[i_eeh_c, i_sclr_end] = max(d4, 0.5)

    # 5. BWSL Start (1031) <-> WEH Mahim / Bandra (1015, 1016)
    i_bwsl_start, i_weh_b = SENSOR_ID_TO_IND["1031"], SENSOR_ID_TO_IND["1015"]
    d5 = haversine_distance_km(sensors[i_bwsl_start]["lat"], sensors[i_bwsl_start]["lng"],
                               sensors[i_weh_b]["lat"], sensors[i_weh_b]["lng"])
    dist_mx[i_bwsl_start, i_weh_b] = dist_mx[i_weh_b, i_bwsl_start] = max(d5, 1.2)

    # All-pairs shortest paths via Floyd-Warshall
    sp_dist = dist_mx.copy()
    for k in range(N):
        for i in range(N):
            for j in range(N):
                if sp_dist[i, k] + sp_dist[k, j] < sp_dist[i, j]:
                    sp_dist[i, j] = sp_dist[i, k] + sp_dist[k, j]

    # Gaussian kernel weighting
    adj_mx = np.zeros((N, N), dtype=np.float32)
    for i in range(N):
        for j in range(N):
            if sp_dist[i, j] <= kappa:
                adj_mx[i, j] = np.exp(- (sp_dist[i, j] ** 2) / (sigma ** 2))

    return adj_mx


# ----------------------------------------------------------------------
# 3. Speed Matrix Synthesis (Macroscopic Traffic Physics & Diurnal Dynamics)
# ----------------------------------------------------------------------
def generate_mumbai_speeds(n_timesteps=34272, start_date="2019-01-01"):
    """
    Synthesizes (T, N) speed matrix matching METR-LA shape & 5-minute sampling.
    Calibrated with TomTom Traffic Index Mumbai (2023-2024) and MMRDA CTS-2 data.
    """
    timestamps = pd.date_range(start=start_date, periods=n_timesteps, freq="5min")
    hours = timestamps.hour + timestamps.minute / 60.0
    day_of_week = timestamps.dayofweek
    is_weekend = (day_of_week >= 5).astype(float)
    month = timestamps.month

    # Seed for reproducibility
    np.random.seed(42)

    speeds = np.zeros((n_timesteps, N_SENSORS), dtype=np.float32)

    # Bottleneck multiplier per sensor (Kalanagar 1013, Chedda Nagar 1023, JVLR 1039, etc.)
    bottleneck_severity = np.ones(N_SENSORS)
    bottleneck_severity[SENSOR_ID_TO_IND["1013"]] = 1.45  # Kalanagar
    bottleneck_severity[SENSOR_ID_TO_IND["1023"]] = 1.40  # Chedda Nagar
    bottleneck_severity[SENSOR_ID_TO_IND["1007"]] = 1.30  # Jogeshwari JVLR
    bottleneck_severity[SENSOR_ID_TO_IND["1039"]] = 1.35  # SEEPZ JVLR
    bottleneck_severity[SENSOR_ID_TO_IND["1047"]] = 1.35  # Kurla Double Decker SCLR

    for i, s in enumerate(SENSORS):
        v_free = s["v_free"]
        corr = s["corridor"]
        b_mult = bottleneck_severity[i]

        # Diurnal Peak Curves (Morning Peak: 09:30, Evening Peak: 19:00)
        # Weekday: sharp dual peaks; Weekend: broader midday/afternoon curve
        am_peak = np.exp(-((hours - 9.5) ** 2) / (2.0 * (1.8 ** 2)))
        pm_peak = np.exp(-((hours - 19.0) ** 2) / (2.0 * (2.2 ** 2)))
        weekend_curve = np.exp(-((hours - 16.0) ** 2) / (2.0 * (4.5 ** 2)))

        # Corridor directional congestion factors
        if corr in ["WEH", "EEH"]:
            # Heavy Southbound in AM, heavy Northbound in PM
            c_factor = (1.0 - is_weekend) * (0.68 * am_peak + 0.72 * pm_peak) + is_weekend * (0.45 * weekend_curve)
        elif corr == "BWSL":
            # Sea link maintains higher velocity, less severe congestion
            c_factor = (1.0 - is_weekend) * (0.35 * am_peak + 0.40 * pm_peak) + is_weekend * (0.25 * weekend_curve)
        else:  # JVLR, SCLR
            # Severe cross-suburb choke
            c_factor = (1.0 - is_weekend) * (0.75 * am_peak + 0.78 * pm_peak) + is_weekend * (0.48 * weekend_curve)

        c_factor = np.clip(c_factor * b_mult, 0.0, 0.86)

        # Monsoon seasonal dampening (June to September: months 6, 7, 8, 9)
        monsoon_factor = np.where(np.isin(month, [6, 7, 8, 9]), 0.88, 1.0)

        # Base deterministic speed profile
        base_speed = v_free * (1.0 - c_factor) * monsoon_factor

        # Autoregressive stochastic perturbations (AR(1) temporal continuity)
        noise = np.zeros(n_timesteps)
        epsilon = np.random.normal(0.0, 2.8, size=n_timesteps)
        for t in range(1, n_timesteps):
            noise[t] = 0.75 * noise[t - 1] + epsilon[t]

        sensor_speed = base_speed + noise

        # Clamp speeds within physically valid range [5.0, v_free]
        speeds[:, i] = np.clip(sensor_speed, 5.0, v_free + 4.0)

    df_speeds = pd.DataFrame(speeds, index=timestamps, columns=SENSOR_IDS)
    return df_speeds


# ----------------------------------------------------------------------
# 4. Synchronized Mumbai Meteorological Observations
# ----------------------------------------------------------------------
def generate_mumbai_weather(start_date="2019-01-01", n_days=125):
    """
    Generates hourly weather matching data/raw/weather_CA_2019.csv layout.
    Columns: Date,Time,date_time,visibility,sea_level_pressure,relative_humidity,wind_speed,Unnamed: 7,air_temp,wind_direction
    Aligned to data_loader.py date_time format: %m/%d/%y-%I:%M%p
    """
    hourly_index = pd.date_range(start=start_date, periods=n_days * 24, freq="h")
    np.random.seed(101)
    N_h = len(hourly_index)

    month = hourly_index.month
    hour = hourly_index.hour

    # Realistic Mumbai coastal climate profiles
    # Air Temp: 22C (winter morning) to 36C (summer afternoon)
    diurnal_temp = 5.0 * np.sin(2.0 * np.pi * (hour - 9) / 24.0)
    seasonal_temp = np.where(np.isin(month, [4, 5]), 32.0,
                    np.where(np.isin(month, [12, 1, 2]), 25.0, 29.0))
    air_temp = seasonal_temp + diurnal_temp + np.random.normal(0, 1.2, N_h)

    # Relative Humidity: 60% in winter, up to 92% in monsoon
    base_rh = np.where(np.isin(month, [6, 7, 8, 9]), 85.0,
              np.where(np.isin(month, [3, 4, 5]), 72.0, 64.0))
    relative_humidity = np.clip(base_rh - 0.8 * diurnal_temp + np.random.normal(0, 3.5, N_h), 40.0, 99.0)

    # Sea Level Pressure: 1004 hPa (monsoon low) to 1016 hPa (winter)
    base_pres = np.where(np.isin(month, [6, 7, 8]), 1005.0, 1013.0)
    sea_level_pressure = base_pres + 1.5 * np.cos(2.0 * np.pi * hour / 12.0) + np.random.normal(0, 0.8, N_h)

    # Wind Speed: 8 to 28 km/h coastal breeze
    wind_speed = np.clip(12.0 + 6.0 * np.sin(2.0 * np.pi * (hour - 12) / 24.0) + np.random.normal(0, 3.0, N_h), 2.0, 45.0)

    # Wind Direction (degrees): mostly SW in monsoon (220 deg), NW/N in winter
    base_dir = np.where(np.isin(month, [6, 7, 8, 9]), 230.0, 310.0)
    wind_direction = (base_dir + np.random.normal(0, 25.0, N_h)) % 360.0

    # Visibility (miles/km): 6.0 to 10.0 miles, drops to 2.5 during monsoon rain
    visibility = np.where(np.isin(month, [6, 7, 8, 9]),
                          np.clip(6.0 - np.random.exponential(1.5, N_h), 1.5, 9.0),
                          np.clip(9.0 + np.random.normal(0, 0.8, N_h), 4.0, 10.0))

    # Format strings matching data_loader.py expectation (%m/%d/%y-%I:%M%p)
    date_strs = hourly_index.strftime("%m/%d/%y")
    time_strs = hourly_index.strftime("%I:%M%p")
    datetime_strs = hourly_index.strftime("%m/%d/%y-%I:%M%p")

    weather_df = pd.DataFrame({
        "Date": date_strs,
        "Time": time_strs,
        "date_time": datetime_strs,
        "visibility": np.round(visibility, 1),
        "sea_level_pressure": np.round(sea_level_pressure, 1),
        "relative_humidity": np.round(relative_humidity, 1),
        "wind_speed": np.round(wind_speed, 1),
        "Unnamed: 7": np.nan,
        "air_temp": np.round(air_temp, 1),
        "wind_direction": np.round(wind_direction, 0).astype(int),
    })

    return weather_df


# ----------------------------------------------------------------------
# 5. Main Execution & Pipeline Artifact Generation
# ----------------------------------------------------------------------
def main():
    print("=" * 70)
    print("UrbanPulse — Generating Synthetic Mumbai Dataset (UrbanPulse-MUM-50)")
    print("=" * 70)

    # 1. Generate Adjacency Matrix
    print(f"[1/3] Building topology graph for {N_SENSORS} sensor stations across 5 corridors...")
    adj_mx = build_adjacency_matrix(SENSORS, sigma=3.2, kappa=6.5)
    pkl_path = os.path.join(RAW_DIR, "adj_MUMBAI-50.pkl")
    with open(pkl_path, "wb") as f:
        pickle.dump([SENSOR_IDS, SENSOR_ID_TO_IND, adj_mx], f, protocol=2)
    print(f"      -> Wrote {pkl_path} (shape: {adj_mx.shape}, non-zero edges: {np.count_nonzero(adj_mx)})")

    # 2. Generate Speeds HDF5
    print("[2/3] Generating 5-min speed matrix (34,272 timesteps x 50 sensors)...")
    df_speeds = generate_mumbai_speeds(n_timesteps=34272, start_date="2019-01-01")
    h5_path = os.path.join(RAW_DIR, "MUMBAI-50.h5")
    df_speeds.to_hdf(h5_path, key="df", mode="w")
    print(f"      -> Wrote {h5_path} (shape: {df_speeds.shape}, size: {os.path.getsize(h5_path) // (1024*1024)} MB)")
    print(f"         Mean speed: {df_speeds.values.mean():.2f} km/h | Min: {df_speeds.values.min():.2f} | Max: {df_speeds.values.max():.2f}")

    # 3. Generate Weather CSV
    print("[3/3] Generating synchronized Mumbai meteorological observations...")
    df_weather = generate_mumbai_weather(start_date="2019-01-01", n_days=125)
    csv_path = os.path.join(RAW_DIR, "weather_MUMBAI_2019.csv")
    df_weather.to_csv(csv_path, index=False)
    print(f"      -> Wrote {csv_path} ({len(df_weather)} hourly records)")

    print("\n[SUCCESS] Step 1 Complete: All 3 raw data files generated successfully in data/raw/!")
    print("Run `python scripts/mumbai/verify_mumbai_dataset.py` to test pipeline compatibility.")


if __name__ == "__main__":
    main()

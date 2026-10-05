"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type CityId = "la" | "mumbai";

export interface CityConfig {
  id: CityId;
  name: string;
  country: string;
  flag: string;
  subtitle: string;
  sensorCount: number;
  speedUnit: "mph" | "km/h";
  tempUnit: "°F" | "°C";
  windUnit: "mph" | "km/h";
  center: [number, number]; // [lat, lng]
  zoom: number;
  openMeteoParams: {
    latitude: number;
    longitude: number;
    temperature_unit?: string;
    wind_speed_unit?: string;
  };
  files: {
    sensorLocations: string;
    dashboardData: string;
    heatmapData: string;
    timeseriesData: string;
  };
}

export const CITIES: Record<CityId, CityConfig> = {
  la: {
    id: "la",
    name: "Los Angeles",
    country: "USA",
    flag: "🇺🇸",
    subtitle: "METR-LA · 207 sensors",
    sensorCount: 207,
    speedUnit: "mph",
    tempUnit: "°F",
    windUnit: "mph",
    center: [34.05, -118.24],
    zoom: 11,
    openMeteoParams: {
      latitude: 34.05,
      longitude: -118.24,
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
    },
    files: {
      sensorLocations: "/sensor-locations.json",
      dashboardData: "/dashboard-data.json",
      heatmapData: "/heatmap-data.json",
      timeseriesData: "/timeseries-data.json",
    },
  },
  mumbai: {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    flag: "🇮🇳",
    subtitle: "MUMBAI-50 · 50 checkpoints",
    sensorCount: 50,
    speedUnit: "km/h",
    tempUnit: "°C",
    windUnit: "km/h",
    center: [19.076, 72.878],
    zoom: 12,
    openMeteoParams: {
      latitude: 19.076,
      longitude: 72.878,
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
    },
    files: {
      sensorLocations: "/mumbai-sensor-locations.json",
      dashboardData: "/mumbai-dashboard-data.json",
      heatmapData: "/mumbai-heatmap-data.json",
      timeseriesData: "/mumbai-timeseries-data.json",
    },
  },
};

interface CityContextType {
  city: CityId;
  setCity: (city: CityId) => void;
  cityConfig: CityConfig;
}

const CityContext = createContext<CityContextType>({
  city: "la",
  setCity: () => {},
  cityConfig: CITIES.la,
});

export function CityProvider({ children }: { children: React.ReactNode }) {
  const [city, setCityState] = useState<CityId>("la");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("urbanpulse_city") as CityId | null;
      if (saved && (saved === "la" || saved === "mumbai")) {
        setCityState(saved);
      }
    } catch {
      // Ignore localStorage access issues
    }
  }, []);

  const setCity = (newCity: CityId) => {
    setCityState(newCity);
    try {
      localStorage.setItem("urbanpulse_city", newCity);
    } catch {
      // Ignore
    }
  };

  const cityConfig = CITIES[city] || CITIES.la;

  return (
    <CityContext.Provider value={{ city, setCity, cityConfig }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  return useContext(CityContext);
}

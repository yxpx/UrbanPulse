"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { addDarkBasemap } from "@/lib/map-basemap";
import "leaflet/dist/leaflet.css";

interface Sensor {
  id: number;
  sensor_id?: string;
  name?: string;
  corridor?: string;
  lat: number;
  lng: number;
  avg_speed: number;
  congestion: number;
  color: string;
}

interface RoutePlannerMapProps {
  sensors: Sensor[];
  startSensor: Sensor | null;
  endSensor: Sensor | null;
  routeLatLngs: [number, number][];
  onSelectSensor: (sensor: Sensor) => void;
  height?: string;
  speedUnit?: string;
}

function haversineMeters(a: L.LatLng, b: L.LatLng): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function RoutePlannerMap({
  sensors,
  startSensor,
  endSensor,
  routeLatLngs,
  onSelectSensor,
  height = "560px",
  speedUnit = "mph",
}: RoutePlannerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const sensorLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectSensor);

  useEffect(() => {
    onSelectRef.current = onSelectSensor;
  }, [onSelectSensor]);

  const bounds = useMemo(() => {
    if (!sensors.length) return null;
    const latLngs = sensors.map((s) => L.latLng(s.lat, s.lng));
    return L.latLngBounds(latLngs).pad(0.2);
  }, [sensors]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!sensors.length) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    if (!bounds) return;

    const map = L.map(mapRef.current, {
      center: bounds.getCenter(),
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      preferCanvas: false,
      minZoom: 12,
      maxZoom: 12,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
    });

    addDarkBasemap(map);

    map.setView(bounds.getCenter(), 12, { animate: false });

    const sensorLayer = L.layerGroup();
    sensors.forEach((s) => {
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: 3,
        fillColor: "#94a3b8",
        color: "rgba(0,0,0,0.2)",
        weight: 1,
        fillOpacity: 0.7,
      });

      marker.bindTooltip(
        `<div style="font-size:12px;line-height:1.4">
          <strong>Sensor ${s.id}${s.sensor_id ? ` (${s.sensor_id})` : ""}</strong><br/>
          ${s.name ? `<span style="color:#a1a1aa">${s.name}</span><br/>` : ""}
          Speed: <strong>${s.avg_speed ? `${s.avg_speed.toFixed(1)} ${speedUnit}` : "-"}</strong><br/>
          <span style="font-size:10px;color:#a1a1aa">Predicted corridor flow speed</span>
        </div>`,
        { direction: "top", offset: [0, -4] }
      );

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRef.current(s);
      });

      marker.addTo(sensorLayer);
    });
    sensorLayer.addTo(map);
    sensorLayerRef.current = sensorLayer;

    map.on("click", (e) => {
      if (!sensors.length) return;
      const click = L.latLng(e.latlng.lat, e.latlng.lng);
      let best: Sensor | null = null;
      let bestMeters = Number.POSITIVE_INFINITY;
      for (const s of sensors) {
        const d = haversineMeters(click, L.latLng(s.lat, s.lng));
        if (d < bestMeters) {
          bestMeters = d;
          best = s;
        }
      }
      if (!best || bestMeters > 2500) return;
      onSelectRef.current(best);
    });

    mapInstanceRef.current = map;
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [sensors, bounds]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (startMarkerRef.current) startMarkerRef.current.remove();
    if (endMarkerRef.current) endMarkerRef.current.remove();

    if (startSensor) {
      const icon = L.divIcon({
        className: "route-marker route-marker--start",
        html: "S",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([startSensor.lat, startSensor.lng], { icon }).addTo(map);
      marker.bindTooltip("Start", { direction: "top" });
      startMarkerRef.current = marker;
    }

    if (endSensor) {
      const icon = L.divIcon({
        className: "route-marker route-marker--end",
        html: "E",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([endSensor.lat, endSensor.lng], { icon }).addTo(map);
      marker.bindTooltip("End", { direction: "top" });
      endMarkerRef.current = marker;
    }
  }, [startSensor, endSensor]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routeLayerRef.current) routeLayerRef.current.remove();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    if (!routeLatLngs.length) return;

    const routeLayer = L.layerGroup().addTo(map);

      /* layer 1 – soft glow base */
      L.polyline(routeLatLngs, {
        color: "#38bdf8",
        weight: 7,
        opacity: 0.18,
        lineCap: "round",
      }).addTo(routeLayer);

      /* layer 2 – fast escalator dashes */
      const escalator1 = L.polyline(routeLatLngs, {
        color: "#38bdf8",
        weight: 3,
        opacity: 0.9,
        dashArray: "6 14",
        lineCap: "butt",
      }).addTo(routeLayer);

      /* layer 3 – offset counter-dashes for density */
      const escalator2 = L.polyline(routeLatLngs, {
        color: "#60a5fa",
        weight: 2,
        opacity: 0.55,
        dashArray: "4 18",
        lineCap: "butt",
      }).addTo(routeLayer);

      routeLayerRef.current = routeLayer;

      let offset1 = 0;
      let offset2 = 0;

      const step = () => {
        if (!mapInstanceRef.current || !routeLayerRef.current) return;
        offset1 = (offset1 - 16) % 2000;
        offset2 = (offset2 + 12) % 2000;
        try {
          escalator1.setStyle({ dashOffset: `${offset1}` });
          escalator2.setStyle({ dashOffset: `${offset2}` });
          animationRef.current = requestAnimationFrame(step);
        } catch {
          // Ignore style updates if layer was removed
        }
      };

      animationRef.current = requestAnimationFrame(step);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };
  }, [routeLatLngs]);

  return <div ref={mapRef} style={{ height, width: "100%", borderRadius: "var(--radius)" }} />;
}

import L from "leaflet";

// Shared dark basemap for every city and dashboard map.
export function addDarkBasemap(map: L.Map) {
  const pane = map.createPane("dark-basemap");
  pane.style.zIndex = "200";
  pane.style.filter = "brightness(0.65) contrast(1.25)";
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      pane: "dark-basemap",
      maxNativeZoom: 16,
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors',
    }
  ).addTo(map);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    { pane: "dark-basemap", maxNativeZoom: 16, maxZoom: 19, opacity: 0.85 }
  ).addTo(map);
}

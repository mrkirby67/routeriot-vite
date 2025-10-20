// ============================================================================
// FILE: /modules/zonesMap.js
// PURPOSE: Static map and geometry encoding helpers for mini-map previews
// ============================================================================

import { firebaseConfig } from './config.js';

// ---------------------------------------------------------------------------
// 🗺️ Calculate Zoom Level (approximation for static map clarity)
// ---------------------------------------------------------------------------
export function calculateZoomLevel(diameterKm, imageWidthPixels = 150) {
  const GLOBE_WIDTH = 256; // pixels at zoom level 0
  const EARTH_RADIUS_KM = 6371;

  if (!diameterKm || diameterKm <= 0) return 15;

  const angle = (diameterKm / EARTH_RADIUS_KM) * (180 / Math.PI) * 2;
  const zoom = Math.floor(Math.log2((imageWidthPixels * 360) / (angle * GLOBE_WIDTH)));
  return Math.max(8, Math.min(18, zoom)); // Clamp between 8–18
}

// ---------------------------------------------------------------------------
// 🧭 Encode Circle (for drawing encoded polyline of a circular zone boundary)
// ---------------------------------------------------------------------------
export function encodeCircle(centerStr, radiusMeters = 50) {
  try {
    if (!window.google?.maps?.geometry) return "";

    const [lat, lng] = centerStr.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) return "";

    const R = 6371e3; // Earth's radius in meters
    const points = [];

    for (let i = 0; i <= 360; i += 10) {
      const brng = (i * Math.PI) / 180;
      const lat2 = Math.asin(
        Math.sin(lat * Math.PI / 180) * Math.cos(radiusMeters / R) +
        Math.cos(lat * Math.PI / 180) * Math.sin(radiusMeters / R) * Math.cos(brng)
      );
      const lng2 =
        (lng * Math.PI) / 180 +
        Math.atan2(
          Math.sin(brng) * Math.sin(radiusMeters / R) * Math.cos(lat * Math.PI / 180),
          Math.cos(radiusMeters / R) - Math.sin(lat * Math.PI / 180) * Math.sin(lat2)
        );

      points.push([lat2 * 180 / Math.PI, lng2 * 180 / Math.PI]);
    }

    return google.maps.geometry.encoding.encodePath(
      points.map(([pLat, pLng]) => new google.maps.LatLng(pLat, pLng))
    );
  } catch (err) {
    console.warn("⚠️ encodeCircle failed:", err);
    return "";
  }
}

// ---------------------------------------------------------------------------
// 🧩 Generate Mini Map (Static Map thumbnail for Control & Player views)
// ---------------------------------------------------------------------------
export function generateMiniMap(zoneData = {}) {
  if (!firebaseConfig?.apiKey) {
    return `<img src="https://placehold.co/150x150/5d1c1c/ffffff?text=Missing+API+Key" class="mini-map" alt="No API key configured">`;
  }

  const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
  if (!zoneData.gps || !gpsRegex.test(zoneData.gps)) {
    return `<img src="https://placehold.co/150x150/1e1e1e/999?text=Invalid+GPS" class="mini-map" alt="Invalid GPS data">`;
  }

  const [lat, lng] = zoneData.gps.split(',').map(n => parseFloat(n.trim()));
  const diameterKm = parseFloat(zoneData.diameter) || 0.05;
  const zoomLevel = calculateZoomLevel(diameterKm);
  const radiusMeters = (diameterKm / 2) * 1000;

  // Build Static Map URL
  const mapUrl = new URL("https://maps.googleapis.com/maps/api/staticmap");
  mapUrl.searchParams.set("center", `${lat},${lng}`);
  mapUrl.searchParams.set("zoom", zoomLevel);
  mapUrl.searchParams.set("size", "150x150");
  mapUrl.searchParams.set("maptype", "satellite");
  mapUrl.searchParams.set("markers", `color:red|${lat},${lng}`);
  mapUrl.searchParams.set("key", firebaseConfig.apiKey);

  // Optional overlay circle via encoded path
  try {
    const encodedCircle = encodeCircle(`${lat},${lng}`, radiusMeters);
    if (encodedCircle) {
      mapUrl.searchParams.append(
        "path",
        `color:0xFF000080|weight:2|enc:${encodedCircle}`
      );
    }
  } catch (err) {
    console.warn("⚠️ Could not encode circle:", err);
  }

  return `<img src="${mapUrl.toString()}" class="mini-map" alt="Map preview of ${zoneData.name || 'Zone'}">`;
}
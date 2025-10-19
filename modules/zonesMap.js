// ============================================================================
// File: /modules/zonesMap.js
// Purpose: Static map and geometry encoding helpers
// ============================================================================
import { firebaseConfig } from './config.js';

export function calculateZoomLevel(diameterKm, imageWidthPixels = 150) {
  const GLOBE_WIDTH = 256;
  const angle = diameterKm / 6371 * (180 / Math.PI) * 2;
  const zoom = Math.floor(Math.log2(imageWidthPixels * 360 / angle / GLOBE_WIDTH));
  return Math.max(8, Math.min(18, zoom));
}

export function encodeCircle(centerStr, radius) {
  try {
    if (!window.google?.maps?.geometry) return "";
    const [lat, lng] = centerStr.split(',').map(Number);
    const R = 6371e3;
    const points = [];
    for (let i = 0; i <= 360; i += 10) {
      const d = radius;
      const brng = i * Math.PI / 180;
      const lat2 = Math.asin(
        Math.sin(lat * Math.PI / 180) * Math.cos(d / R) +
        Math.cos(lat * Math.PI / 180) * Math.sin(d / R) * Math.cos(brng)
      );
      const lng2 = (lng * Math.PI / 180) +
        Math.atan2(
          Math.sin(brng) * Math.sin(d / R) * Math.cos(lat * Math.PI / 180),
          Math.cos(d / R) - Math.sin(lat * Math.PI / 180) * Math.sin(lat2)
        );
      points.push([lat2 * 180 / Math.PI, lng2 * 180 / Math.PI]);
    }
    return google.maps.geometry.encoding.encodePath(
      points.map(p => new google.maps.LatLng(p[0], p[1]))
    );
  } catch {
    return "";
  }
}

export function generateMiniMap(zoneData) {
  if (!firebaseConfig.apiKey) {
    return `<img src="https://placehold.co/150x150/5d1c1c/ffffff?text=Missing+API+Key" class="mini-map">`;
  }

  const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
  if (!zoneData?.gps || !gpsRegex.test(zoneData.gps)) {
    return `<img src="https://placehold.co/150x150/1e1e1e/555?text=Invalid+GPS" class="mini-map">`;
  }

  const [lat, lng] = zoneData.gps.split(',').map(n => parseFloat(n.trim()));
  const diameterKm = parseFloat(zoneData.diameter) || 0.05;
  const zoomLevel = calculateZoomLevel(diameterKm);
  const radiusInMeters = (diameterKm / 2) * 1000;

  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
    `&zoom=${zoomLevel}&size=150x150&maptype=satellite` +
    `&markers=color:red%7C${lat},${lng}&key=${firebaseConfig.apiKey}`;

  return `<img src="${mapUrl}" class="mini-map" alt="Map preview of ${zoneData.name}">`;
}
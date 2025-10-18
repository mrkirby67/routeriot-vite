// File: modules/homeMap.js
import { db, googleMapsApiKey } from './config.js';
import { getDocs, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/** Parse "lat, lng" -> {lat, lng} or null */
function parseGPS(gps) {
  if (typeof gps !== 'string') return null;
  const parts = gps.split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return { lat: parts[0], lng: parts[1] };
}

/** Compute average center from points */
function averageCenter(points) {
  if (!points.length) return { lat: 0, lng: 0 };
  const sum = points.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** Compute bounds of points */
function boundsOf(points) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  points.forEach(({ lat, lng }) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  return { minLat, maxLat, minLng, maxLng };
}

/** Compute a zoom that fits bounds in given pixel size (rough but effective) */
function computeZoom(bounds, widthPx = 900, heightPx = 600, aroundLat = 45) {
  // Add padding so points aren’t right on the edge
  const PAD = 1.10;
  const latSpan = Math.max(0.000001, (bounds.maxLat - bounds.minLat) * PAD);
  const lngSpan = Math.max(0.000001, (bounds.maxLng - bounds.minLng) * PAD);

  // Pixels per degree at a given zoom: 256 * 2^z / 360
  // Adjust latitude by cos(phi) due to Mercator projection
  const lngZoom = Math.log2((widthPx * 360) / (lngSpan * 256));
  const latZoom = Math.log2((heightPx * 360) / (latSpan * 256 * Math.cos(aroundLat * Math.PI / 180)));

  // Clamp to Static Maps range [0..21]
  return Math.max(3, Math.min(21, Math.floor(Math.min(lngZoom, latZoom))));
}

/** Create circle path (as polygon) around center, radiusMeters */
function circlePathPoints(center, radiusMeters, stepDeg = 10) {
  const R = 6371000; // Earth radius (m)
  const latRad = center.lat * Math.PI / 180;
  const lngRad = center.lng * Math.PI / 180;
  const angDist = radiusMeters / R;

  const pts = [];
  for (let deg = 0; deg <= 360; deg += stepDeg) {
    const brng = deg * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angDist) +
      Math.cos(latRad) * Math.sin(angDist) * Math.cos(brng)
    );
    const lng2 = lngRad + Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(latRad),
      Math.cos(angDist) - Math.sin(latRad) * Math.sin(lat2)
    );
    pts.push(`${(lat2 * 180 / Math.PI).toFixed(6)},${(lng2 * 180 / Math.PI).toFixed(6)}`);
  }
  return pts;
}

/** Build a Google Static Maps URL with red circle overlays */
function buildStaticMapUrl(center, zoom, zones, size = '900x600', maptype = 'roadmap') {
  const base = new URL('https://maps.googleapis.com/maps/api/staticmap');
  base.searchParams.set('size', size);
  base.searchParams.set('maptype', maptype);       // 'roadmap' or 'satellite'
  base.searchParams.set('center', `${center.lat},${center.lng}`);
  base.searchParams.set('zoom', String(zoom));
  base.searchParams.set('key', googleMapsApiKey);

  // Draw each zone as a semi-transparent red circle
  zones.forEach(z => {
    const diameterKm = parseFloat(z.diameter);
    const radiusMeters = (Number.isFinite(diameterKm) ? diameterKm : 0.05) * 1000 / 2; // km -> m
    const pts = circlePathPoints(z.coords, radiusMeters, 10);
    const path = `fillcolor:0xFF000020|color:0xFF0000FF|weight:2|${pts.join('|')}`;
    base.searchParams.append('path', path);
  });

  // Optional: tiny red marker at each zone center
  if (zones.length) {
    const markers = `size:tiny|color:red|${zones.map(z => `${z.coords.lat},${z.coords.lng}`).join('|')}`;
    base.searchParams.append('markers', markers);
  }

  return base.toString();
}

/** Render big home map into #home-map (container) */
export async function renderHomeMap() {
  try {
    const container = document.getElementById('home-map');

    if (!googleMapsApiKey) {
      console.error('Missing Google Maps API key');
      if (container) container.innerHTML = `<div style="padding:20px;background:#5d1c1c;color:#fff;border-radius:8px;">Missing Google Maps API key</div>`;
      return;
    }

    const snap = await getDocs(collection(db, 'zones'));
    const zonesRaw = [];
    snap.forEach(doc => zonesRaw.push(doc.data()));

    // Filter to valid GPS points
    const parsed = zonesRaw
      .map(z => ({ ...z, coords: parseGPS(z.gps || '') }))
      .filter(z => z.coords);

    if (parsed.length === 0) {
      if (container) container.innerHTML = `<div style="padding:20px;background:#222;color:#bbb;border-radius:8px;">No zones with valid GPS yet.</div>`;
      return;
    }

    // Compute average center & zoom that fits all points
    const points = parsed.map(z => z.coords);
    const center = averageCenter(points);
    const b = boundsOf(points);

    // Fit all zones, then zoom out a touch for comfort
    let zoom = computeZoom(b, 900, 600, center.lat);
    zoom = Math.max(3, zoom - 2); // zoom out 2 levels so every area is clearly in frame

    // Build URL and inject
    const url = buildStaticMapUrl(center, zoom, parsed, '900x600', 'roadmap');
    if (container) {
      container.innerHTML = `<img src="${url}" alt="Route Riot Game Area Map" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;">`;
    }
  } catch (err) {
    console.error('Failed to render home map:', err);
    const container = document.getElementById('home-map');
    if (container) container.innerHTML = `<div style="padding:20px;background:#5d1c1c;color:#fff;border-radius:8px;">Error loading map</div>`;
  }
}
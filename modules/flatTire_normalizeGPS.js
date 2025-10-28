// ====================================================================
// MODULE: flatTire_normalizeGPS.js
// PURPOSE: One-time repair for depot GPS in Flat Tire config documents
// ====================================================================

import { loadFlatTireConfig, saveFlatTireConfig } from './flatTireManager.js';

async function normalizeConfigGps() {
  console.log('🧭 [FlatTire GPSFix] Normalizing tow-zone coordinates…');
  try {
    const config = await loadFlatTireConfig();
    if (!config || typeof config !== 'object' || !config.zones) {
      console.warn('⚠️ [FlatTire GPSFix] No zones configuration found.');
      return;
    }

    let fixed = 0;
    Object.entries(config.zones).forEach(([key, zone]) => {
      if (!zone || typeof zone !== 'object') return;
      const gps = typeof zone.gps === 'string' ? zone.gps : '';
      const lat = Number(zone.lat);
      const lng = Number(zone.lng);

      if (gps && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
        const [parsedLat, parsedLng] = gps.split(',').map(part => Number.parseFloat(part.trim()));
        if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
          zone.lat = parsedLat;
          zone.lng = parsedLng;
          fixed += 1;
        }
      }
    });

    if (fixed > 0) {
      await saveFlatTireConfig(config);
      console.log(`✅ [FlatTire GPSFix] Re-saved ${fixed} zone(s) with proper lat/lng.`);
    } else {
      console.log('✅ [FlatTire GPSFix] All tow-zones already contained valid GPS coordinates.');
    }
  } catch (err) {
    console.error('❌ [FlatTire GPSFix] GPS normalization failed:', err);
  }
}

normalizeConfigGps();

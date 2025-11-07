// ============================================================================
// Pew Pursuit Google Maps scaffolding.
// ============================================================================

import { loadGoogleMapsApi } from '../modules/googleMapsLoader.js';
import { GAMEPLAY_DEFAULTS } from './config.js';

let googleMaps = null;
let mapInstance = null;
let markers = [];

export async function initializePewMap(container, options = {}) {
  if (!container) {
    throw new Error('Map container element is required for Pew Pursuit.');
  }
  googleMaps = await loadGoogleMapsApi();
  if (!mapInstance) {
    mapInstance = new googleMaps.Map(container, {
      center: options.center || GAMEPLAY_DEFAULTS.mapCenter,
      zoom: options.zoom || GAMEPLAY_DEFAULTS.mapZoom,
      disableDefaultUI: true,
      styles: options.styles || null,
    });
  }
  return {
    map: mapInstance,
    syncZones: (zones) => renderZoneMarkers(zones),
    focusOnZone: (zone) => focusOnZone(zone),
  };
}

export function renderZoneMarkers(zones = []) {
  if (!googleMaps || !mapInstance) return;
  markers.forEach((marker) => marker.setMap(null));
  markers = zones
    .filter((zone) => typeof zone.lat === 'number' || typeof zone.latitude === 'number')
    .map((zone) => {
      const marker = new googleMaps.Marker({
        map: mapInstance,
        position: {
          lat: zone.lat ?? zone.latitude,
          lng: zone.lng ?? zone.longitude,
        },
        label: zone.shortCode || zone.name?.[0]?.toUpperCase() || '?',
        title: zone.name || zone.id,
      });
      return marker;
    });
}

export function focusOnZone(zone) {
  if (!zone || !mapInstance) return;
  const lat = zone.lat ?? zone.latitude;
  const lng = zone.lng ?? zone.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  mapInstance.panTo({ lat, lng });
  mapInstance.setZoom(zone.zoom ?? GAMEPLAY_DEFAULTS.mapZoom);
}

// TODO: draw concentric circles for zone radius visualization.

// This module ensures the Google Maps script is loaded only once and is ready before we use it.

import { firebaseConfig } from './config.js';

let mapsPromise = null;

export function loadGoogleMapsApi() {
    if (mapsPromise) {
        return mapsPromise;
    }

    mapsPromise = new Promise((resolve, reject) => {
        // Check if the script is already on the page
        if (window.google && window.google.maps) {
            resolve(window.google.maps);
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${firebaseConfig.apiKey}&libraries=geometry`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            console.log("Google Maps API loaded successfully.");
            resolve(window.google.maps);
        };
        
        script.onerror = () => {
            console.error("Failed to load Google Maps API.");
            reject(new Error("Failed to load Google Maps API."));
        };

        document.head.appendChild(script);
    });

    return mapsPromise;
}
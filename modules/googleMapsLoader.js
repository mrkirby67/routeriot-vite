import { firebaseConfig } from './config.js';

let mapsPromise = null;

export function loadGoogleMapsApi() {
    if (mapsPromise) {
        return mapsPromise;
    }

    mapsPromise = new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve(window.google.maps);
            return;
        }

        const script = document.createElement('script');
        // The 'async' attribute and 'loading=async' parameter are the key fixes here
        script.src = `https://maps.googleapis.com/maps/api/js?key=${firebaseConfig.apiKey}&libraries=geometry&loading=async`;
        script.async = true;
        
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


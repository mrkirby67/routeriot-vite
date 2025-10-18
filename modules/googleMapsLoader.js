// ============================================================================
// modules/googleMapsLoader.js
// ----------------------------------------------------------------------------
// Loads the Google Maps JavaScript API using the key from your .env file.
// Designed for Vite projects — reads key via import.meta.env.VITE_GOOGLE_MAPS_API_KEY.
// Includes retry protection, async loading, and detailed error logging.
// ============================================================================

let mapsPromise = null;

export function loadGoogleMapsApi() {
    // Prevent multiple loads
    if (mapsPromise) return mapsPromise;

    mapsPromise = new Promise((resolve, reject) => {
        // If already loaded, resolve immediately
        if (window.google && window.google.maps) {
            console.log("✅ Google Maps API already loaded.");
            resolve(window.google.maps);
            return;
        }

        // Retrieve the key from Vite env
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey || apiKey.trim() === "") {
            const msg = "❌ Google Maps API key not found — check .env file and variable prefix (VITE_GOOGLE_MAPS_API_KEY).";
            console.error(msg);
            reject(new Error(msg));
            return;
        }

        // Construct the script URL
        const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&loading=async`;

        // Check if the script is already injected
        if (document.querySelector(`script[src="${scriptUrl}"]`)) {
            console.log("⚠️ Google Maps API script already exists in document.");
            resolve(window.google?.maps || {});
            return;
        }

        // Create and configure the script tag
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.defer = true;

        // Success handler
        script.onload = () => {
            if (window.google && window.google.maps) {
                console.log("✅ Google Maps API loaded successfully.");
                resolve(window.google.maps);
            } else {
                reject(new Error("❌ Google Maps loaded but window.google.maps missing."));
            }
        };

        // Error handler
        script.onerror = (err) => {
            console.error("❌ Failed to load Google Maps API.", err);
            reject(new Error("Failed to load Google Maps API — check console for details."));
        };

        // Append script to document
        document.head.appendChild(script);
    });

    return mapsPromise;
}
# Ui Layer

Total modules: 3

| Module | Purpose | Exports | Phase |
|--------|---------|---------|-------|
| [ui/flat-tire/flatTireUI.js](ui/flat-tire/flatTireUI.js.md) | Handles DOM rendering and UI logic for the Flat<br>Tire feature. | setupDomRefs, renderRows,<br>updateZonePreview,<br>generateZoneSignature | tier4_ui_injection |
| [ui/gameNotifications.js](ui/gameNotifications.js.md) | Displays UI notifications and alerts to the user. | showFlashMessage,<br>showCountdownBanner,<br>showSuccess, showError,<br>showInfo | tier4_ui_injection |
| [ui/overlays/FlatTireOverlay.js](ui/overlays/FlatTireOverlay.js.md) | Manages the UI overlay for the Flat Tire event. | showFlatTireOverlay,<br>hideFlatTireOverlay | tier4_ui_injection |

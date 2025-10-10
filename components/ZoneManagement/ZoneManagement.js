// File: /public/components/ZoneManagement/ZoneManagement.js
import styles from './ZoneManagement.module.css'; // <-- 1. Imports the stylesheet

function ZoneManagementComponent() {
    const componentHtml = `
        // 2. Uses the imported styles
        <div class="${styles.controlSection}">
            <h2>Zone Management</h2>
            <div class="${styles.cooldownSetup}">
                <label for="cooldown-time">Capture Cooldown Time:</label>
                <select id="cooldown-time">
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="25">25 minutes</option>
                    <option value="30" selected>30 minutes</option>
                    <option value="45">45 minutes</option>
                </select>
            </div>
            <table class="${styles.dataTable}" id="zones-table">
                <thead>
                    <tr>
                        <th>Zone #</th>
                        <th>Zone Name (Editable)</th>
                        <th>GPS Coordinates (Lat, Lng)</th>
                        <th>Capture Diameter (km)</th>
                        <th>Action</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="zones-table-body">
                    </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export default ZoneManagementComponent;

/* ... (Your original reference code remains here) ... */
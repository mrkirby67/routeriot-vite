import { allTeams } from '../../data.js';
import styles from './TeamLinks.module.css';

function TeamLinksComponent() {
    const tableRowsHtml = allTeams.map(team => {
        const teamUrl = `/player.html?teamName=${encodeURIComponent(team.name)}`;
        return `
            <tr>
                <td>${team.name}</td>
                <td><a href="${teamUrl}" target="_blank">${teamUrl}</a></td>
            </tr>
        `;
    }).join('');

    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Team Links</h2>
            <p>Share these unique URLs with each team captain.</p>
            <table class="${styles.dataTable}" id="team-links-table">
                <thead>
                    <tr>
                        <th>Team Name</th>
                        <th>Player Page URL</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export default TeamLinksComponent;

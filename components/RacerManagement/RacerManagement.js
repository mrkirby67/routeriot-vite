import styles from './RacerManagement.module.css';

function RacerManagementComponent() {
    const componentHtml = `
        <div class="${styles.controlSection}">
            <h2>Racer Management</h2>
            <table class="${styles.dataTable}" id="racers-table">
                <thead>
                    <tr>
                        <th>Assigned Team</th>
                        <th>Racer Name</th>
                        <th>Cell Number</th>
                        <th>Email Address</th>
                    </tr>
                </thead>
                <tbody id="racers-table-body">
                </tbody>
            </table>
        </div>
    `;
    return componentHtml;
}

export default RacerManagementComponent;

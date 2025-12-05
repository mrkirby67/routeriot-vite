import { allTeams } from '../data.js';

/**
 * @param {string} name
 * @returns {{name: string, slogan: string, email: string, phone: string} | undefined}
 */
export function getTeamByName(name) {
    return allTeams.find(team => team.name === name);
}

/**
 * @returns {{name: string, slogan: string, email: string, phone: string}[]}
 */
export function getAllTeams() {
    return allTeams;
}

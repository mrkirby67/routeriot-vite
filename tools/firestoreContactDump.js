#!/usr/bin/env node
/**
 * Developer-facing Firestore contact dump.
 * Usage:
 *   NODE_OPTIONS=--experimental-network-imports node tools/firestoreContactDump.js
 * Prints a JSON array of contacts (team + player level) to stdout.
 */

import { fetchAllTeamContacts } from '../services/admin/contactReportService.js';

async function run() {
  const contacts = await fetchAllTeamContacts();
  console.log(JSON.stringify(contacts, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error dumping Firestore contacts:', err?.message || err);
    process.exit(1);
  });

#!/usr/bin/env node
/**
 * AICP Summary Dashboard Generator
 * Combines validation, audit, health, integrity, and doc results
 * into one easy-to-read markdown snapshot for the developer console.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const baseDir = path.resolve('./docs');
const reports = {
  validation: 'aicp_validation_report.md',
  audit: 'aicp_redundancy_report.md',
  health: 'aicp_file_health_report.md',
  integrity: 'aicp_integrity_report.md',
  docs: 'aicp_summary'
};

const summaryFile = path.join(baseDir, 'aicp_status_snapshot.md');

function readSnippet(file) {
  try {
    const data = fs.readFileSync(path.join(baseDir, file), 'utf8');
    const lines = data.split('\n');
    return lines.slice(0, 10).join('\n'); // just first few lines
  } catch {
    return '⚠️ Missing report file';
  }
}

function countFilesIn(dir) {
  try {
    const files = fs.readdirSync(path.join(baseDir, dir));
    return files.length;
  } catch {
    return 0;
  }
}

function parseStatus(data, keyword) {
  return data.includes('✅') || data.includes('PASS')
    ? chalk.green(`PASS`)
    : data.includes('⚠️') || data.includes('Warning')
    ? chalk.yellow(`WARN`)
    : chalk.red(`FAIL`);
}

function createDashboard() {
  const validation = readSnippet(reports.validation);
  const audit = readSnippet(reports.audit);
  const health = readSnippet(reports.health);
  const integrity = readSnippet(reports.integrity);
  const docCount = countFilesIn(reports.docs);

  const dash = `
# 🧭 AICP Status Snapshot — ${new Date().toLocaleString()}

| Check        | Status | Notes |
|---------------|:-------:|-------|
| Validation    | ${parseStatus(validation)} | Validation & auto-fix summary |
| Redundancy    | ${parseStatus(audit)} | Duplicate/overlap audit |
| File Health   | ${parseStatus(health)} | File weight & density |
| Integrity     | ${parseStatus(integrity)} | Export/variable consistency |
| Docs Exported | ${docCount} files | AICP component summaries |

---

🧩 *Last refresh via “npm run set”*
`;

  fs.writeFileSync(summaryFile, dash, 'utf8');
  console.log(chalk.cyanBright('\n📘 AICP Summary Snapshot written →'), chalk.white(summaryFile));
  console.log(dash);
}

// Execute dashboard build
createDashboard();
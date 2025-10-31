/**
 * ============================================================================
 * TOOL: aicp_integrity_check.js
 * PURPOSE: Verify existence and consistency of critical AICP exports/imports.
 * OUTPUT: docs/aicp_integrity_report.md
 * ============================================================================
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET_DIRS = ["modules", "services", "features", "components", "ui"];
const OUT_FILE = path.join(ROOT, "docs", "aicp_integrity_report.md");

// ---------------------------------------------------------------------------
// 🧠 Expected Exports Registry
// Add key functions that MUST exist for Route Riot to work
// ---------------------------------------------------------------------------
const CRITICAL_EXPORTS = {
  "services/messageService.js": ["listenForMyMessages", "sendMessage"],
  "features/team-surprise/teamSurpriseController.js": [
    "isTeamOnCooldown",
    "isShieldActive",
    "deactivateShield",
  ],
  "components/GameControls/GameControls.js": ["initializeGameControlsLogic"],
};

// ---------------------------------------------------------------------------
// 🧩 Utility helpers
// ---------------------------------------------------------------------------
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function listJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const res = path.resolve(dir, e.name);
    if (e.isDirectory()) return listJsFiles(res);
    return e.name.endsWith(".js") ? [res] : [];
  });
}

// ---------------------------------------------------------------------------
// 🔍 Scan for missing exports
// ---------------------------------------------------------------------------
function checkExports() {
  const results = [];
  for (const [rel, expectedFns] of Object.entries(CRITICAL_EXPORTS)) {
    const abs = path.join(ROOT, rel);
    const code = readFileSafe(abs);
    const foundFns = new Set(
      [...code.matchAll(/export\s+(?:function|const|let|var)\s+(\w+)/g)].map(
        (m) => m[1]
      )
    );
    expectedFns.forEach((fn) => {
      if (!foundFns.has(fn)) {
        results.push({
          file: rel,
          missing: fn,
          issue: "Missing expected export",
        });
      }
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 🧬 Check for undefined symbols used (phase-style errors)
// ---------------------------------------------------------------------------
function checkUndefinedUsage() {
  const results = [];
  for (const dir of TARGET_DIRS) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    const files = listJsFiles(base);
    for (const file of files) {
      const text = readFileSafe(file);
      const matches = text.match(/\bphase\b(?!\s*:)/g);
      if (matches && matches.length) {
        results.push({
          file: path.relative(ROOT, file),
          symbol: "phase",
          count: matches.length,
          issue: "Possible undefined variable",
        });
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// 📄 Write report
// ---------------------------------------------------------------------------
function writeReport(exportIssues, undefinedIssues) {
  let out = `# AICP Integrity Report — ${new Date().toISOString()}\n\n`;
  out += `Scanned directories: ${TARGET_DIRS.join(", ")}\n`;
  out += `\n## Missing Exports (${exportIssues.length})\n`;
  if (exportIssues.length === 0) out += "✅ None\n";
  else {
    out += "| File | Function | Issue |\n|------|-----------|--------|\n";
    exportIssues.forEach((e) => {
      out += `| ${e.file} | ${e.missing} | ${e.issue} |\n`;
    });
  }

  out += `\n## Possible Undefined Variables (${undefinedIssues.length})\n`;
  if (undefinedIssues.length === 0) out += "✅ None\n";
  else {
    out += "| File | Symbol | Count | Issue |\n|------|---------|--------|--------|\n";
    undefinedIssues.forEach((u) => {
      out += `| ${u.file} | ${u.symbol} | ${u.count} | ${u.issue} |\n`;
    });
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, out);
  console.log(`✅ Integrity report written → ${OUT_FILE}`);
}

// ---------------------------------------------------------------------------
// 🚀 Run
// ---------------------------------------------------------------------------
const exportIssues = checkExports();
const undefinedIssues = checkUndefinedUsage();
writeReport(exportIssues, undefinedIssues);
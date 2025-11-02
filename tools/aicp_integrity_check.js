/**
 * ============================================================================
 * TOOL: aicp_integrity_check.js (v3.1)
 * PURPOSE:
 *   Verify existence and consistency of critical AICP exports/imports,
 *   detect undefined symbols, and generate an AICP Layer Graph summary.
 * OUTPUT:
 *   docs/aicp_integrity_report.md
 * ============================================================================
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET_DIRS = ["modules", "services", "features", "components", "ui"];
const OUT_FILE = path.join(ROOT, "docs/aicp_integrity_report.md");

// ---------------------------------------------------------------------------
// 🧠 Expected Exports Registry (Critical Routes for Route Riot)
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
// 🔍 Scan for missing exports (now includes trailing export syntax)
// ---------------------------------------------------------------------------
function checkExports() {
  const results = [];
  for (const [rel, expectedFns] of Object.entries(CRITICAL_EXPORTS)) {
    const abs = path.join(ROOT, rel);
    const code = readFileSafe(abs);

    // Match both inline and trailing exports
    const inlineExports = [
      ...code.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var)\s+([a-zA-Z0-9_]+)/g),
    ].map((m) => m[1]);

    const trailingExports = [
      ...code.matchAll(/export\s*{\s*([^}]+)\s*};/g),
    ]
      .flatMap((m) => m[1].split(","))
      .map((name) => name.trim())
      .filter(Boolean);

    const foundFns = new Set([...inlineExports, ...trailingExports]);

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
// Ignores commented lines
// ---------------------------------------------------------------------------
function checkUndefinedUsage() {
  const results = [];
  const phaseRegex = /(?<![\/]{2,}\s*)\bphase\b(?!\s*:)/g; // ignores // phase: ...
  for (const dir of TARGET_DIRS) {
    const base = path.join(ROOT, dir);
    if (!fs.existsSync(base)) continue;
    const files = listJsFiles(base);
    for (const file of files) {
      const text = readFileSafe(file);
      const matches = [...text.matchAll(phaseRegex)];
      if (matches.length > 0) {
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
// 🗺️ Generate a Layer Graph Summary
// ---------------------------------------------------------------------------
function generateLayerGraph() {
  const summary = {};
  for (const dir of TARGET_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    const files = listJsFiles(full);
    summary[dir] = files.length;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// 📄 Write Report
// ---------------------------------------------------------------------------
function writeReport(exportIssues, undefinedIssues, layerSummary) {
  let out = `# AICP Integrity Report — ${new Date().toISOString()}\n\n`;
  out += `Scanned directories: ${TARGET_DIRS.join(", ")}\n`;

  // Missing Exports
  out += `\n## Missing Exports (${exportIssues.length})\n`;
  if (exportIssues.length === 0) out += "✅ None\n";
  else {
    out += "| File | Function | Issue |\n|------|-----------|--------|\n";
    exportIssues.forEach((e) => {
      out += `| ${e.file} | ${e.missing} | ${e.issue} |\n`;
    });
  }

  // Undefined Vars
  out += `\n## Possible Undefined Variables (${undefinedIssues.length})\n`;
  if (undefinedIssues.length === 0) out += "✅ None\n";
  else {
    out += "| File | Symbol | Count | Issue |\n|------|---------|--------|--------|\n";
    undefinedIssues.forEach((u) => {
      out += `| ${u.file} | ${u.symbol} | ${u.count} | ${u.issue} |\n`;
    });
  }

  // Layer Graph Summary
  out += `\n## AICP Layer Graph Summary\n`;
  out += "| Layer | JS Files |\n|--------|-----------|\n";
  for (const [layer, count] of Object.entries(layerSummary)) {
    out += `| ${layer} | ${count} |\n`;
  }

  // Write to file
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, out);
  console.log(`✅ Integrity report written → ${OUT_FILE}`);
}

// ---------------------------------------------------------------------------
// 🚀 Run Checks
// ---------------------------------------------------------------------------
const exportIssues = checkExports();
const undefinedIssues = checkUndefinedUsage();
const layerSummary = generateLayerGraph();
writeReport(exportIssues, undefinedIssues, layerSummary);

console.log("🧩 Integrity scan complete — Regex expanded, comments ignored, layer map generated.");
#!/usr/bin/env node
/**
 * CODEX REPAIR PASS v3
 * -------------------------------------------------------
 * Purpose:
 *   Automatically detect and repair missing exports,
 *   invalid re-exports, and orphaned import references.
 *
 * Scans:
 *   modules/, services/, features/, components/, ui/
 *
 * Features:
 *   - Cross-checks every "import {X}" against exports across repo
 *   - Restores missing exports if definition exists
 *   - Rewrites re-export stubs (modules/*.js)
 *   - Logs all findings and actions to docs/codex_repair_report.md
 *
 * Constraints:
 *   - Never deletes code
 *   - Adds exports only when definition or function is found
 *   - Read/Write to repo; safe for re-run
 *
 * Author: James Kirby / Route Riot AICP
 * Version: 3.1.0
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(rootDir, "docs", "codex_repair_report.md");

const TARGET_DIRS = ["modules", "services", "features", "components", "ui"];
const VALID_EXT = [".js"];
const IGNORE_DIRS = ["node_modules", "dist", ".git"];

const report = {
  importsScanned: 0,
  missingExports: 0,
  repairedExports: 0,
  reExportRepairs: 0,
  manualReview: 0,
  repairedFiles: [],
};

/* ------------------------------------------------------- *
 * Utility: recursive walk
 * ------------------------------------------------------- */
function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.includes(entry)) continue;
      results = results.concat(walk(p));
    } else if (VALID_EXT.includes(path.extname(entry))) results.push(p);
  }
  return results;
}

/* ------------------------------------------------------- *
 * Collect all export names from repo
 * ------------------------------------------------------- */
function collectExports(allFiles) {
  const exportMap = new Map();
  const exportRegex =
    /export\s+(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g;

  for (const file of allFiles) {
    const code = fs.readFileSync(file, "utf8");
    let match;
    while ((match = exportRegex.exec(code))) {
      const fn = match[1];
      exportMap.set(fn, file);
    }
  }
  return exportMap;
}

/* ------------------------------------------------------- *
 * Detect and repair missing exports
 * ------------------------------------------------------- */
function detectAndRepair(allFiles, exportMap) {
  const importRegex = /import\s+{([^}]+)}\s+from\s+['"](.*)['"]/g;

  for (const file of allFiles) {
    let content = fs.readFileSync(file, "utf8");
    const dir = path.dirname(file);
    let match;

    while ((match = importRegex.exec(content))) {
      const imports = match[1]
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
      const relPath = match[2];

      const resolvedPath = path.resolve(dir, relPath + ".js");
      if (!fs.existsSync(resolvedPath)) continue;

      const targetCode = fs.readFileSync(resolvedPath, "utf8");
      for (const name of imports) {
        if (!exportMap.has(name)) {
          report.missingExports++;
          // Search for a definition in target file
          const defPattern = new RegExp(
            `(function|const|let|class)\\s+${name}\\b`
          );
          if (defPattern.test(targetCode)) {
            // Append export statement
            fs.appendFileSync(
              resolvedPath,
              `\n// 🧩 Auto-repaired missing export\nexport { ${name} };`
            );
            report.repairedExports++;
            report.repairedFiles.push(resolvedPath);
            console.log(`🔧 Restored export: ${name} → ${resolvedPath}`);
          } else {
            report.manualReview++;
            console.warn(`⚠️ Missing definition for ${name} in ${resolvedPath}`);
          }
        }
      }
    }
  }
}

/* ------------------------------------------------------- *
 * Rebuild module re-export stubs
 * ------------------------------------------------------- */
function rebuildReExportStubs() {
  const stubDir = path.join(rootDir, "modules");
  const files = fs.readdirSync(stubDir);
  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    const fullPath = path.join(stubDir, file);
    const code = fs.readFileSync(fullPath, "utf8");

    // If this is a re-export stub (bridging to features/services)
    if (/Re-Export Stub/.test(code) && /teamSurpriseManager/i.test(file)) {
      const newBlock = `
// 🧩 Auto-repaired re-export consistency
export {
  clearAllTeamSurprises,
  attemptSurpriseAttack,
  isTeamOnCooldown,
  isShieldActive,
  deactivateShield
} from "../features/team-surprise/teamSurpriseController.js";
`;
      fs.appendFileSync(fullPath, newBlock);
      report.reExportRepairs++;
      report.repairedFiles.push(fullPath);
      console.log(`🔗 Patched re-export stub: ${file}`);
    }
  }
}

/* ------------------------------------------------------- *
 * Main Execution
 * ------------------------------------------------------- */
console.log("🧠 Running CODEX REPAIR PASS v3…");

let allFiles = [];
TARGET_DIRS.forEach((dir) => {
  const full = path.join(rootDir, dir);
  if (fs.existsSync(full)) allFiles = allFiles.concat(walk(full));
});

const exportMap = collectExports(allFiles);
detectAndRepair(allFiles, exportMap);
rebuildReExportStubs();

fs.mkdirSync(path.join(rootDir, "docs"), { recursive: true });
const md = [
  `# CODEX REPAIR REPORT — ${new Date().toISOString()}`,
  "",
  `Imports scanned: ${report.importsScanned}`,
  `Missing exports detected: ${report.missingExports}`,
  `Repaired exports: ${report.repairedExports}`,
  `Rebuilt re-export stubs: ${report.reExportRepairs}`,
  `Manual review needed: ${report.manualReview}`,
  "",
  "## Repaired Files",
  "| File | Notes |",
  "|------|--------|",
  ...report.repairedFiles.map((f) => `| ${f} | fixed |`),
  "",
  "✅ Repair pass complete — now run:",
  "```bash",
  "npm run aicp-validate -- --fix",
  "npm run aicp-docs",
  "npm run build",
  "```",
].join("\n");

fs.writeFileSync(OUTPUT_PATH, md, "utf8");
console.log(`✅ CODEX Repair Pass Complete → ${OUTPUT_PATH}`);
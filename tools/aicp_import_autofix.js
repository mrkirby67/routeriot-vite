#!/usr/bin/env node
/**
 * AICP Import Autofix + Workspace Cleaner
 * -------------------------------------------------------
 * - Repairs malformed AICP metadata markers (# → //)
 * - Normalizes import path casing and fixes legacy refs
 * - Removes duplicate metadata blocks
 * - Cleans Gemini/VS backup artifacts (.bak, .backup)
 * - Writes full Markdown report under docs/aicp_import_autofix_report.md
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
const OUTPUT_PATH = path.join(rootDir, "docs", "aicp_import_autofix_report.md");

const TARGET_DIRS = ["modules", "services", "features", "components", "ui"];
const VALID_EXT = [".js"];
const IGNORE_DIRS = ["node_modules", "dist", ".git"];

const LEGACY_MAP = {
  "modules/teamSurpriseManager.js":
    "features/team-surprise/teamSurpriseController.js",
  "components/FlatTireControl/flatTireControlController.js":
    "features/flat-tire/flatTireController.js",
};

const CASE_REPLACEMENTS = [
  { pattern: /Components\//g, replace: "components/" },
  { pattern: /Features\//g, replace: "features/" },
  { pattern: /Services\//g, replace: "services/" },
  { pattern: /Ui\//g, replace: "ui/" },
];

const stats = {
  scanned: 0,
  fixedAICP: 0,
  fixedCasing: 0,
  fixedLegacy: 0,
  removedDupes: 0,
  manualReview: 0,
  deletedBackups: 0,
};

const reportLines = [];

/* ------------------------------------------------------- *
 * Directory Walk Helper
 * ------------------------------------------------------- */
function walk(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.includes(entry)) continue;
      results = results.concat(walk(p));
    } else if (VALID_EXT.includes(path.extname(entry))) {
      results.push(p);
    } else if (entry.match(/\.bak|\.backup|~$/i)) {
      // Delete stray backup files
      try {
        fs.unlinkSync(p);
        stats.deletedBackups++;
        reportLines.push(`| ${p} | 🗑️ deleted-backup | Old .bak/.backup file removed |`);
      } catch (e) {
        reportLines.push(`| ${p} | ⚠️ | Failed to delete backup: ${e.message} |`);
      }
    }
  }
  return results;
}

/* ------------------------------------------------------- *
 * Core File Processor
 * ------------------------------------------------------- */
function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  const orig = content;

  // 1️⃣ Fix malformed AICP comment markers (# → //)
  if (/# === AI-CONTEXT-MAP/.test(content)) {
    content = content.replace(/# === AI-CONTEXT-MAP/g, "// === AI-CONTEXT-MAP");
    stats.fixedAICP++;
  }
  if (/^#\s+/m.test(content)) {
    content = content.replace(/^#\s+/gm, "// ");
    stats.fixedAICP++;
  }

  // 2️⃣ Normalize casing in import paths
  CASE_REPLACEMENTS.forEach(({ pattern, replace }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replace);
      stats.fixedCasing++;
    }
  });

  // 3️⃣ Replace legacy imports
  for (const [legacy, modern] of Object.entries(LEGACY_MAP)) {
    const legacyRegex = new RegExp(legacy.replace(/\//g, "\\/"), "g");
    if (legacyRegex.test(content)) {
      content = content.replace(legacyRegex, modern);
      stats.fixedLegacy++;
    }
  }

  // 4️⃣ Remove duplicate AICP metadata blocks
  const headerMatches = content.match(/=== AI-CONTEXT-MAP ===/g) || [];
  if (headerMatches.length > 1) {
    const first = content.indexOf("// === AI-CONTEXT-MAP ===");
    const last = content.lastIndexOf("// === AI-CONTEXT-MAP ===");
    content =
      content.slice(0, first) +
      content
        .slice(first, last)
        .replace(/\/\/ === AI-CONTEXT-MAP ===[\s\S]*?\/\/ === END ===/m, "") +
      content.slice(last);
    stats.removedDupes++;
  }

  // 5️⃣ Append .js to bare imports if that file exists
  content = content.replace(
    /from\s+["'](\.{1,2}\/[^"']+?)(?=["'])["']/g,
    (match, p1) => {
      const abs = path.resolve(path.dirname(filePath), `${p1}.js`);
      if (fs.existsSync(abs)) return `from "${p1}.js"`;
      return match;
    }
  );

  if (content !== orig) {
    fs.writeFileSync(filePath, content, "utf8");
    reportLines.push(`| ${filePath} | fixed | Metadata/import normalized |`);
  }

  stats.scanned++;
}

/* ------------------------------------------------------- *
 * Main Execution
 * ------------------------------------------------------- */
console.log("🧩 Running AICP Import Autofix + Workspace Cleaner…");

let allFiles = [];
TARGET_DIRS.forEach((dir) => {
  const full = path.join(rootDir, dir);
  if (fs.existsSync(full)) allFiles = allFiles.concat(walk(full));
});

allFiles.forEach((file) => {
  try {
    processFile(file);
  } catch (err) {
    console.warn(`⚠️ Failed to process ${file}:`, err.message);
    stats.manualReview++;
    reportLines.push(`| ${file} | ⚠️ | ${err.message} |`);
  }
});

fs.mkdirSync(path.join(rootDir, "docs"), { recursive: true });
const md = [
  `# AICP Import Autofix + Workspace Cleanup Report — ${new Date().toISOString()}`,
  "",
  `Files scanned: ${stats.scanned}`,
  `Fixed malformed AICP markers: ${stats.fixedAICP}`,
  `Fixed casing issues: ${stats.fixedCasing}`,
  `Rewritten legacy imports: ${stats.fixedLegacy}`,
  `Removed duplicate metadata blocks: ${stats.removedDupes}`,
  `Deleted backup files: ${stats.deletedBackups}`,
  `Manual review needed: ${stats.manualReview}`,
  "",
  "## Actions Taken",
  "| File | Action | Description |",
  "|------|---------|-------------|",
  ...reportLines,
  "",
  "✅ Autofix complete — now run:",
  "```bash",
  "npm run aicp-validate -- --fix",
  "npm run aicp-docs",
  "npm run build",
  "```",
].join("\n");

fs.writeFileSync(OUTPUT_PATH, md, "utf8");
console.log(`✅ Autofix + Cleanup complete → ${OUTPUT_PATH}`);
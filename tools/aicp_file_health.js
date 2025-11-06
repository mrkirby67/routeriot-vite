#!/usr/bin/env node
/**
 * AICP FILE HEALTH ANALYSIS TOOL
 * --------------------------------------------
 * Scans project JS files for size, line count, comment ratio, and rough complexity.
 * Produces a Markdown summary at docs/aicp_file_health_report.md.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "docs", "aicp_file_health_report.md");

const TARGET_DIRS = ["modules", "services", "features", "components", "ui"];
const EXCLUDES = ["node_modules", "dist", ".git", "bak"];
const EXT = ".js";

let report = [];

// Simple complexity heuristic
function analyzeCode(text) {
  const lines = text.split("\n");
  const commentLines = lines.filter((l) => l.trim().startsWith("//")).length;
  const functions = (text.match(/function\s+|=>/g) || []).length;
  const branches = (text.match(/\b(if|else|for|while|switch|case)\b/g) || []).length;
  return {
    lines: lines.length,
    commentPct: Math.round((commentLines / lines.length) * 100),
    complexity: functions + branches,
  };
}

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (EXCLUDES.some((e) => full.includes(e))) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files = files.concat(walk(full));
    else if (path.extname(entry) === EXT) files.push(full);
  }
  return files;
}

function run() {
  console.log("📊 Running AICP File Health Analysis...");
  let allFiles = [];
  for (const d of TARGET_DIRS) {
    const dir = path.join(ROOT, d);
    if (fs.existsSync(dir)) allFiles = allFiles.concat(walk(dir));
  }

  for (const file of allFiles) {
    const text = fs.readFileSync(file, "utf8");
    const { lines, commentPct, complexity } = analyzeCode(text);
    const sizeKB = (Buffer.byteLength(text, "utf8") / 1024).toFixed(1);
    report.push({ file, lines, commentPct, complexity, sizeKB });
  }

  report.sort((a, b) => b.lines - a.lines);

  const md = [
    `# AICP File Health Report — ${new Date().toISOString()}`,
    `Files scanned: ${report.length}`,
    "",
    "| Status | File | Lines | Size (KB) | Complexity | Comment % |",
    "|----|------|--------|-----------|-------------|------------|",
    ...report.map(
      (r) =>
        `| ${r.lines > 600 ? "⚠️" : "✅"} | ${r.file.replace(ROOT + "/", "")} | ${r.lines} | ${r.sizeKB} | ${r.complexity} | ${r.commentPct}% |`
    ),
    "",
    "## Largest 10 Files",
    ...report
      .slice(0, 10)
      .map(
        (r) =>
          `- ${r.file.replace(ROOT + "/", "")} — ${r.lines} lines, ${r.sizeKB} KB (Complexity: ${r.complexity})`
      ),
  ].join("\n");

  fs.mkdirSync(path.join(ROOT, "docs"), { recursive: true });
  fs.writeFileSync(OUTPUT, md);
  console.log(`✅ Report written to ${OUTPUT}`);
}

run();
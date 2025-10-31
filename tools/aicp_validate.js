#!/usr/bin/env node
/**
 * AICP Validation & Auto-Repair Script
 * -----------------------------------
 * Validates all JS files for AICP v3 headers/footers and optionally fixes issues.
 * Usage:
 *   npm run aicp-validate          → validate only
 *   npm run aicp-validate -- --fix → validate + repair missing metadata
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, "docs/aicp_validation_report.md");
const TEMPLATE_HEADER = path.join(ROOT, ".aicp/templates/aicp_header.txt");
const TEMPLATE_FOOTER = path.join(ROOT, ".aicp/templates/aicp_footer.yaml");
const dirs = ["services", "features", "components", "ui"];
const requiredFooterKeys = ["ai_role", "phase", "aicp_version"];
const args = process.argv.slice(2);
const FIX_MODE = args.includes("--fix");

// Load templates
const canonicalHeader = fs.existsSync(TEMPLATE_HEADER)
  ? fs.readFileSync(TEMPLATE_HEADER, "utf8")
  : "";
const canonicalFooter = fs.existsSync(TEMPLATE_FOOTER)
  ? fs.readFileSync(TEMPLATE_FOOTER, "utf8")
  : "";

if (!fs.existsSync("docs")) fs.mkdirSync("docs");

// Recursive file finder
function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(full);
    if (entry.isFile() && full.endsWith(".js")) return full;
    return [];
  });
}

// Validate or repair a single file
function validateFile(file) {
  let text = fs.readFileSync(file, "utf8");
  const hasHeader = text.includes("AICP v3") || text.includes("// AICP");
  const hasFooter = /ai_role|aicp_version|phase/.test(text);
  let status = "✅ OK";
  let note = "";

  if (!hasHeader && !hasFooter) {
    status = "❌";
    note = "Missing header and footer";
  } else if (!hasHeader) {
    status = "❌";
    note = "Missing header";
  } else if (!hasFooter) {
    status = "❌";
    note = "Missing footer";
  } else {
    for (const key of requiredFooterKeys) {
      if (!text.includes(key)) {
        status = "⚠️";
        note = `Footer missing key: ${key}`;
        break;
      }
    }
  }

  // ---- AUTO-REPAIR ----
  if (FIX_MODE && status !== "✅ OK") {
    let changed = false;

    // Header repair
    if (!hasHeader && canonicalHeader) {
      text = `${canonicalHeader}\n${text}`;
      changed = true;
    }

    // Footer repair
    if (!hasFooter && canonicalFooter) {
      text = `${text.trim()}\n${canonicalFooter}\n`;
      changed = true;
    }

    // Replace malformed footer
    if (hasFooter && status === "⚠️" && canonicalFooter) {
      const footerRegex = /# ---[\s\S]*$/m;
      text = text.replace(footerRegex, canonicalFooter);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(file, text, "utf8");
      note += " (auto-repaired)";
      status = "🛠️ Fixed";
    }
  }

  return { file, status, note };
}

// Run validation across directories
let results = [];
for (const dir of dirs) {
  const fullDir = path.join(ROOT, dir);
  for (const file of findFiles(fullDir)) {
    results.push(validateFile(file));
  }
}

// Summarize results
const summary = {
  scanned: results.length,
  ok: results.filter((r) => r.status === "✅ OK").length,
  warnings: results.filter((r) => r.status === "⚠️").length,
  errors: results.filter((r) => r.status === "❌").length,
  fixed: results.filter((r) => r.status === "🛠️ Fixed").length,
};

// Build Markdown report
const report = [
  `# AICP Validation Report — ${new Date().toISOString()}`,
  `Files scanned: ${summary.scanned}`,
  `✅ OK: ${summary.ok}`,
  `⚠️ Warnings: ${summary.warnings}`,
  `❌ Errors: ${summary.errors}`,
  `🛠️ Fixed: ${summary.fixed}`,
  "",
  "| File | Status | Note |",
  "|------|---------|------|",
  ...results.map(
    (r) =>
      `| ${r.file.replace(ROOT + "/", "")} | ${r.status} | ${r.note || ""} |`
  ),
  "",
  `Template header hash: ${canonicalHeader.length} chars`,
  `Template footer hash: ${canonicalFooter.length} chars`,
].join("\n");

fs.writeFileSync(OUT_PATH, report);
console.log(
  `✅ Validation ${FIX_MODE ? "+ auto-repair " : ""}complete → ${OUT_PATH}`
);
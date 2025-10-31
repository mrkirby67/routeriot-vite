#!/usr/bin/env node
/**
 * AICP Tier-4 Documentation Exporter
 * ----------------------------------
 * Reads AICP v3 metadata headers + footers and builds Markdown docs
 * in docs/aicp_summary/, grouped by layer (services, features, components, ui).
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/aicp_summary");
const REPORT = path.join(ROOT, "docs/aicp_doc_export_report.md");
const layers = ["services", "features", "components", "ui"];
if (!fs.existsSync("docs")) fs.mkdirSync("docs");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function findJS(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return findJS(full);
    if (d.isFile() && full.endsWith(".js")) return full;
    return [];
  });
}

function parseMeta(text) {
  const footerMatch = text.match(/# ---[\s\S]*$/m);
  if (!footerMatch) return null;
  const meta = {};
  footerMatch[0]
    .split("\n")
    .map((l) => l.trim())
    .forEach((l) => {
      const m = l.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2];
    });
  return meta;
}

let results = [];
for (const layer of layers) {
  for (const file of findJS(path.join(ROOT, layer))) {
    const text = fs.readFileSync(file, "utf8");
    const meta = parseMeta(text);
    results.push({ file, meta });
  }
}

// Build per-file markdown
for (const { file, meta } of results) {
  const rel = file.replace(ROOT + "/", "");
  const outFile = path.join(OUT_DIR, rel + ".md");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const md = [
    `# ${rel}`,
    "",
    meta
      ? Object.entries(meta)
          .map(([k, v]) => `- **${k}:** ${v}`)
          .join("\n")
      : "_⚠️ No AICP metadata found_",
    "",
  ].join("\n");
  fs.writeFileSync(outFile, md);
}

// Build index
const index = [
  `# AICP Summary Index — ${new Date().toISOString()}`,
  "",
  ...layers.map((layer) => {
    const subset = results.filter((r) => r.file.includes(`/${layer}/`));
    return `## ${layer.toUpperCase()} (${subset.length})\n` +
      subset
        .map((r) => {
          const rel = r.file.replace(ROOT + "/", "");
          return `- [${rel}](./${rel}.md)`;
        })
        .join("\n");
  }),
].join("\n\n");
fs.writeFileSync(path.join(OUT_DIR, "INDEX.md"), index);

// Summary report
const summary = [
  `# AICP Doc Export Report — ${new Date().toISOString()}`,
  `Files scanned: ${results.length}`,
  `Docs generated: ${results.length}`,
  "",
  `Output folder: ${OUT_DIR}`,
].join("\n");
fs.writeFileSync(REPORT, summary);

console.log(`✅ Docs exported → ${OUT_DIR}`);
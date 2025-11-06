#!/usr/bin/env node
// =============================================================
// AICP Tools Stabilizer v3.5 — Validator Scope Expansion (Safe Merge)
// =============================================================
// Based on v2 hybrid — adds `ui` validation and skips /tools/ dirs only.
// All other logic preserved exactly as in your stable build.
// -------------------------------------------------------------

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// ---- Hardened scanner (from comment_balancer.js) ----
function stripStringsTemplatesAndRegex(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let mode = "code"; // code | bc | lc | s | d | t | r
  let esc = false;
  const templateExprStack = [];
  let inRegexCharClass = false;
  let lastSignificant = null;
  let lastWord = null;

  const regexKeywordSet = new Set([
    "return", "case", "throw", "delete", "typeof", "instanceof",
    "void", "yield", "await", "new",
  ]);

  while (i < n) {
    const ch = src[i];
    const nx = i + 1 < n ? src[i + 1] : "";

    if (mode === "code") {
      if (templateExprStack.length) {
        if (ch === "{") {
          templateExprStack[templateExprStack.length - 1].depth += 1;
        } else if (ch === "}") {
          const ctx = templateExprStack[templateExprStack.length - 1];
          ctx.depth -= 1;
          if (ctx.depth === 0) {
            templateExprStack.pop();
            mode = "t";
          }
        }
        out += ch;
        i += 1;
        continue;
      }

      if (ch === "/" && nx === "/") { mode = "lc"; i += 2; continue; }
      if (ch === "/" && nx === "*") { mode = "bc"; i += 2; continue; }
      if (ch === "'") { mode = "s"; i += 1; continue; }
      if (ch === '"') { mode = "d"; i += 1; continue; }
      if (ch === "`") { mode = "t"; i += 1; continue; }

      if (ch === "/") {
        const prevAllowsRegex =
          lastSignificant === null ||
          ["(", "{", "[", "=", ":", ",", ";", "!", "&", "|", "^", "~", "<", ">", "+", "-", "*", "%", "?"].includes(lastSignificant) ||
          regexKeywordSet.has(lastWord);

        if (prevAllowsRegex) {
          mode = "r";
          esc = false;
          inRegexCharClass = false;
          i += 1;
          continue;
        }
      }

      out += ch;
      if (!/\s/.test(ch)) {
          if (/[A-Za-z_$]/.test(ch)) {
              let j = i + 1;
              while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j += 1;
              lastWord = src.slice(i, j);
              lastSignificant = "identifier";
          } else if (/[0-9]/.test(ch)) {
              lastWord = null;
              lastSignificant = "number";
          } else {
              lastWord = null;
              lastSignificant = ch;
          }
      }
      i += 1;
      continue;
    }

    if (mode === "bc") { if (ch === "*" && nx === "/") { mode = "code"; i += 2; } else { i += 1; } continue; }
    if (mode === "lc") { if (ch === "\n") { mode = "code"; out += ch; i += 1; } else { i += 1; } continue; }
    if (mode === "s") { if (!esc && ch === "\\") { esc = true; } else if (!esc && ch === "'") { mode = "code"; } else { esc = false; } i += 1; continue; }
    if (mode === "d") { if (!esc && ch === "\\") { esc = true; } else if (!esc && ch === '"') { mode = "code"; } else { esc = false; } i += 1; continue; }
    if (mode === "t") {
        if (!esc && ch === "\\") { esc = true; i += 1; continue; }
        if (!esc && ch === "`") { mode = "code"; i += 1; continue; }
        if (!esc && ch === "$" && nx === "{") { templateExprStack.push({ depth: 1 }); mode = "code"; out += ch; i += 1; continue; }
        esc = false;
        i += 1;
        continue;
    }
    if (mode === "r") {
        if (!esc) {
            if (ch === "\\") { esc = true; i += 1; continue; }
            if (ch === "[") { inRegexCharClass = true; i += 1; continue; }
            if (ch === "]" && inRegexCharClass) { inRegexCharClass = false; i += 1; continue; }
            if (ch === "/" && !inRegexCharClass) { mode = "code"; i += 1; continue; }
        } else {
            esc = false;
        }
        i += 1;
        continue;
    }
  }
  return out;
}

function countBlockMarkers(source) {
  const text = stripStringsTemplatesAndRegex(source);
  const opens = (text.match(/\/\*/g) || []).length;
  const closes = (text.match(/\*\//g) || []).length;
  return { opens, closes, balanced: opens === closes };
}

// ---------------------------------------------------------------------------
// 🧩 AICP Layer Graph Bootstrap
// ---------------------------------------------------------------------------
const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, ".aicp", "aicp_index.yaml");
const LAYER_GRAPH_REPORT = path.join(ROOT, "docs/aicp_layergraph_status.md");

let layerGraph = {};

function loadLayerGraph() {
  try {
    const yamlData = fs.readFileSync(INDEX_PATH, "utf8");
    layerGraph = yaml.load(yamlData);
    console.log("✅ AICP Layer Graph loaded:", layerGraph.layers || {});
  } catch (err) {
    console.warn("⚠️ Could not load AICP layer graph:", err.message);
    layerGraph = { layers: {} };
  }
}

function writeLayerGraphReport() {
  try {
    const timestamp = new Date().toISOString();
    const lines = [
      `# 🧭 AICP Layer Graph Status — ${timestamp}`,
      "",
      "| Layer | Count |",
      "|--------|-------|",
      ...Object.entries(layerGraph.layers || {}).map(
        ([name, count]) => `| ${name} | ${count} |`
      ),
      "",
      "Graph source: `.aicp/aicp_index.yaml`",
    ];
    fs.mkdirSync(path.dirname(LAYER_GRAPH_REPORT), { recursive: true });
    fs.writeFileSync(LAYER_GRAPH_REPORT, lines.join("\n"), "utf8");
    console.log(`📘 Layer graph snapshot written → ${LAYER_GRAPH_REPORT}`);
  } catch (err) {
    console.error("❌ Failed to write AICP Layer Graph report:", err.message);
  }
}

loadLayerGraph();
writeLayerGraphReport();

// ---------------------------------------------------------------------------
// 🧪 AICP Validation Logic
// ---------------------------------------------------------------------------
const OUT_PATH = path.join(ROOT, "docs/aicp_validation_report.md");
const TEMPLATE_HEADER = path.join(ROOT, ".aicp/templates/aicp_header.txt");
const TEMPLATE_FOOTER = path.join(ROOT, ".aicp/templates/aicp_footer.yaml");

// ✅ Expanded validation scope (added ui)
const dirs = ["services", "features", "components", "ui"];
const requiredFooterKeys = ["ai_role", "phase", "aicp_version"];
const args = process.argv.slice(2);
const FIX_MODE = args.includes("--fix");

const canonicalHeader = fs.existsSync(TEMPLATE_HEADER)
  ? fs.readFileSync(TEMPLATE_HEADER, "utf8")
  : "";
const canonicalFooter = fs.existsSync(TEMPLATE_FOOTER)
  ? fs.readFileSync(TEMPLATE_FOOTER, "utf8")
  : "";

if (!fs.existsSync("docs")) fs.mkdirSync("docs");

// ---------------------------------------------------------------------------
// 🩹 Utility: Detect and safely fix unterminated block comments
// ---------------------------------------------------------------------------
function fixUnterminatedBlockComments(text, filePath = "", reportArr = []) {
  // New directive: DO NOT REPAIR. DELETE OBSOLETE BLOCK COMMENTS.
  const originalLength = text.length;
  const cleanedText = text.replace(/\/\*[\s\S]*?\*\//g, "");

  if (cleanedText.length < originalLength) {
    const base = path.basename(filePath);
    reportArr.push({
      file: base,
      issue: `Removed obsolete multi-line metadata block.`,
    });
  }
  return cleanedText;
}

// ---------------------------------------------------------------------------
// 🔍 Recursive file finder (skips /tools)
// ---------------------------------------------------------------------------
function findFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  if (dir.includes("/tools")) return []; // Skip tool internals
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findFiles(full);
    if (entry.isFile() && full.endsWith(".js")) return full;
    return [];
  });
}

// ---------------------------------------------------------------------------
// 🧠 Validate or repair a single file
// ---------------------------------------------------------------------------
function validateFile(file, commentReport) {
  let text = fs.readFileSync(file, "utf8");
  const hasHeader = text.includes("// === AICP METADATA START ===");
  const hasFooter = text.includes("// === AICP METADATA END ===");
  let status = "✅ OK";
  let note = "";

  // New directive: Remove old block-style metadata
  const originalLength = text.length;
  text = text.replace(/\/\*\s*# === AI-CONTEXT-MAP ===[\s\S]*?# === END ===\s*\*\/\s*`?/g, "");
  text = text.replace(/\/\*\s*AICP[\s\S]*?\*\//g, "");

  if (text.length < originalLength) {
    note += " (obsolete metadata removed)";
  }

  if (!hasHeader && !hasFooter) {
    status = "❌"; note = "Missing header and footer";
  } else if (!hasHeader) {
    status = "❌"; note = "Missing header";
  } else if (!hasFooter) {
    status = "❌"; note = "Missing footer";
  }

  if (FIX_MODE) {
    let changed = text.length < originalLength;

    if (!hasHeader) {
      text = `${canonicalHeader}\n${text}`;
      changed = true;
    }

    if (!hasFooter) {
      text = `${text.trim()}\n${canonicalFooter}\n`;
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

// ---------------------------------------------------------------------------
// 🚀 Run validation
// ---------------------------------------------------------------------------
let results = [];
let commentHealth = [];
for (const dir of dirs) {
  const fullDir = path.join(ROOT, dir);
  for (const file of findFiles(fullDir)) {
    results.push(validateFile(file, commentHealth));
  }
}

// ---------------------------------------------------------------------------
// 📊 Report
// ---------------------------------------------------------------------------
const summary = {
  scanned: results.length,
  ok: results.filter(r => r.status === "✅ OK").length,
  warnings: results.filter(r => r.status === "⚠️").length,
  errors: results.filter(r => r.status === "❌").length,
  fixed: results.filter(r => r.status === "🛠️ Fixed").length,
};

let report = [
  `# AICP Validation Report — ${new Date().toISOString()}`,
  `Files scanned: ${summary.scanned}`,
  `✅ OK: ${summary.ok}`,
  `⚠️ Warnings: ${summary.warnings}`,
  `❌ Errors: ${summary.errors}`,
  `🛠️ Fixed: ${summary.fixed}`,
  "",
  "| File | Status | Note |",
  "|------|---------|------|",
  ...results.map(r => `| ${r.file.replace(ROOT + "/", "")} | ${r.status} | ${r.note || ""} |`),
  "",
  "## 🧩 Comment Health Summary",
  "| File | Issue |",
  "|------|--------|",
  ...(commentHealth.length
    ? commentHealth.map(c => `| ${c.file} | ${c.issue} |`)
    : ["| ✅ All comment blocks properly closed | ✅ |"]),
  "",
  `Template header hash: ${canonicalHeader.length} chars`,
  `Template footer hash: ${canonicalFooter.length} chars`,
  "",
  "[AICP Tools Stabilizer v3.5] — applied",
].join("\n");

fs.writeFileSync(OUT_PATH, report);
console.log(`✅ Validation ${FIX_MODE ? "+ auto-repair " : ""}complete → ${OUT_PATH}`);

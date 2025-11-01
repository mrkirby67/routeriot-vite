#!/usr/bin/env node
/**
 * Route Riot — Codex Refresh (Safe Metadata Injector + Pre-Cleaner)
 * ------------------------------------------------------------------
 * Purpose:
 *  - Sync AICP v3 metadata across layers.
 *  - Sanitize files before and after injection.
 *  - Comment out stray '#' or '{{}}' syntax safely.
 *  - Prevent nested block-comment collisions caused by metadata markers.
 *  - Automatically trigger validation and doc regeneration if requested.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import yaml from "js-yaml";

const projectRoot = process.cwd();
const indexPath = path.join(projectRoot, ".aicp", "aicp_index.yaml");
const injectConfig = path.join(projectRoot, ".aicp", "inject_config.yaml");
const reportPath = path.join(projectRoot, "docs", "aicp_metadata_injection_report.md");
const autoHealReportPath = path.join(projectRoot, "docs", "aicp_codex_autoheal_report.md");

const TARGET_DIRS = ["components", "features", "services", "modules"];
const BAD_MARKERS = [
  "=== END-META ===",
  "# === AI-CONTEXT-MAP ===",
  "# === END ===",
  "{{phase}}",
  "{{category}}",
  "{{sync_state}}",
  "{{secondary_ai}}",
  "{{exports}}",
  "{{linked_files}}",
  "{{status}}"
];

const BUILD_ERROR_TRIGGERS = [
  /Failed to parse source for import analysis/i,
  /exports:\s*\/\*.*\{\{.*\}\}.*\*\//i,
  /linked_files:\s*\/\*.*\{\{.*\}\}.*\*\//i,
  /status:\s*\/\*.*\{\{.*\}\}.*\*\//i
];

function normalizeRelative(filePath) {
  if (!filePath) return null;
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectRoot, filePath);
  const relative = path.relative(projectRoot, resolved);
  return relative.startsWith("..") ? filePath : relative.replace(/\\/g, "/");
}

function runCommand(command, options = {}) {
  const { quiet = false } = options;
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe"
    });
    if (!quiet && output) process.stdout.write(output);
    return { success: true, output };
  } catch (error) {
    const stdout = error.stdout ? error.stdout.toString() : "";
    const stderr = error.stderr ? error.stderr.toString() : "";
    const combined = (stdout + stderr) || error.message || "";
    if (!quiet && combined) process.stdout.write(combined);
    return { success: false, output: combined };
  }
}

// ---------------------------------------------------------------------------
// 🔧 Utility functions
// ---------------------------------------------------------------------------
function readYaml(file) {
  try {
    return yaml.load(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`⚠️  Failed to read YAML: ${file}`);
    return null;
  }
}

function log(msg) {
  console.log(`[codex-refresh] ${msg}`);
}

function listJSFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) results.push(...listJSFiles(full));
    else if (file.endsWith(".js")) results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 🧹 Metadata Cleaner — used before injection to prevent syntax errors
// ---------------------------------------------------------------------------
function runPreClean() {
  try {
    log("🧹 Running metadata pre-cleaner…");
    BAD_MARKERS.forEach(marker => {
      const regex = new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      for (const dir of TARGET_DIRS) {
        const dirPath = path.join(projectRoot, dir);
        if (!fs.existsSync(dirPath)) continue;
        const files = listJSFiles(dirPath);
        for (const file of files) {
          let content = fs.readFileSync(file, "utf8");
          if (content.includes(marker)) {
            content = content.replace(regex, `// ${marker} (commented out)`);
            fs.writeFileSync(file, content, "utf8");
            console.log(`🧩 Pre-cleaned ${marker} → ${file}`);
          }
        }
      }
    });
    log("✅ Metadata pre-clean complete.");
  } catch (err) {
    log(`⚠️ Metadata pre-clean failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 🧩 Metadata Injection (Safe Mode)
// ---------------------------------------------------------------------------
function sanitizeMetadata(filePath, safeMode = false, depth = 1) {
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  // Convert invalid metadata markers to block comments
  content = content.replace(/^# === AI-CONTEXT-MAP ===/gm, "/** === AICP-METADATA ===");
  content = content.replace(/^(\s*)(phase:|aicp_category:|sync_state:|secondary:).*/gm, "$1// $&");

  // Terminate safely
  if (content.includes("/** === AICP-METADATA") && !content.includes("=== END-META ===")) {
    content += "\n// === END-META === */\n";
  }

  // Comment any remaining {{placeholders}}
  content = content.replace(/({{[^}]+}})/g, "/*$1*/");

  // 🧹 HARD CLEANUP — remove malformed metadata lines BEFORE fixing comments
  content = content.replace(
    /^[\s\/]*(exports|linked_files|status)\s*:\s*\/?\*+.*?\*+\/?.*$/gm,
    "// $1: sanitized placeholder"
  );

  // Catch *any* key with {{...}} style placeholder in value
  content = content.replace(
    /^[\s\/]*[A-Za-z0-9_]+\s*:\s*(\/?\*+)?\s*\{\{.*\}\}\s*(\*+\/)?/gm,
    "// sanitized metadata line"
  );

  // 🧹 Fix invalid nested comment sequences and malformed comment pairs
  content = content
    .replace(/\/\*+\s*\/\*+/g, "/*")
    .replace(/\*\/+\s*\*\/+/g, "*/")
    .replace(/(\/\*\s*){2,}/g, "/*")
    .replace(/(\*\/\s*){2,}/g, "*/")
    .replace(/\/\*\s*$/gm, "/**")
    .replace(/\/\*{2,}/g, "/*")
    .replace(/\*{2,}\//g, "*/");

  // 🔒 Normalize bare keys like `exports /* something */`
  content = content.replace(
    /^[ \t]*(exports|linked_files|status)\b(?!:)/gm,
    "// $1 sanitized (no colon)"
  );

  // 🧩 Run one extra pass if first pass changed content (for hidden corruption)
  if (content !== original) {
    if (!safeMode) fs.writeFileSync(filePath, content, "utf8");
    if (depth === 1) return sanitizeMetadata(filePath, safeMode, 2); // one recursive clean
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// 🧾 Report Writer
// ---------------------------------------------------------------------------
function writeReport(modified) {
  const timestamp = new Date().toISOString();
  const lines = [
    `# 🧩 AICP Metadata Injection Report — ${timestamp}`,
    "",
    "| File | Modified |",
    "|------|-----------|",
    ...modified.map(f => `| ${f} | ✅ |`),
    "",
    `Total Files Fixed: ${modified.length}`,
  ];
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
}

function parseBuildForMetadataErrors(output = "") {
  if (!output) return new Map();
  const results = new Map();
  const fileLinePattern = /([A-Za-z0-9_./\\-]+\.js)\s*\((\d+):\d+\)/g;
  const explicitFilePattern = /file:\s*([^\s]+\.js)(?::(\d+))?/g;

  let match;
  while ((match = fileLinePattern.exec(output)) !== null) {
    const rel = normalizeRelative(match[1]);
    const line = Number.parseInt(match[2], 10);
    if (!results.has(rel)) results.set(rel, new Set());
    if (!Number.isNaN(line)) results.get(rel).add(line);
  }

  while ((match = explicitFilePattern.exec(output)) !== null) {
    const rel = normalizeRelative(match[1]);
    const line = match[2] ? Number.parseInt(match[2], 10) : null;
    if (!results.has(rel)) results.set(rel, new Set());
    if (line && !Number.isNaN(line)) results.get(rel).add(line);
  }

  return results;
}

function scanProjectForProblemMarkers() {
  const offenders = new Map();
  const pattern = /^[ \t]*(exports|linked_files|status)\s*:\s*\/?\*+.*?\*+\/?.*$|^[ \t]*\w+\s*:.*\{\{.*\}\}.*$/gm;
  for (const dir of TARGET_DIRS) {
    const dirPath = path.join(projectRoot, dir);
    const files = listJSFiles(dirPath);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const rel = path.relative(projectRoot, file).replace(/\\/g, "/");
        const line = content.slice(0, match.index).split("\n").length;
        if (!offenders.has(rel)) offenders.set(rel, new Set());
        offenders.get(rel).add(line);
      }
    }
  }
  return offenders;
}

function applyMetadataSelfHeal(fileRelative) {
  if (!fileRelative) return null;
  const filePath = path.resolve(projectRoot, fileRelative);
  if (!fs.existsSync(filePath)) return null;

  const original = fs.readFileSync(filePath, "utf8");
  let content = original;
  let changed = false;
  const linesTouched = new Set();

  const placeholderPattern = /^[ \t]*(exports|linked_files|status)\s*:\s*\/?\*+.*?\*+\/?.*$/gm;
  content = content.replace(placeholderPattern, (match, key, offset, str) => {
    const line = str.slice(0, offset).split("\n").length;
    linesTouched.add(line);
    changed = true;
    return `// ${key}: sanitized placeholder`;
  });

  const placeholderValuePattern = /^[ \t]*([A-Za-z0-9_]+)\s*:\s*.*\{\{.*\}\}.*$/gm;
  content = content.replace(placeholderValuePattern, (match, _key, offset, str) => {
    const line = str.slice(0, offset).split("\n").length;
    linesTouched.add(line);
    changed = true;
    return "// sanitized metadata line";
  });

  const flattenPatterns = [
    { regex: /\/\*+\s*\/\*+/g, replacement: "/*" },
    { regex: /\*\/+\s*\*\/+/g, replacement: "*/" }
  ];

  const hashBlockPattern = /^[ \t]*# === AI-CONTEXT-MAP ===[\s\S]*?# === END ===/gm;
  content = content.replace(hashBlockPattern, (match, offset, str) => {
    const startLine = str.slice(0, offset).split("\n").length;
    const blockLines = match.split("\n").length;
    for (let i = 0; i < blockLines; i += 1) {
      linesTouched.add(startLine + i);
    }
    changed = true;
    return "// sanitized metadata block";
  });

  const hashMarkerPattern = /^[ \t]*#\s*===.*$/gm;
  content = content.replace(hashMarkerPattern, (match, offset, str) => {
    const line = str.slice(0, offset).split("\n").length;
    linesTouched.add(line);
    changed = true;
    return "// sanitized metadata marker";
  });

  for (const { regex, replacement } of flattenPatterns) {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      changed = true;
    }
  }

  if (content.includes("/** === AICP-METADATA") && !content.includes("=== END-META ===")) {
    content = `${content.trimEnd()}\n// === END-META === */\n`;
    linesTouched.add(content.split("\n").length);
    changed = true;
  }

  if (changed && content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    return {
      file: path.relative(projectRoot, filePath).replace(/\\/g, "/"),
      lines: Array.from(linesTouched).sort((a, b) => a - b)
    };
  }

  return null;
}

function runMetadataAutoHeal(buildOutput) {
  let offenders = parseBuildForMetadataErrors(buildOutput);
  const triggered = BUILD_ERROR_TRIGGERS.some((pattern) => pattern.test(buildOutput));

  if (!triggered && offenders.size === 0) {
    return { healed: [], triggered: false };
  }

  if (offenders.size === 0) {
    offenders = scanProjectForProblemMarkers();
  }

  const healed = [];
  for (const [file] of offenders) {
    const result = applyMetadataSelfHeal(file);
    if (result) healed.push(result);
  }

  return { healed, triggered: triggered || healed.length > 0 };
}

function writeAutoHealReport(entries, buildPassed) {
  const timestamp = new Date().toISOString();
  const lines = [
    `# AICP Codex Auto-Heal Report — ${timestamp}`,
    "",
    `Build Status: ${buildPassed ? "✅ PASS" : "⚠️ FAIL"}`,
    ""
  ];

  if (entries.length) {
    lines.push("| File | Lines |", "|------|-------|");
    for (const entry of entries) {
      const lineDisplay = entry.lines.length ? entry.lines.join(", ") : "—";
      lines.push(`| ${entry.file} | ${lineDisplay} |`);
    }
    lines.push("");
  } else {
    lines.push("No metadata repairs were required.", "");
  }

  lines.push(`Total Files Healed: ${entries.length}`);
  fs.mkdirSync(path.dirname(autoHealReportPath), { recursive: true });
  fs.writeFileSync(autoHealReportPath, lines.join("\n"), "utf8");
}

// ---------------------------------------------------------------------------
// MAIN EXECUTION
// ---------------------------------------------------------------------------
(async () => {
  log("🔁 Starting Codex Refresh (Safe Mode Enabled)");

  const index = readYaml(indexPath);
  const inject = readYaml(injectConfig);
  const safeMode = process.argv.includes("--safe");

  if (!index || !inject) {
    console.error("❌ Missing .aicp configuration — aborting refresh.");
    process.exit(1);
  }

  log(`Project: ${index.project || "Unknown"} (AICP v${index.version || "?"})`);
  log(
    `Linked layers: services=${index.layers.services}, features=${index.layers.features}, components=${index.layers.components}, ui=${index.layers.ui}`
  );

  // 🧹 1️⃣ Pre-clean any broken metadata blocks
  runPreClean();

  // 🧩 2️⃣ Re-apply safe metadata wrapping
  const modified = [];
  for (const dir of TARGET_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    const jsFiles = listJSFiles(fullPath);
    for (const f of jsFiles) {
      if (sanitizeMetadata(f, safeMode)) modified.push(path.relative(projectRoot, f));
    }
  }

  writeReport(modified);
  log(`🛡️  Metadata shield applied to ${modified.length} file(s)`);

  // 🧪 3️⃣ Validate and repair
  const repairResult = runCommand("npm run aicp-repair", { quiet: false });
  if (!repairResult.success) {
    log("⚠️  aicp-repair step failed — continuing…");
  }

  const initialValidate = runCommand("npm run aicp-validate -- --fix", { quiet: false });
  if (!initialValidate.success) {
    log("⚠️  aicp-validate step failed — continuing…");
  }

  let buildResult = runCommand("npm run build", { quiet: false });
  let healEntries = [];

  if (!buildResult.success) {
    log("⚠️  Build failure detected — checking for metadata issues…");
    const healOutcome = runMetadataAutoHeal(buildResult.output || "");
    healEntries = healOutcome.healed;

    if (healOutcome.triggered) {
      if (healEntries.length) {
        log(`🩺  Metadata auto-heal applied to ${healEntries.length} file(s). Re-validating…`);
      } else {
        log("ℹ️  Metadata auto-heal trigger detected, but no offending files were located.");
      }
      const revalidate = runCommand("npm run aicp-validate -- --fix", { quiet: false });
      if (!revalidate.success) {
        log("⚠️  Post-heal validation failed — continuing to build retry…");
      }
      buildResult = runCommand("npm run build", { quiet: false });
    }

    writeAutoHealReport(healEntries, buildResult.success);
  } else {
    writeAutoHealReport([], true);
  }

  if (!buildResult.success) {
    log("❌ Build failed after metadata auto-heal attempts.");
    process.exitCode = 1;
  }

  // 📚 4️⃣ Optional doc export
  const exportDocs = process.argv.includes("--export");
  if (exportDocs) {
    const exportResult = runCommand("npm run aicp-export", { quiet: false });
    if (!exportResult.success) {
      log("⚠️  aicp-export step failed — continuing…");
    }
  }

  log("✅ Codex Refresh complete. Metadata sanitized and synchronized.");
})();

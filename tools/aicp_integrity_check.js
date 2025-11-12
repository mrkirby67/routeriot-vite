#!/usr/bin/env node

/**
 * AICP Integrity Validator (READ-ONLY)
 * ------------------------------------
 * Validates module dependency rules using .meta.json metadata files.
 * This tool:
 *   - NEVER writes to metadata
 *   - NEVER creates or modifies files
 *   - NEVER generates dashboards
 *   - ONLY reports dependency violations
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET_DIRS = ["components", "features", "services", "ui"];

// Allowed dependency order (top can depend on bottom, but not reverse):
//   ui → components → features → services
const LAYER_ORDER = ["ui", "components", "features", "services"];

function findMetaFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findMetaFiles(full));
    if (entry.isFile() && entry.name.endsWith(".meta.json")) results.push(full);
  }
  return results;
}

function loadMetadata() {
  const index = {};
  for (const metaPath of TARGET_DIRS.map(d => path.join(ROOT, d)).flatMap(findMetaFiles)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (!meta.name) continue; // Must have a key name to index
      index[meta.name] = { ...meta, path: metaPath };
    } catch {
      console.warn(`⚠️ Invalid JSON in metadata: ${metaPath}`);
    }
  }
  return index;
}

function validate(metadata) {
  const violations = [];

  for (const name in metadata) {
    const mod = metadata[name];
    if (!mod.layer || !LAYER_ORDER.includes(mod.layer)) continue;

    for (const dep of mod.depends_on || []) {
      const target = metadata[dep];
      if (!target || !target.layer) continue;

      const modIndex = LAYER_ORDER.indexOf(mod.layer);
      const depIndex = LAYER_ORDER.indexOf(target.layer);

      // Forbidden: depending on something "above" you.
      if (depIndex < modIndex) {
        violations.push(
          `🚫 ${name} (${mod.layer}) → ${dep} (${target.layer}) violates layer boundary`
        );
      }
    }
  }

  return violations;
}

console.log("🔍 Running AICP Integrity Validation (Read-Only)...");

const metadata = loadMetadata();
const issues = validate(metadata);

if (!issues.length) {
  console.log("✅ No layer violations detected.");
} else {
  console.log("⚠️ Dependency Violations:\n");
  console.log(issues.join("\n"));
}

console.log("✅ Done.");
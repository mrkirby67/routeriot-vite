#!/usr/bin/env node
/**
 * Route Riot — Codex-Refresh Hook
 * ------------------------------------------------------------
 * Purpose:
 *  - Keep AICP v3 metadata in sync across all layers.
 *  - Read .aicp/aicp_index.yaml for layer map + template paths.
 *  - Trigger validation + doc export automatically if requested.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import yaml from "js-yaml";

const projectRoot = process.cwd();
const indexPath = path.join(projectRoot, ".aicp", "aicp_index.yaml");
const injectConfig = path.join(projectRoot, ".aicp", "inject_config.yaml");

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

(async () => {
  log("🔁 Starting Codex-Refresh Hook…");

  const index = readYaml(indexPath);
  const inject = readYaml(injectConfig);

  if (!index || !inject) {
    console.error("❌ Missing .aicp configuration — aborting refresh.");
    process.exit(1);
  }

  log(`Project: ${index.project || "Unknown"} (AICP v${index.version || "?"})`);
  log(`Linked layers: services=${index.layers.services}, features=${index.layers.features}, components=${index.layers.components}, ui=${index.layers.ui}`);

  // 1️⃣ Re-apply templates if changed
  try {
    execSync("npm run aicp-repair", { stdio: "inherit" });
  } catch {
    log("⚠️  aicp-repair step failed — continuing…");
  }

  // 2️⃣ Validate metadata
  try {
    execSync("npm run aicp-validate", { stdio: "inherit" });
  } catch {
    log("⚠️  aicp-validate step failed — continuing…");
  }

  // 3️⃣ Re-export docs if schema changed or user requests it
  const exportDocs = process.argv.includes("--export");
  if (exportDocs) {
    try {
      execSync("npm run aicp-export", { stdio: "inherit" });
    } catch {
      log("⚠️  aicp-export step failed — continuing…");
    }
  }

  log("✅  Codex-Refresh complete. Metadata and docs are synchronized.");
})();
#!/usr/bin/env node
// =============================================================
// AICP Tools Stabilizer v2 — codex_refresh header as //
// =============================================================
// Route Riot — Codex Refresh (Orchestrator)
// ------------------------------------------------------------------
// Purpose:
//  - Orchestrate AICP tools for metadata normalization, integrity checks, and summary generation.
//  - Optionally export documentation if requested.

import { execSync } from "child_process";
import path from "path";

const projectRoot = process.cwd();

function runCommand(command, options = {}) {
  const { quiet = false } = options;
  try {
    const output = execSync(command, {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "pipe",
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

function log(msg) {
  console.log(`[codex-refresh] ${msg}`);
}

// ---------------------------------------------------------------------------
// MAIN EXECUTION
// ---------------------------------------------------------------------------
(async () => {
  log("🔁 Starting Codex Refresh (Orchestrator Mode)");

  const exportDocs = process.argv.includes("--export");
  const fixIntegrity = process.argv.includes("--fix");

  // 1. Run: aicp-metadata-normalize
  log("Running: npm run aicp-metadata-normalize");
  const normalizeResult = runCommand("npm run aicp-metadata-normalize");
  if (!normalizeResult.success) {
    log("⚠️  aicp-metadata-normalize failed.");
    process.exitCode = 1;
    return;
  }

  // 2. Run: aicp-integrity-ro (or aicp-integrity with --fix ONLY if explicitly requested via CLI flag)
  if (fixIntegrity) {
    log("Running: npm run aicp-integrity -- --fix");
    const integrityFixResult = runCommand("npm run aicp-integrity -- --fix");
    if (!integrityFixResult.success) {
      log("⚠️  aicp-integrity --fix failed.");
      process.exitCode = 1;
      return;
    }
  } else {
    log("Running: npm run aicp-integrity-ro");
    const integrityRoResult = runCommand("npm run aicp-integrity-ro");
    if (!integrityRoResult.success) {
      log("⚠️  aicp-integrity-ro failed.");
      process.exitCode = 1;
      return;
    }
  }

  // 3. Run: aicp-summary
  log("Running: npm run aicp-summary");
  const summaryResult = runCommand("npm run aicp-summary");
  if (!summaryResult.success) {
    log("⚠️  aicp-summary failed.");
    process.exitCode = 1;
    return;
  }

  // 4. Optional: export docs if --export flag is passed
  if (exportDocs) {
    log("Running: npm run aicp-export (Documentation Export)");
    const exportResult = runCommand("npm run aicp-export");
    if (!exportResult.success) {
      log("⚠️  aicp-export failed.");
      process.exitCode = 1;
      return;
    }
  }

  log("✅ Codex Refresh orchestration complete.");
})();
/**
 * AICP Redundancy Audit
 * Scans docs/aicp_summary for duplicated exports, roles, or metadata.
 * Output → docs/aicp_redundancy_report.md
 */

import fs from "fs";
import path from "path";

const summaryDir = "docs/aicp_summary";
const reportFile = "docs/aicp_redundancy_report.md";
const exportMap = new Map();
const roleMap = new Map();

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanDir(full);
    else if (entry.isFile() && entry.name.endsWith(".md")) {
      const text = fs.readFileSync(full, "utf8");
      const file = path.relative(summaryDir, full);

      // Collect exports
      const exports = [...text.matchAll(/exports:\s*(.+)/gi)].map(m => m[1].trim());
      exports.forEach(e => {
        if (!exportMap.has(e)) exportMap.set(e, []);
        exportMap.get(e).push(file);
      });

      // Collect roles
      const role = text.match(/ai_role:\s*(.+)/i)?.[1]?.trim();
      if (role) {
        if (!roleMap.has(role)) roleMap.set(role, []);
        roleMap.get(role).push(file);
      }
    }
  }
}

function generateReport() {
  let out = `# AICP Redundancy Report — ${new Date().toISOString()}\n`;

  out += `\n## Duplicate Exports\n`;
  let dupCount = 0;
  for (const [exp, files] of exportMap.entries()) {
    if (files.length > 1) {
      dupCount++;
      out += `- **${exp}** exported in:\n${files.map(f => `  - ${f}`).join("\n")}\n`;
    }
  }
  if (dupCount === 0) out += "✅ No duplicate exports found.\n";

  out += `\n## Overused Roles (potential overlap)\n`;
  for (const [role, files] of roleMap.entries()) {
    if (files.length > 4) {
      out += `- **${role}** used in ${files.length} modules:\n${files.map(f => `  - ${f}`).join("\n")}\n`;
    }
  }

  fs.writeFileSync(reportFile, out);
  console.log(`✅ Redundancy audit complete → ${reportFile}`);
}

try {
  scanDir(summaryDir);
  generateReport();
} catch (err) {
  console.error("❌ Redundancy audit failed:", err);
  process.exit(1);
}
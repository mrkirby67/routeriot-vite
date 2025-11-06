# AICP Tools Status — 2025-11-06T02:40:41Z

#### tools/aicp_architecture_graph.js
- ✅ PASS
- Purpose: Generates the Graphviz DOT architecture view from current metadata and writes it to `docs/aicp_architecture_graph.dot`.
- Health: Reads metadata only and writes the expected DOT output; no missing paths detected during audit.

#### tools/aicp_doc_exporter.js
- ✅ PASS
- Purpose: Exports metadata-backed summaries into `docs/aicp_summary/` markdown files.
- Health: Paths resolve correctly and outputs remain confined to documentation files.

#### tools/aicp_file_health.js
- ✅ PASS
- Purpose: Calculates per-file metrics and publishes `docs/aicp_file_health_report.md`.
- Health: Runs cleanly with current sources and writes only the expected report.

#### tools/aicp_integrity_check.js
- ✅ PASS
- Purpose: Full integrity manager that backfills missing metadata and regenerates dashboards.
- Health: Operates without runtime errors; intentional writes limited to metadata placeholders and report artifacts.

#### tools/aicp_integrity_ro.js
- ✅ PASS
- Purpose: Read-only integrity check that validates dependency rules and cycles.
- Health: Confirmed zero filesystem writes and latest execution reports no violations.

#### tools/aicp_metadata_dashboard.js
- ✅ PASS
- Purpose: Builds the HTML metadata dashboard at `docs/metadata_dashboard.html`.
- Health: Scans metadata successfully and only regenerates the dashboard file.

#### tools/aicp_metadata_normalize.js
- ✅ PASS
- Purpose: Ensures each source module has a `.meta.json` with required fields.
- Health: Uses synchronous FS writes limited to metadata files; no orphaned paths observed.

#### tools/aicp_redundancy_audit.js
- ✅ PASS
- Purpose: Audits `docs/aicp_summary` for duplicate exports and overused roles, writing `docs/aicp_redundancy_report.md`.
- Health: Processes markdown safely and emits a clean report with no side effects elsewhere.

#### tools/aicp_summary_dashboard.js
- ✅ PASS
- Purpose: Aggregates existing reports into `docs/aicp_status_snapshot.md`.
- Health: Only reads generated docs and rewrites the snapshot markdown; no metadata modifications.

#### tools/aicp_validate.js
- ✅ PASS
- Purpose: Validates AICP headers/footers, optionally applying fixes, and records findings in `docs/aicp_validation_report.md`.
- Health: Successfully loads layer graph data and restricts writes to validation artifacts when invoked.

#### tools/codex_refresh.js
- ⚠️ NEED REVIEW
- Purpose: Coordinates metadata cleanup and optional downstream validation runs.
- Health: Still performs direct metadata sanitization alongside orchestration; behaviour noted for future separation.

#### tools/codex_repair_pass_v3.js
- ✅ PASS
- Purpose: Repairs missing exports and re-export stubs, then logs the run to `docs/codex_repair_report.md`.
- Health: Repairs are scoped to targeted modules and report generation worked without errors.

#### tools/comment_balancer.js
- ✅ PASS
- Purpose: Repairs unterminated block comments across JS/TS sources.
- Health: Traversal filters keep operations constrained to intended files with no adverse findings.

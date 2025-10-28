#!/bin/bash
# =========================================================
# 🚀 CODEX REFRESH SCRIPT
# =========================================================
# PURPOSE:
#   Perform a full Codex rebuild: clean caches, re-index all
#   JS/HTML/CSS modules, validate build output, and log results.
#
# SAFETY:
#   - No source code is deleted.
#   - Only cache, dist, and old Function.Map.txt are removed.
# =========================================================

echo "🧽 Starting full Codex refresh..."
start_time=$(date +%s)

# STEP 1️⃣: Clean environment
echo "🧹 Cleaning caches and build output..."
rm -rf .codex_temp dist node_modules/.cache 2>/dev/null
rm -f Function.Map.txt 2>/dev/null

# STEP 2️⃣: Re-index all project functions (simulated safe version)
echo "🗺️  Rebuilding Function.Map.txt..."
echo "# =========================================================" > Function.Map.txt
echo "# 📘 ROUTE RIOT FUNCTION MAP (AUTO-GENERATED)" >> Function.Map.txt
echo "# =========================================================" >> Function.Map.txt
find components modules -type f \( -name "*.js" -o -name "*.html" -o -name "*.css" \) \
  | sort | sed 's/^/ - /' >> Function.Map.txt

# STEP 3️⃣: Validate project build
echo "🔧 Running npm build check..."
npm run build || { echo "❌ Build failed — please check errors above."; exit 1; }

# STEP 4️⃣: Preserve this script reference for future runs
{
  echo ""
  echo "# ========================================================="
  echo "# 🧩 CODEX REBUILD COMMANDS (Auto-Preserved Copy)"
  echo "# ========================================================="
  cat "$0"
  echo ""
} >> Function.Map.txt

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "✅ Codex refresh complete in ${duration}s."
echo "   → Function.Map.txt updated"
echo "   → Build validated successfully"
echo "   → Safe to resume Codex operations!"
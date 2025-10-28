#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "🛠️  CODEX GLOBAL AUTO-FIX: Import Repair (SAFE MODE)"
echo "=========================================================="
timestamp=$(date)
printf "Timestamp: %s\n" "$timestamp" > codex_autofix_global.log

# ----------------------------------------------------------
# 🔍 SCAN TARGETS
# ----------------------------------------------------------
echo "🔍 Searching for files with broken relative imports..."
find components modules -type f \( -name "*.js" -o -name "*.mjs" -o -name "*.jsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.git/*" \
  ! -path "*/dist/*" \
  ! -path "*/_archive/*" \
  ! -path "*/fonts/*" \
  > codex_target_files.txt

total=$(wc -l < codex_target_files.txt)
printf "📦 %s JavaScript files queued for inspection\n" "$total" | tee -a codex_autofix_global.log

# ----------------------------------------------------------
# 🧩 FIX LOOP
# ----------------------------------------------------------
while IFS= read -r file; do
  if grep -qE "from \'\\./config\\.js\'|from \'\\.\\./config\\.js\'|from \'\\./zonesUtils\\.js\'|from \'\\.\\./zonesUtils\\.js\'|from \'\\./scoreboardManager\\.js\'|from \'\\.\\./scoreboardManager\\.js\'|from \'\\.\\./data\\.js\'|from \'\\./data\\.js\'" "$file"; then
    backup="${file}.bak_$(date +%Y%m%d_%H%M%S)"
    cp "$file" "$backup"
    printf "📦 Backup created: %s\n" "$backup" >> codex_autofix_global.log

    sed -i '' \
      -e "s|from './config.js'|from '../../modules/config.js'|g" \
      -e "s|from '../config.js'|from '../../modules/config.js'|g" \
      -e "s|from './zonesUtils.js'|from '../../modules/zonesUtils.js'|g" \
      -e "s|from '../zonesUtils.js'|from '../../modules/zonesUtils.js'|g" \
      -e "s|from './scoreboardManager.js'|from '../../modules/scoreboardManager.js'|g" \
      -e "s|from '../scoreboardManager.js'|from '../../modules/scoreboardManager.js'|g" \
      -e "s|from '../data.js'|from '../../modules/data.js'|g" \
      -e "s|from './data.js'|from '../../modules/data.js'|g" \
      "$file"

    printf "✅ Fixed imports in: %s\n" "$file" | tee -a codex_autofix_global.log
  fi
done < codex_target_files.txt

# ----------------------------------------------------------
# 🧹 CLEANUP + SUMMARY
# ----------------------------------------------------------
rm -f codex_target_files.txt
echo "----------------------------------------------------------" >> codex_autofix_global.log
echo "✅ Global import path repair complete." | tee -a codex_autofix_global.log
echo "🧾 Log saved to codex_autofix_global.log"
echo "=========================================================="

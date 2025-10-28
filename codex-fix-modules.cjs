#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const modulesRoot = path.resolve('modules');
if (!fs.existsSync(modulesRoot) || !fs.statSync(modulesRoot).isDirectory()) {
  console.error('modules directory not found.');
  process.exit(1);
}

const timestamp = new Date();
const humanTimestamp = timestamp.toString();
const stampForFiles = [
  timestamp.getFullYear().toString().padStart(4, '0'),
  (timestamp.getMonth() + 1).toString().padStart(2, '0'),
  timestamp.getDate().toString().padStart(2, '0')
].join('') + '_' + [
  timestamp.getHours().toString().padStart(2, '0'),
  timestamp.getMinutes().toString().padStart(2, '0'),
  timestamp.getSeconds().toString().padStart(2, '0')
].join('');

const logLines = [`Timestamp: ${humanTimestamp}`];
let changes = 0;
let backupCounter = 0;

const protectedExtensions = new Set([
  '.css', '.scss', '.sass', '.less', '.styl', '.pcss', '.sss',
  '.ttf', '.woff', '.woff2', '.otf', '.eot',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.bmp', '.ico',
  '.json'
]);

const targetExtensions = new Set(['.js', '.mjs']);

function shouldProcessFile(file) {
  const ext = path.extname(file);
  return targetExtensions.has(ext);
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['_archive', 'node_modules', 'dist', 'fonts', '.git'].includes(entry.name)) {
        continue;
      }
      walk(full, out);
    } else if (entry.isFile()) {
      if (shouldProcessFile(full)) {
        out.push(full);
      }
    }
  }
}

function resolveNewSpec(filePath, spec) {
  if (!spec.startsWith('../../modules/')) {
    return null;
  }

  const specWithoutQuery = spec.split('?')[0].split('#')[0];
  const ext = path.extname(specWithoutQuery);
  if (protectedExtensions.has(ext)) {
    return null;
  }

  const remainder = spec.substring('../../modules/'.length);
  if (!remainder) {
    return null;
  }

  const candidateRoots = [modulesRoot, process.cwd()];
  const candidates = [];

  for (const root of candidateRoots) {
    const absoluteTarget = path.resolve(root, remainder);
    candidates.push(absoluteTarget);
    if (!fs.existsSync(absoluteTarget) && !ext) {
      for (const candidateExt of targetExtensions) {
        candidates.push(absoluteTarget + candidateExt);
      }
    }
  }

  let existingPath = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      existingPath = candidate;
      break;
    }
  }

  if (!existingPath) {
    return null;
  }

  const fileDir = path.dirname(filePath);
  let relative = path.relative(fileDir, existingPath).replace(/\\/g, '/');
  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }

  return {
    newSpec: relative,
    resolvedPath: existingPath
  };
}

function processFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  let updated = content;
  let fileChanged = false;
  const fileChanges = [];

  const staticImportRegex = /(from\s+['"])(\.\.\/\.\.\/modules\/[^'"\n]+)(['"])/g;
  const dynamicImportRegex = /(import\s*\(\s*['"])(\.\.\/\.\.\/modules\/[^'"\n]+)(['"])/g;

  function replacer(match, prefix, spec, suffix) {
    const result = resolveNewSpec(file, spec);
    if (!result) {
      return match;
    }
    const { newSpec, resolvedPath } = result;
    if (newSpec === spec) {
      return match;
    }
    fileChanged = true;
    fileChanges.push({ old: spec, neu: newSpec, resolvedPath });
    return `${prefix}${newSpec}${suffix}`;
  }

  updated = updated.replace(staticImportRegex, replacer);
  updated = updated.replace(dynamicImportRegex, replacer);

  if (!fileChanged) {
    return;
  }

  const backupName = `${file}.bak_${stampForFiles}_${(++backupCounter).toString().padStart(2, '0')}`;
  fs.copyFileSync(file, backupName);
  logLines.push(`📦 Backup created: ${path.relative(process.cwd(), backupName)}`);

  fs.writeFileSync(file, updated, 'utf8');
  changes += 1;

  for (const change of fileChanges) {
    logLines.push(`✅ ${path.relative(process.cwd(), file)}: '${change.old}' → '${change.neu}' (resolved: ${path.relative(process.cwd(), change.resolvedPath)})`);
  }
}

const files = [];
walk(modulesRoot, files);
files.sort();

for (const file of files) {
  processFile(file);
}

if (changes === 0) {
  logLines.push('No imports required fixing.');
}

fs.writeFileSync('codex_module_pathfix.log', logLines.join('\n') + '\n', 'utf8');

console.log('===========================================================');
console.log('🧠 SYSTEM INSTRUCTION: FIX LOCAL MODULE IMPORT PATHS');
console.log('===========================================================');
console.log(`Processed ${files.length} files inside modules.`);
console.log(`Imports updated in ${changes} file(s).`);
console.log('See codex_module_pathfix.log for details.');

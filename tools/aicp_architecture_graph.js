#!/usr/bin/env node
/**
 * Route Riot Architecture Graph Generator
 * ---------------------------------------
 * Reads all *.meta.json files and emits a Graphviz DOT diagram grouped by layer.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const META_DIRS = ['modules', 'services', 'features', 'components', 'ui'];
const OUTPUT_PATH = path.join(ROOT, 'docs', 'aicp_architecture_graph.dot');

const LAYER_COLORS = {
  modules: 'lightgray',
  services: 'salmon',
  features: 'khaki',
  components: 'lightgreen',
  ui: 'lightblue'
};

function walkMetaFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMetaFiles(full);
    if (entry.isFile() && entry.name.endsWith('.meta.json')) return [full];
    return [];
  });
}

function loadMetadata() {
  const files = META_DIRS.flatMap((dir) => walkMetaFiles(path.join(ROOT, dir)));
  const index = new Map();
  files.forEach((file) => {
    try {
      const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
      const name = meta.name || path.basename(file, '.meta.json');
      index.set(name, {
        name,
        layer: meta.layer || path.relative(ROOT, file).split(path.sep)[0],
        depends_on: Array.isArray(meta.depends_on) ? meta.depends_on : []
      });
    } catch (err) {
      console.warn(`⚠️ Skipping invalid metadata: ${file} (${err.message})`);
    }
  });
  return index;
}

const metadata = loadMetadata();

const lines = [];
lines.push('digraph RouteRiotArchitecture {');
lines.push('  rankdir=LR;');
lines.push('  node [shape=box, style=filled];');

metadata.forEach((meta) => {
  const color = LAYER_COLORS[meta.layer] || 'white';
  lines.push(
    `  ${JSON.stringify(meta.name)} [label=${JSON.stringify(meta.name)}, fillcolor=${JSON.stringify(color)}];`
  );
});

metadata.forEach((meta) => {
  meta.depends_on.forEach((dep) => {
    if (!metadata.has(dep)) return;
    lines.push(`  ${JSON.stringify(meta.name)} -> ${JSON.stringify(dep)};`);
  });
});

lines.push('}');

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8');
console.log(`✅ Graph written to ${OUTPUT_PATH}`);

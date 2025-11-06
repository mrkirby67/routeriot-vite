#!/usr/bin/env node
/**
 * AICP Integrity Checker (Read-Only)
 * ----------------------------------
 * Validates layer dependencies based on *.meta.json files.
 * This tool is read-only and does not modify any files.
 * It reports violations to the console.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['components', 'features', 'services', 'ui', 'modules'];

const LAYER_DEPENDENCY_RULES = {
    modules: ['modules', 'services', 'features', 'components', 'ui'],
    services: ['modules', 'services', 'features'],
    features: ['modules', 'services', 'features', 'components', 'ui'],
    components: ['modules', 'services', 'features', 'components', 'ui'],
    ui: ['modules', 'services', 'features', 'components', 'ui']
};

function findMetaFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return findMetaFiles(full);
        if (entry.isFile() && full.endsWith('.meta.json')) return full;
        return [];
    });
}

function loadMetadata() {
    const allMetaFiles = TARGET_DIRS.flatMap(dir => findMetaFiles(path.join(ROOT, dir)));
    const metas = [];
    for (const file of allMetaFiles) {
        try {
            const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (!meta?.name) {
                meta.name = path.basename(file, '.meta.json');
            }
            meta.__file = path.relative(ROOT, file);
            metas.push(meta);
        } catch (err) {
            console.error(`Skipping invalid metadata file ${file}: ${err.message}`);
        }
    }
    return metas;
}

function buildMetaIndex(metas) {
    const index = new Map();
    metas.forEach(meta => {
        if (!index.has(meta.name)) {
            index.set(meta.name, meta);
        }
    });
    return index;
}

function findLayerViolation(sourceMeta, depMeta) {
    const allowed = LAYER_DEPENDENCY_RULES[sourceMeta.layer] || [];
    return !allowed.includes(depMeta.layer);
}

function detectLayerViolations(metas, metaIndex) {
    const violations = [];
    metas.forEach(meta => {
        const deps = Array.isArray(meta.depends_on) ? meta.depends_on : [];
        deps.forEach(depName => {
            const depMeta = metaIndex.get(depName);
            if (!depMeta) {
                violations.push({
                    type: 'unknown-dependency',
                    message: `${meta.layer}/${meta.name} depends on missing module "${depName}"`
                });
                return;
            }
            if (findLayerViolation(meta, depMeta)) {
                violations.push({
                    type: 'layer-rule',
                    message: `${meta.layer}/${meta.name} cannot depend on ${depMeta.layer}/${depMeta.name}`
                });
            }
        });
    });
    return violations;
}

function detectCircularDependencies(metas, metaIndex) {
    const violations = [];
    const graphByLayer = new Map();

    metas.forEach(meta => {
        const deps = Array.isArray(meta.depends_on) ? meta.depends_on : [];
        const layer = meta.layer || 'unknown';
        if (!graphByLayer.has(layer)) {
            graphByLayer.set(layer, new Map());
        }
        const layerGraph = graphByLayer.get(layer);
        if (!layerGraph.has(meta.name)) {
            layerGraph.set(meta.name, []);
        }
        deps.forEach(depName => {
            const depMeta = metaIndex.get(depName);
            if (depMeta && depMeta.layer === layer) {
                layerGraph.get(meta.name).push(depName);
            }
        });
    });

    graphByLayer.forEach((adjacency, layer) => {
        const visited = new Set();
        const stack = new Set();

        const dfs = (node, path) => {
            if (stack.has(node)) {
                const cycleStartIndex = path.indexOf(node);
                const cyclePath = path.slice(cycleStartIndex).concat(node);
                violations.push({
                    type: 'cycle',
                    message: `Cycle detected in ${layer}: ${cyclePath.join(' -> ')}`
                });
                return;
            }
            if (visited.has(node)) return;
            visited.add(node);
            stack.add(node);
            const neighbours = adjacency.get(node) || [];
            neighbours.forEach(next => dfs(next, [...path, next]));
            stack.delete(node);
        };

        adjacency.forEach((_, node) => {
            if (!visited.has(node)) {
                dfs(node, [node]);
            }
        });
    });

    return violations;
}

function run() {
    console.log('Running AICP Integrity Checker (Read-Only)...');

    const allMetadata = loadMetadata();
    const metaIndex = buildMetaIndex(allMetadata);

    const violations = [
        ...detectLayerViolations(allMetadata, metaIndex),
        ...detectCircularDependencies(allMetadata, metaIndex)
    ];

    if (violations.length === 0) {
        console.log('✅ No integrity violations found.');
    } else {
        console.error(`❌ Found ${violations.length} integrity violations:`);
        violations.forEach(v => console.error(` - [${v.type}] ${v.message}`));
        process.exit(1);
    }
}

run();

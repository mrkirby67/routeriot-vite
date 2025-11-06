#!/usr/bin/env node
/**
 * AICP Metadata Normalizer
 * ---------------------------
 * Ensures each *.meta.json file contains the required fields:
 * layer, name, depends_on (array), description, phase.
 * If a file is missing, it creates a placeholder.
 * If fields are missing, it inserts default values.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['components', 'features', 'services', 'ui', 'modules'];

function findJsFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return findJsFiles(full);
        if (entry.isFile() && full.endsWith('.js')) return full;
        return [];
    });
}

function getLayer(filePath) {
    const relPath = path.relative(ROOT, filePath);
    const parts = relPath.split(path.sep);
    if (TARGET_DIRS.includes(parts[0])) {
        return parts[0];
    }
    return 'unknown';
}

function run() {
    console.log('Running AICP Metadata Normalizer...');

    const allJsFiles = TARGET_DIRS.flatMap(dir => findJsFiles(path.join(ROOT, dir)));
    let createdCount = 0;
    let updatedCount = 0;

    for (const jsFile of allJsFiles) {
        const metaFile = jsFile.replace(/\.js$/, '.meta.json');
        const name = path.basename(jsFile, '.js');
        const layer = getLayer(jsFile);

        if (!fs.existsSync(metaFile)) {
            const placeholder = {
                layer: layer !== 'unknown' ? layer : 'TODO',
                name: name,
                depends_on: [],
                description: 'TODO',
                phase: 'draft'
            };
            fs.writeFileSync(metaFile, JSON.stringify(placeholder, null, 2));
            createdCount++;
        } else {
            const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
            let updated = false;

            const layerFromFile = getLayer(jsFile);
            if (meta.layer === 'TODO' || !meta.layer) {
                if (layerFromFile !== 'unknown') {
                    meta.layer = layerFromFile;
                    updated = true;
                }
            }
            if (!meta.name) { meta.name = name; updated = true; }
            if (!meta.depends_on) { meta.depends_on = []; updated = true; }
            if (!meta.description) { meta.description = 'TODO'; updated = true; }
            if (!meta.phase) { meta.phase = 'draft'; updated = true; }

            if (updated) {
                fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
                updatedCount++;
            }
        }
    }

    console.log(`✅ Metadata Normalization Complete. Created: ${createdCount}, Updated: ${updatedCount}`);
}

run();

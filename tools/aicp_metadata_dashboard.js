#!/usr/bin/env node
/**
 * AICP Metadata Dashboard Generator
 * ---------------------------------
 * Reads all *.meta.json files and generates a browsable HTML dashboard
 * in /docs showing layer, name, depends_on, description, and phase status.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['modules', 'services', 'features', 'components', 'ui'];
const LAYER_ORDER = ['modules', 'services', 'features', 'components', 'ui'];
const HTML_DASHBOARD_PATH = path.join(ROOT, 'docs', 'metadata_dashboard.html');

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

function run() {
    console.log('Generating AICP Metadata Dashboard...');

    const allJsFiles = TARGET_DIRS.flatMap(dir => findJsFiles(path.join(ROOT, dir)));
    const allMetadata = [];

    for (const jsFile of allJsFiles) {
        const metaFile = jsFile.replace(/\.js$/, '.meta.json');
        if (fs.existsSync(metaFile)) {
            const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
            allMetadata.push(meta);
        }
    }

    const phaseColors = {
        draft: '#f0ad4e',
        active: '#5cb85c',
        validated: '#337ab7',
        deprecated: '#d9534f'
    };

    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Route Riot Metadata Dashboard</title>
            <style>
                body { font-family: sans-serif; margin: 2em; }
                h1 { text-align: center; }
                .layer { margin-bottom: 2em; border: 1px solid #ddd; border-radius: 5px; padding: 1em; }
                .module { border: 1px solid #ccc; border-radius: 5px; padding: 1em; margin-bottom: 1em; background-color: #f9f9f9; }
                .module-header { display: flex; justify-content: space-between; align-items: center; }
                .phase { padding: 0.5em; color: white; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h1>Route Riot Metadata Dashboard</h1>
    `;

    const modulesByLayer = allMetadata.reduce((acc, meta) => {
        const layer = meta.layer || 'unknown';
        if (!acc[layer]) acc[layer] = [];
        acc[layer].push(meta);
        return acc;
    }, {});

    const orderedLayers = [
        ...LAYER_ORDER.filter(layer => Array.isArray(modulesByLayer[layer]) && modulesByLayer[layer].length > 0),
        ...Object.keys(modulesByLayer).filter(layer => !LAYER_ORDER.includes(layer))
    ];

    orderedLayers.forEach(layer => {
        html += `<div class="layer"><h2>${layer}</h2>`;
        (modulesByLayer[layer] || []).forEach(meta => {
            const jsFilePath = allJsFiles.find(f => f.endsWith(`${meta.name}.js`));
            const metaFilePath = jsFilePath ? jsFilePath.replace(/\.js$/, '.meta.json') : '';

            const relJsPath = jsFilePath ? path.relative(path.dirname(HTML_DASHBOARD_PATH), jsFilePath) : '#';
            const relMetaPath = metaFilePath ? path.relative(path.dirname(HTML_DASHBOARD_PATH), metaFilePath) : '#';

            html += `
                <div class="module">
                    <div class="module-header">
                        <h3>${meta.name}</h3>
                        <span class="phase" style="background-color: ${phaseColors[meta.phase] || '#777'}">${meta.phase}</span>
                    </div>
                    <p><strong>Description:</strong> ${meta.description}</p>
                    <p><strong>Dependencies:</strong> ${meta.depends_on.join(', ') || 'None'}</p>
                    <p>
                        <a href="${relJsPath}">Code</a> | <a href="${relMetaPath}">Metadata</a>
                    </p>
                </div>
            `;
        });
        html += `</div>`;
    });

    html += `
        </body>
        </html>
    `;

    fs.mkdirSync(path.dirname(HTML_DASHBOARD_PATH), { recursive: true });
    fs.writeFileSync(HTML_DASHBOARD_PATH, html);
    console.log(`✅ HTML dashboard written to ${HTML_DASHBOARD_PATH}`);
}

run();

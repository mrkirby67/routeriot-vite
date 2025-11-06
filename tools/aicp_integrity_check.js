#!/usr/bin/env node
/**
 * Route Riot Metadata Manager
 * ---------------------------
 * This tool manages the metadata for the Route Riot project, using .meta.json
 * files as the single source of truth. It replaces the previous mixed metadata
 * and inline comment system.
 *
 * PHASES:
 * 1) CHECK: Scan all modules and locate matching *.meta.json files.
 * 2) CONFIRM + REVIEW: Generate a browsable HTML dashboard in /docs
 *    showing layer, name, depends_on, description, and phase status.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const TARGET_DIRS = ['components', 'features', 'services', 'ui'];
const HEALTH_REPORT_PATH = path.join(ROOT, 'docs', 'aicp_file_health_report.md');
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

function getLayer(filePath) {
    const relPath = path.relative(ROOT, filePath);
    const parts = relPath.split(path.sep);
    if (TARGET_DIRS.includes(parts[0])) {
        return parts[0];
    }
    return 'unknown';
}

function run() {
    console.log('Running Route Riot Metadata Manager...');

    const allJsFiles = TARGET_DIRS.flatMap(dir => findJsFiles(path.join(ROOT, dir)));
    const metadataReport = [];
    const allMetadata = [];

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
            metadataReport.push({
                file: path.relative(ROOT, jsFile),
                status: '❌ Missing',
                details: 'Created placeholder .meta.json file.'
            });
            allMetadata.push(placeholder);
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
            }

            allMetadata.push(meta);
            let issues = [];
            if (meta.layer === 'TODO') issues.push('layer is TODO');
            if (meta.description === 'TODO') issues.push('description is TODO');
            if (issues.length > 0) {
                metadataReport.push({
                    file: path.relative(ROOT, jsFile),
                    status: '⚠️ Incomplete',
                    details: issues.join(', ')
                });
            }
        }
    }

    // Generate health report
    let healthReport = `# AICP File Health Report — ${new Date().toISOString()}\n\n`;
    if (metadataReport.length > 0) {
        healthReport += '| File | Status | Details |\n';
        healthReport += '|------|--------|---------|\n';
        metadataReport.forEach(report => {
            healthReport += `| ${report.file} | ${report.status} | ${report.details} |\n`;
        });
    } else {
        healthReport += '✅ All .meta.json files are present and complete.\n';
    }
    fs.writeFileSync(HEALTH_REPORT_PATH, healthReport);
    console.log(`✅ Health report written to ${HEALTH_REPORT_PATH}`);

    // Generate HTML dashboard
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

    for (const layer in modulesByLayer) {
        html += `<div class="layer"><h2>${layer}</h2>`;
        modulesByLayer[layer].forEach(meta => {
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
    }

    html += `
        </body>
        </html>
    `;

    fs.writeFileSync(HTML_DASHBOARD_PATH, html);
    console.log(`✅ HTML dashboard written to ${HTML_DASHBOARD_PATH}`);
}

run();
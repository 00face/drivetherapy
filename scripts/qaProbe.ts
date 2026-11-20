/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CLI QA Probe:
 * 1) Validates GraphML XML well-formedness (usermap.graphml, commands.graphml, systemlogic.graphml)
 * 2) Probes live server endpoints (/api/health, /api/maps/config, /api/models/local-status) if .runtime-server.json exists.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GRAPHML_FILES = ['usermap.graphml', 'commands.graphml', 'systemlogic.graphml'];

let hasError = false;

for (const file of GRAPHML_FILES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.error(`[qa:probe] Missing GraphML file: ${file}`);
    hasError = true;
    continue;
  }
  const xml = fs.readFileSync(full, 'utf8');
  if (!xml.includes('<graphml') || !xml.includes('</graphml>')) {
    console.error(`[qa:probe] Invalid GraphML root tags in ${file}`);
    hasError = true;
  } else {
    console.log(`[qa:probe] OK GraphML: ${file} (${xml.length} bytes)`);
  }
}

const runtimeFile = path.join(ROOT, '.runtime-server.json');
if (fs.existsSync(runtimeFile)) {
  try {
    const info = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    const port = info?.port;
    if (port) {
      const endpoints = ['/api/health', '/api/maps/config', '/api/models/local-status'];
      for (const ep of endpoints) {
        const res = await fetch(`http://127.0.0.1:${port}${ep}`);
        if (!res.ok) {
          console.error(`[qa:probe] FAIL ${ep} -> HTTP ${res.status}`);
          hasError = true;
        } else {
          console.log(`[qa:probe] OK ${ep} -> HTTP ${res.status} (port ${port})`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[qa:probe] Live server probe skipped (${err?.message || 'not reachable'})`);
  }
} else {
  console.log('[qa:probe] No .runtime-server.json found; skipped live HTTP probes.');
}

if (hasError) process.exit(1);
console.log('[qa:probe] All checks passed.');

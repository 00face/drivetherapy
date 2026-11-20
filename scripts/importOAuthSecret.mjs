#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * [WO-120] Local OAuth Client Secret CLI Auto-Importer (`npm run oauth:import-secret`)
 * Automatically scans `./google/`, `./ingest/`, and `~/Downloads` for the newest
 * `client_secret*.json` downloaded from Google Cloud Console, copies it with mode 0600
 * into `./google/client_secret.json`, and updates `.env` with `GOOGLE_CLIENT_ID` and
 * `GOOGLE_CLIENT_SECRET`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const googleDir = path.join(ROOT, 'google');
const ingestDir = path.join(ROOT, 'ingest');
const downloadsDir = path.join(os.homedir(), 'Downloads');

const customArg = process.argv[2] ? path.resolve(process.argv[2]) : null;

function findNewestClientSecret() {
  if (customArg && fs.existsSync(customArg)) return customArg;

  const candidates = [];
  for (const dir of [ingestDir, downloadsDir, googleDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (/^client_secret.*\.json$/i.test(entry)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isFile()) {
          candidates.push({ full, mtimeMs: stat.mtimeMs });
        }
      }
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.full || null;
}

const foundPath = findNewestClientSecret();
if (!foundPath) {
  console.error(
    '[oauth:import-secret] No client_secret*.json found in ./ingest/, ~/Downloads/, or ./google/.\n' +
      'Download the OAuth 2.0 JSON from Google Cloud Console (https://console.cloud.google.com/apis/credentials) and re-run: npm run oauth:import-secret'
  );
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
const creds = raw.web || raw.installed;
if (!creds || !creds.client_id || !creds.client_secret) {
  console.error(`[oauth:import-secret] Invalid OAuth client JSON structure in ${foundPath}`);
  process.exit(1);
}

fs.mkdirSync(googleDir, { recursive: true });
const targetJson = path.join(googleDir, 'client_secret.json');
if (path.resolve(foundPath) !== path.resolve(targetJson)) {
  fs.writeFileSync(targetJson, JSON.stringify(raw, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}

// Update .env non-destructively
const envPath = path.join(ROOT, '.env');
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

function upsertEnvVar(text, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(text)) {
    return text.replace(regex, `${key}=${value}`);
  }
  return text.trimEnd() + `\n${key}=${value}\n`;
}

envContent = upsertEnvVar(envContent, 'GOOGLE_CLIENT_ID', creds.client_id);
envContent = upsertEnvVar(envContent, 'GOOGLE_CLIENT_SECRET', creds.client_secret);
fs.writeFileSync(envPath, envContent.trimStart(), { encoding: 'utf8', mode: 0o600 });

console.log(`[oauth:import-secret] Imported OAuth credentials from: ${foundPath}`);
console.log(`[oauth:import-secret] Project ID: ${creds.project_id || 'unknown'}`);
console.log(`[oauth:import-secret] Client ID:  ${creds.client_id.slice(0, 18)}...apps.googleusercontent.com`);
console.log(`[oauth:import-secret] Saved mode-0600 credentials to ./google/client_secret.json and .env`);

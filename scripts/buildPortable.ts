/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-118] Universal Portable Bundle & Cross-Platform Native Executable Builder
 *  1. Compiles Vite production frontend (`dist/`)
 *  2. Bundles Express backend (`dist-portable/server.cjs`)
 *  3. Cross-compiles native standalone executables via Go (`native-launcher/`):
 *     - DriveTherapy.exe (Windows 10/11 x64 PE32+ executable)
 *     - DriveTherapy-linux-x64 (Linux x86_64 ELF executable)
 *     - DriveTherapy-macos-arm64 (macOS Apple Silicon Mach-O executable)
 *     - DriveTherapy-macos-x64 (macOS Intel Mach-O executable)
 *     - DriveTherapy-android-arm64 (Android / Linux ARM64 executable)
 *  4. Emits shell launchers (.bat, .sh, .command)
 *  5. Packages `release/DriveTherapy-v2.2.0-universal-portable.zip`, `.tar.gz`, and `SHA256SUMS.txt`
 */

import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'dist-portable');
const releaseDir = path.join(root, 'release');
const distSrc = path.join(root, 'dist');
const distDest = path.join(outDir, 'dist');
const nativeDir = path.join(root, 'native-launcher');

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

if (!fs.existsSync(distSrc)) {
  console.log('[buildPortable] Running vite build...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log('[buildPortable] Bundling Express server with esbuild...');
execSync(
  `npx esbuild server.ts --bundle --platform=node --format=cjs --outfile="${path.join(outDir, 'server.cjs')}" --external:electron --external:vite --external:esbuild --external:lightningcss --external:@vitejs/devtools/config`,
  { stdio: 'inherit' }
);

if (fs.existsSync(distDest)) {
  fs.rmSync(distDest, { recursive: true, force: true });
}
fs.cpSync(distSrc, distDest, { recursive: true });

// Linux launcher
const shPath = path.join(outDir, 'DriveTherapy.sh');
fs.writeFileSync(
  shPath,
  '#!/usr/bin/env bash\nset -e\ncd "$(dirname "$0")"\nexport NODE_ENV=production\nexport PORT=${PORT:-3010}\nif command -v node >/dev/null 2>&1; then\n  exec node server.cjs\nelse\n  exec ./DriveTherapy-linux-x64\nfi\n',
  'utf8'
);
fs.chmodSync(shPath, 0o755);

// macOS double-clickable launcher
const cmdPath = path.join(outDir, 'DriveTherapy.command');
fs.writeFileSync(
  cmdPath,
  '#!/usr/bin/env bash\ncd "$(dirname "$0")"\nexport NODE_ENV=production\nexport PORT=${PORT:-3010}\nif command -v node >/dev/null 2>&1; then\n  open "http://localhost:${PORT}" &\n  exec node server.cjs\nelif [ "$(uname -m)" = "arm64" ]; then\n  exec ./DriveTherapy-macos-arm64\nelse\n  exec ./DriveTherapy-macos-x64\nfi\n',
  'utf8'
);
fs.chmodSync(cmdPath, 0o755);

// Windows portable launcher
const batPath = path.join(outDir, 'DriveTherapy.bat');
fs.writeFileSync(
  batPath,
  '@echo off\r\ncd /d "%~dp0"\r\nDriveTherapy.exe\r\n',
  'utf8'
);

// Cross-compile native standalone executables if Go compiler is installed
let hasGo = false;
try {
  execSync('go version', { stdio: 'ignore' });
  hasGo = true;
} catch {
  hasGo = false;
}

const targets = [
  { goos: 'windows', goarch: 'amd64', out: 'DriveTherapy.exe' },
  { goos: 'linux', goarch: 'amd64', out: 'DriveTherapy-linux-x64' },
  { goos: 'darwin', goarch: 'arm64', out: 'DriveTherapy-macos-arm64' },
  { goos: 'darwin', goarch: 'amd64', out: 'DriveTherapy-macos-x64' },
  { goos: 'linux', goarch: 'arm64', out: 'DriveTherapy-android-arm64' },
];

if (hasGo && fs.existsSync(path.join(nativeDir, 'main.go'))) {
  console.log('[buildPortable] Cross-compiling native executables (Windows .exe, Linux, macOS, Android)...');
  for (const t of targets) {
    const outPath = path.join(outDir, t.out);
    execSync(`CGO_ENABLED=0 GOOS=${t.goos} GOARCH=${t.goarch} go build -ldflags="-s -w" -o "${outPath}" .`, {
      cwd: nativeDir,
      stdio: 'inherit',
    });
    if (t.goos !== 'windows') {
      fs.chmodSync(outPath, 0o755);
    }
    fs.copyFileSync(outPath, path.join(releaseDir, t.out));
    console.log(`[buildPortable] Built native binary: ${t.out} (${t.goos}/${t.goarch})`);
  }
}

// Write Portable Quickstart README
fs.writeFileSync(
  path.join(outDir, 'PORTABLE_README.txt'),
  [
    'Drive Therapy v2.2.0 — Universal Portable & Native Standalone Edition',
    '====================================================================',
    '',
    'HOW TO RUN (Zero-Install):',
    '  - Windows 10/11 (x64): Double-click DriveTherapy.exe (or DriveTherapy.bat)',
    '  - Linux (x64):         Run ./DriveTherapy-linux-x64 (or ./DriveTherapy.sh)',
    '  - macOS (Apple/Intel): Double-click DriveTherapy.command (or ./DriveTherapy-macos-arm64)',
    '  - Android (ARM64):     Run ./DriveTherapy-android-arm64 inside Termux/ADB shell',
    '',
    'DUAL-MODE ENGINE:',
    '  - If Node.js is installed on your machine, the native launcher automatically boots',
    '    server.cjs for full Express backend capabilities and opens the app window.',
    '  - If Node.js is NOT installed, the native executable serves the embedded dist/',
    '    studio and built-in offline API gateway directly with zero external dependencies.',
    '',
  ].join('\n'),
  'utf8'
);

// Create Universal Portable Archives in release/
const zipOut = path.join(releaseDir, 'DriveTherapy-v2.2.0-universal-portable.zip');
const tarOut = path.join(releaseDir, 'DriveTherapy-v2.2.0-universal-portable.tar.gz');
try {
  if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);
  execSync(`zip -rq "${zipOut}" .`, { cwd: outDir, stdio: 'inherit' });
} catch {
  // zip optional
}
try {
  if (fs.existsSync(tarOut)) fs.unlinkSync(tarOut);
  execSync(`tar -czf "${tarOut}" .`, { cwd: outDir, stdio: 'inherit' });
} catch {
  // tar optional
}

// Compute SHA256SUMS.txt for all release artifacts
const sumLines: string[] = [];
for (const file of fs.readdirSync(releaseDir).sort()) {
  if (file === 'SHA256SUMS.txt') continue;
  const full = path.join(releaseDir, file);
  if (fs.statSync(full).isFile()) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    sumLines.push(`${hash}  ${file}`);
  }
}
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), sumLines.join('\n') + '\n', 'utf8');

console.log(`[buildPortable] Portable bundle ready in ${outDir}`);
console.log(`[buildPortable] Release archives & native binaries written to ${releaseDir}`);

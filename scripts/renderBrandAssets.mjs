#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * [WO-120] Official Drive Therapy Brand Asset Extractor & High-DPI Inkscape PNG Renderer
 * Source of truth: Vector Brand Style Sheet v1.0 (`public/brand/drive-therapy-brand-stylesheet.svg`)
 * Expands <symbol> definitions into direct inline <svg> vector groups for 100% universal
 * renderer compatibility (Inkscape, librsvg, Chromium, Firefox, Safari, GitHub, Android).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UPLOADED_SVG =
  '/home/face/.gemini/antigravity-cli/brain/3e073130-7e38-4daa-9c15-60ab4c02889d/.user_uploaded/uploaded_media_1795203030001.svg';
const BRAND_DIR = path.join(ROOT, 'public', 'brand');
const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(BRAND_DIR, { recursive: true });

const masterSvgPath = path.join(BRAND_DIR, 'drive-therapy-brand-stylesheet.svg');
if (fs.existsSync(UPLOADED_SVG)) {
  fs.copyFileSync(UPLOADED_SVG, masterSvgPath);
}

const rawSvg = fs.readFileSync(masterSvgPath, 'utf8');
const defsMatch = rawSvg.match(/<defs>([\s\S]*?)<\/defs>/);
if (!defsMatch) {
  throw new Error('Could not locate <defs> in master brand style sheet SVG.');
}
const fullDefs = defsMatch[1];

// Extract only the <linearGradient ...>...</linearGradient> definitions
const gradientDefs = (fullDefs.match(/<linearGradient[\s\S]*?<\/linearGradient>/g) || []).join('\n  ');

// Extract each <symbol id="..." viewBox="...">...</symbol>
const symbols = new Map();
const symbolRegex = /<symbol\s+id="([^"]+)"\s+viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g;
let m;
while ((m = symbolRegex.exec(fullDefs)) !== null) {
  symbols.set(m[1], { viewBox: m[2], body: m[3] });
}

// Expand any <use href="#icon-..." x="..." y="..." width="..." height="..."/> inside lockup symbols
function expandSymbolBody(symbolId) {
  const sym = symbols.get(symbolId);
  if (!sym) throw new Error(`Missing symbol: ${symbolId}`);
  return sym.body.replace(
    /<use\s+href="#([^"]+)"\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"\s*\/>/g,
    (_all, refId, x, y, w, h) => {
      const refSym = symbols.get(refId);
      if (!refSym) return '';
      return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${refSym.viewBox}">${refSym.body}</svg>`;
    }
  );
}

function buildStandaloneIconSvg({
  symbolId,
  background = null,
  rx = 180,
  clearSpaceRatio = 0.14,
}) {
  const sym = symbols.get(symbolId);
  if (!sym) throw new Error(`Symbol ${symbolId} not found`);
  const canvas = 1024;
  const pad = Math.round(canvas * clearSpaceRatio);
  const avail = canvas - pad * 2;
  const iconW = avail;
  const iconH = Math.round((avail * 900) / 1030);
  const x = Math.round((canvas - iconW) / 2);
  const y = Math.round((canvas - iconH) / 2);

  const bgRect = background
    ? `  <rect x="0" y="0" width="${canvas}" height="${canvas}" rx="${rx}" fill="${background}"/>\n`
    : '';

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${canvas} ${canvas}" width="${canvas}" height="${canvas}" role="img" aria-label="Drive Therapy Emblem">`,
    `  <defs>\n  ${gradientDefs}\n  </defs>`,
    bgRect + `  <svg x="${x}" y="${y}" width="${iconW}" height="${iconH}" viewBox="${sym.viewBox}">\n${expandSymbolBody(symbolId)}\n  </svg>`,
    `</svg>`,
    '',
  ].join('\n');
}

function buildHorizontalLockupSvg({
  symbolId,
  background = '#101C31',
  rx = 48,
}) {
  const sym = symbols.get(symbolId);
  if (!sym) throw new Error(`Symbol ${symbolId} not found`);
  const canvasW = 2560;
  const canvasH = 640;
  const lockupW = 2260;
  const lockupH = 505;
  const x = Math.round((canvasW - lockupW) / 2);
  const y = Math.round((canvasH - lockupH) / 2);

  const bgRect = background
    ? `  <rect x="0" y="0" width="${canvasW}" height="${canvasH}" rx="${rx}" fill="${background}"/>\n`
    : '';

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${canvasW} ${canvasH}" width="${canvasW}" height="${canvasH}" role="img" aria-label="Drive Therapy Brand Lockup">`,
    `  <defs>\n  ${gradientDefs}\n  </defs>`,
    bgRect + `  <svg x="${x}" y="${y}" width="${lockupW}" height="${lockupH}" viewBox="${sym.viewBox}">\n${expandSymbolBody(symbolId)}\n  </svg>`,
    `</svg>`,
    '',
  ].join('\n');
}

// 1. Write standalone vector SVGs (with directly inlined vector facet paths!)
const iconColorTransparentSvg = buildStandaloneIconSvg({
  symbolId: 'icon-color',
  background: null,
  clearSpaceRatio: 0.08,
});
const iconColorMidnightSvg = buildStandaloneIconSvg({
  symbolId: 'icon-color',
  background: '#101C31',
  rx: 210,
  clearSpaceRatio: 0.14,
});
const iconGraySvg = buildStandaloneIconSvg({
  symbolId: 'icon-gray',
  background: null,
  clearSpaceRatio: 0.08,
});
const iconBlackSvg = buildStandaloneIconSvg({
  symbolId: 'icon-black',
  background: null,
  clearSpaceRatio: 0.08,
});
const iconWhiteMidnightSvg = buildStandaloneIconSvg({
  symbolId: 'icon-white',
  background: '#101C31',
  rx: 210,
  clearSpaceRatio: 0.14,
});
const iconWhiteTransparentSvg = buildStandaloneIconSvg({
  symbolId: 'icon-white',
  background: null,
  clearSpaceRatio: 0.08,
});

fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.svg'), iconColorTransparentSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'icon-color.svg'), iconColorTransparentSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'icon-color-midnight.svg'), iconColorMidnightSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'icon-gray.svg'), iconGraySvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'icon-black.svg'), iconBlackSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'icon-white.svg'), iconWhiteTransparentSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'icon-white-midnight.svg'), iconWhiteMidnightSvg, 'utf8');

// 2. Write horizontal lockup SVGs
const lockupColorDarkSvg = buildHorizontalLockupSvg({
  symbolId: 'lockup-color',
  background: '#101C31',
  rx: 48,
});
const lockupGrayLightSvg = buildHorizontalLockupSvg({
  symbolId: 'lockup-gray',
  background: '#FFFFFF',
  rx: 48,
});
const lockupBlackLightSvg = buildHorizontalLockupSvg({
  symbolId: 'lockup-black',
  background: '#FFFFFF',
  rx: 48,
});
const lockupWhiteDarkSvg = buildHorizontalLockupSvg({
  symbolId: 'lockup-white',
  background: '#172238',
  rx: 48,
});

fs.writeFileSync(path.join(BRAND_DIR, 'lockup-color-dark.svg'), lockupColorDarkSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'lockup-gray-light.svg'), lockupGrayLightSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'lockup-black-light.svg'), lockupBlackLightSvg, 'utf8');
fs.writeFileSync(path.join(BRAND_DIR, 'lockup-white-dark.svg'), lockupWhiteDarkSvg, 'utf8');

// 3. Render crystal-clear PNGs using Inkscape
function renderPng(svgPath, outPngPath, width, height) {
  execFileSync(
    'inkscape',
    [
      svgPath,
      '--export-type=png',
      `--export-filename=${outPngPath}`,
      `-w`,
      String(width),
      `-h`,
      String(height),
    ],
    { stdio: 'ignore' }
  );
  console.log(`[brand] Rendered ${path.relative(ROOT, outPngPath)} (${width}x${height})`);
}

const midnightSvgPath = path.join(BRAND_DIR, 'icon-color-midnight.svg');
const transparentSvgPath = path.join(BRAND_DIR, 'icon-color.svg');
const monoSmallSvgPath = path.join(BRAND_DIR, 'icon-white-midnight.svg');
const lockupDarkSvgPath = path.join(BRAND_DIR, 'lockup-color-dark.svg');

renderPng(midnightSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo.png'), 1024, 1024);
renderPng(transparentSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo-transparent.png'), 1024, 1024);
renderPng(midnightSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo-512.png'), 512, 512);
renderPng(midnightSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo-192.png'), 192, 192);
renderPng(midnightSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo-180.png'), 180, 180);
renderPng(midnightSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo-120.png'), 120, 120);
renderPng(midnightSvgPath, path.join(PUBLIC_DIR, 'drive-therapy-logo-64.png'), 64, 64);

// Per Section 04 Minimum Size spec ("Full-color icon >= 48 CSS px; mono >= 24 px; Small sizes: prefer mono"):
renderPng(monoSmallSvgPath, path.join(PUBLIC_DIR, 'favicon-32.png'), 32, 32);
renderPng(monoSmallSvgPath, path.join(PUBLIC_DIR, 'favicon-16.png'), 16, 16);

// Horizontal Lockup Banner PNGs for GitHub README Hero, Wiki, and OpenGraph social card
renderPng(lockupDarkSvgPath, path.join(BRAND_DIR, 'drive-therapy-lockup-dark.png'), 1600, 400);
renderPng(
  path.join(BRAND_DIR, 'lockup-gray-light.svg'),
  path.join(BRAND_DIR, 'drive-therapy-lockup-gray.png'),
  1600,
  400
);
renderPng(
  path.join(BRAND_DIR, 'lockup-black-light.svg'),
  path.join(BRAND_DIR, 'drive-therapy-lockup-black.png'),
  1600,
  400
);
renderPng(
  path.join(BRAND_DIR, 'lockup-white-dark.svg'),
  path.join(BRAND_DIR, 'drive-therapy-lockup-white.png'),
  1600,
  400
);

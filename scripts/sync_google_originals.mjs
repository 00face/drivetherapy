#!/usr/bin/env node
/**
 * [WO-096] Authentic Google-Produced Originals & Brand Kit Sync
 *
 * Strictly separates three authentic Google asset classes:
 *   1. original-wallpaper — Google-published wallpapers (Earth View, Chrome Artist, PMH Hero)
 *   2. official-promo     — Historical Google Blog / press artwork (Stadia 2019, Tilt Brush 2016, etc.)
 *   3. brand-kit-palette  — Official Google Brand Kit logos & icons from local brand archive
 *
 * Preserves unmodified bytes, validates magic signatures, records SHA-256 receipts in
 * public/themes/originals/manifest.json, and NEVER fabricates substitutes for unreachable URLs.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BRAND_ROOT = '/home/face/Documents/Documents/design/brand';
const LOGOS_DIR = path.join(REPO_ROOT, 'public/themes/logos');
const ORIGINALS_DIR = path.join(REPO_ROOT, 'public/themes/originals');

fs.mkdirSync(LOGOS_DIR, { recursive: true });
fs.mkdirSync(ORIGINALS_DIR, { recursive: true });

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function detectMime(buf, ext) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 6 && buf.subarray(0, 3).toString('ascii') === 'GIF') {
    return 'image/gif';
  }
  const head = buf.subarray(0, 256).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml';
  }
  if (ext === '.svg') return 'image/svg+xml';
  return null;
}

const WS_BASE = path.join(BRAND_ROOT, 'Google-Workspace-logos/Google-Workspace-logos');

const LOCAL_BRAND_LOGOS = [
  { id: 'logo-workspace-admin', product: 'Google Admin', src: path.join(WS_BASE, 'Admin/logo_admin_2020q4_color_2x_web_96dp.png'), out: 'workspace-admin.png' },
  { id: 'logo-workspace-calendar', product: 'Google Calendar', src: path.join(WS_BASE, 'Calendar/logo_calendar_2026q2_color_2x_web_96dp.png'), out: 'workspace-calendar.png' },
  { id: 'logo-workspace-chat', product: 'Google Chat', src: path.join(WS_BASE, 'Chat/logo_chat_2026q2_color_2x_web_96dp.png'), out: 'workspace-chat.png' },
  { id: 'logo-workspace-classroom', product: 'Google Classroom', src: path.join(WS_BASE, 'Classroom/logo_classroom_color_2x_web_96dp.png'), out: 'workspace-classroom.png' },
  { id: 'logo-workspace-docs', product: 'Google Docs', src: path.join(WS_BASE, 'Docs/logo_docs_2026q2_color_2x_web_96dp.png'), out: 'workspace-docs.png' },
  { id: 'logo-workspace-drive', product: 'Google Drive', src: path.join(WS_BASE, 'Drive/logo_drive_2026q2_color_2x_web_96dp.png'), out: 'workspace-drive.png' },
  { id: 'logo-workspace-forms', product: 'Google Forms', src: path.join(WS_BASE, 'Forms/logo_forms_2026q3_color_2x_web_96dp.png'), out: 'workspace-forms.png' },
  { id: 'logo-workspace-gemini', product: 'Google Gemini', src: path.join(WS_BASE, 'Gemini/logo_gemini_2026_color_2x_web_96dp.png'), out: 'workspace-gemini.png' },
  { id: 'logo-workspace-gmail', product: 'Gmail', src: path.join(WS_BASE, 'Gmail/logo_gmail_2026q2_color_2x_web_96dp.png'), out: 'workspace-gmail.png' },
  { id: 'logo-workspace-keep', product: 'Google Keep', src: path.join(WS_BASE, 'Keep/logo_keep_2026q2_color_2x_web_96dp.png'), out: 'workspace-keep.png' },
  { id: 'logo-workspace-meet', product: 'Google Meet', src: path.join(WS_BASE, 'Meet/logo_meet_2026q2_color_2x_web_96dp.png'), out: 'workspace-meet.png' },
  { id: 'logo-workspace-sheets', product: 'Google Sheets', src: path.join(WS_BASE, 'Sheets/logo_sheets_2026q2_color_2x_web_96dp.png'), out: 'workspace-sheets.png' },
  { id: 'logo-workspace-sites', product: 'Google Sites', src: path.join(WS_BASE, 'Sites/logo_sites_2026_color_2x_web_96dp.png'), out: 'workspace-sites.png' },
  { id: 'logo-workspace-slides', product: 'Google Slides', src: path.join(WS_BASE, 'Slides/logo_slides_2026q2_color_2x_web_96dp.png'), out: 'workspace-slides.png' },
  { id: 'logo-workspace-voice', product: 'Google Voice', src: path.join(WS_BASE, 'Voice/logo_voice_2026q2_color_2x_web_96dp.png'), out: 'workspace-voice.png' },
  {
    id: 'logo-firebase',
    product: 'Firebase',
    src: path.join(BRAND_ROOT, 'firebase-brand-assets/Firebase Logo & Product Icons  2/Firebase Logo/Primary Logomark/SVG/Logomark_Full Color.svg'),
    out: 'firebase.svg',
  },
  {
    id: 'logo-google-pay',
    product: 'Google Pay',
    src: path.join(BRAND_ROOT, 'Google-Pay-Acceptance/Google-Pay-Acceptance/Google Pay Mark/google-pay-mark_800.svg'),
    out: 'google-pay.svg',
  },
];

const LOCAL_ORIGINALS = [
  {
    id: 'google-cloud-pmh-hero',
    product: 'Google Partner Marketing Hub / Cloud',
    assetType: 'original-wallpaper',
    sourceLabel: 'Google Partner Marketing Hub · Official Hero Background',
    src: path.join(BRAND_ROOT, '0_-_PMH_-_BG_-_Hero.jpg'),
    out: 'google-pmh-hero.jpg',
  },
  {
    id: 'google-tilt-brush-2016',
    product: 'Google Tilt Brush (2016)',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog (2016) · Official 1200px Tilt Brush Artwork',
    sourceUrl: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Tilt_Brush_Gf7T2Bu.width-1200.format-webp.webp',
    src: path.join(BRAND_ROOT, 'Tilt_Brush_Gf7T2Bu.width-1200.format-webp.webp'),
    out: 'google-tilt-brush-2016.webp',
  },
  {
    id: 'google-stadia-2019-launch',
    product: 'Google Stadia (2019)',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog (2019) · Stadia Launch Promotional Artwork',
    sourceUrl: 'https://blog.google/products-and-platforms/products/stadia/stadia-launches-today/',
    src: path.join(REPO_ROOT, 'public/themes/wallpapers/google-stadia.jpg'),
    out: 'google-stadia-2019.jpg',
  },
  {
    id: 'google-sky-3d-g',
    product: 'Google Brand',
    assetType: 'official-promo',
    sourceLabel: 'Google Partner Marketing Hub · Glass G Sky Artwork',
    src: path.join(REPO_ROOT, 'public/themes/wallpapers/google-sky.jpg'),
    out: 'google-sky-brand.jpg',
  },
];

const REMOTE_GOOGLE_ORIGINALS = [
  {
    id: 'google-earth-view',
    product: 'Google Earth View',
    assetType: 'original-wallpaper',
    sourceLabel: 'Google Earth View · Official Satellite Wallpaper',
    url: 'https://www.gstatic.com/prettyearth/assets/full/1003.jpg',
    out: 'google-earth-view-1003.jpg',
  },
  {
    id: 'google-search-ai-mode',
    product: 'Google Search',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog · AI Mode Visual Fan-Out (1200px)',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Visual_Fan-out_-_16-9.width-1200.format-webp.webp',
    out: 'google-search-ai-mode.webp',
  },
  {
    id: 'google-ads-creative',
    product: 'Google Ads',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog · Ads Creative Studio Original PNG',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/Project_library.png',
    out: 'google-ads-creative.png',
  },
  {
    id: 'google-analytics-product',
    product: 'Google Analytics',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog · Analytics Product Imagery (1200px)',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/Screen_Shot_2022-09-21_at_9.08.4.width-1200.format-webp.webp',
    out: 'google-analytics-product.webp',
  },
  {
    id: 'google-android-monochrome',
    product: 'Android',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog · Android Monochrome Theme Artwork (1200px)',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/ANDROID_MONOCHROME_THEME.width-1200.format-webp.webp',
    out: 'google-android-monochrome.webp',
  },
  {
    id: 'google-chrome-artist',
    product: 'Google Chrome',
    assetType: 'original-wallpaper',
    sourceLabel: 'Google Blog · Chrome Rising Artists Series (Kaitlin)',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/Kaitlin.png',
    out: 'google-chrome-artist-kaitlin.png',
  },
  {
    id: 'google-forms-template',
    product: 'Google Forms',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog · Original Forms Template Animation',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/SubmitATemplate_4_OltLT2d.gif',
    out: 'google-forms-template.gif',
  },
  {
    id: 'google-marketing-platform',
    product: 'Google Marketing Platform',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog (2018) · Original GMP Brand Animation',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/original_images/GMP_Logo_Animation_Loop_kqdSyht.gif',
    out: 'google-marketing-platform-2018.gif',
  },
  {
    id: 'google-pay-2018',
    product: 'Google Pay',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog (2018) · Google Pay Launch Artwork (1200px)',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/GPay_180131_GooglePay_Blog_v2.7_.width-1200.format-webp.webp',
    out: 'google-pay-2018.webp',
  },
  {
    id: 'google-youtube-20th',
    product: 'YouTube',
    assetType: 'official-promo',
    sourceLabel: 'Google Blog · YouTube 20th Anniversary Artwork (1200px)',
    url: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/YT20_LOGO.width-1200.format-webp.webp',
    out: 'google-youtube-20th.webp',
  },
];

async function run() {
  const records = [];

  // 1. Copy official local brand kit logos
  for (const item of LOCAL_BRAND_LOGOS) {
    if (!fs.existsSync(item.src)) {
      records.push({
        id: item.id,
        product: item.product,
        assetType: 'brand-kit-palette',
        status: 'missing-local',
        sourcePath: item.src,
      });
      continue;
    }
    const buf = fs.readFileSync(item.src);
    const mimeType = detectMime(buf, path.extname(item.out));
    const dest = path.join(LOGOS_DIR, item.out);
    fs.writeFileSync(dest, buf);
    records.push({
      id: item.id,
      product: item.product,
      assetType: 'brand-kit-palette',
      localPath: `/themes/logos/${item.out}`,
      bytes: buf.length,
      mimeType,
      sha256: sha256Buffer(buf),
      status: 'verified',
    });
  }

  // 2. Copy local authentic originals
  for (const item of LOCAL_ORIGINALS) {
    if (!fs.existsSync(item.src)) {
      records.push({
        id: item.id,
        product: item.product,
        assetType: item.assetType,
        sourceLabel: item.sourceLabel,
        status: 'missing-local',
      });
      continue;
    }
    const buf = fs.readFileSync(item.src);
    const mimeType = detectMime(buf, path.extname(item.out));
    const dest = path.join(ORIGINALS_DIR, item.out);
    fs.writeFileSync(dest, buf);
    records.push({
      id: item.id,
      product: item.product,
      assetType: item.assetType,
      sourceLabel: item.sourceLabel,
      sourceUrl: item.sourceUrl || null,
      localPath: `/themes/originals/${item.out}`,
      bytes: buf.length,
      mimeType,
      sha256: sha256Buffer(buf),
      status: 'verified',
    });
  }

  // 3. Download remote Google-hosted originals (unmodified bytes, strict MIME check)
  for (const item of REMOTE_GOOGLE_ORIGINALS) {
    const dest = path.join(ORIGINALS_DIR, item.out);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(item.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DriveTherapy-GoogleOriginalsSync/1.0' },
      });
      clearTimeout(timeout);
      if (!res.ok) {
        records.push({
          id: item.id,
          product: item.product,
          assetType: item.assetType,
          sourceLabel: item.sourceLabel,
          sourceUrl: item.url,
          status: `http-${res.status}`,
        });
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = detectMime(buf, path.extname(item.out));
      if (!mimeType || buf.length < 512) {
        records.push({
          id: item.id,
          product: item.product,
          assetType: item.assetType,
          sourceLabel: item.sourceLabel,
          sourceUrl: item.url,
          status: 'invalid-media-bytes',
        });
        continue;
      }
      fs.writeFileSync(dest, buf);
      records.push({
        id: item.id,
        product: item.product,
        assetType: item.assetType,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.url,
        localPath: `/themes/originals/${item.out}`,
        bytes: buf.length,
        mimeType,
        sha256: sha256Buffer(buf),
        status: 'verified',
      });
    } catch (err) {
      records.push({
        id: item.id,
        product: item.product,
        assetType: item.assetType,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.url,
        status: 'unreachable',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    policy: 'Authentic Google-produced originals only. Zero fabricated or AI-substituted artwork.',
    verifiedCount: records.filter((r) => r.status === 'verified').length,
    totalCount: records.length,
    records,
  };

  fs.writeFileSync(
    path.join(ORIGINALS_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );

  console.log(`[Google Originals Sync] Verified ${manifest.verifiedCount}/${manifest.totalCount} assets.`);
  for (const r of records) {
    console.log(`  [${r.status}] ${r.id} -> ${r.localPath || r.sourceUrl || ''}${r.bytes ? ` (${Math.round(r.bytes / 1024)} KB, ${r.mimeType})` : ''}`);
  }
}

run();

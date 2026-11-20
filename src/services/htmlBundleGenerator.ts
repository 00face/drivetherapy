/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-Contained Standalone HTML Client Delivery Bundle Generator
 * Generates an offline interactive portfolio with client review and feedback export.
 */

import { PortfolioProject, MediaAsset } from '../types';
import { generateXmpXml } from './xmpExporter';
import { SimpleZipBuilder } from './zipExporter';
import { saveFileToOS } from './localFileSystem';

export function generateStandalonePortfolioHtml(
  project: PortfolioProject,
  assets: MediaAsset[]
): string {
  const selectedAssets = assets.filter((a) => project.selectedAssetIds.includes(a.id));

  const itemsHtml = selectedAssets
    .map(
      (asset, idx) => `
    <div class="card" id="card-${asset.id}" data-id="${asset.id}" data-name="${escapeHtml(asset.name)}">
      <div class="image-wrapper">
        <img src="${asset.thumbnailUrl}" alt="${escapeHtml(asset.name)}" loading="lazy" />
        ${
          project.showWatermark
            ? `<div class="watermark">${escapeHtml(project.watermarkText)}</div>`
            : ''
        }
      </div>
      <div class="card-meta">
        <span class="asset-title">${escapeHtml(asset.name)}</span>
        <span class="asset-num">#${idx + 1}</span>
      </div>
      <div class="client-actions">
        <button class="action-btn approve" onclick="setFeedback('${asset.id}', 'approved')">✓ Approve</button>
        <button class="action-btn revise" onclick="setFeedback('${asset.id}', 'revise')">✎ Request Edit</button>
        <button class="action-btn favorite" onclick="setFeedback('${asset.id}', 'favorite')">★ Favorite</button>
      </div>
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(project.title)} — Client Proof Gallery</title>
  <style>
    :root {
      --accent: ${project.accentColor || '#1074B1'};
      --bg: #0B0F19;
      --card-bg: #141B2D;
      --text: #F8FAFC;
      --text-muted: #94A3B8;
      --border: rgba(255, 255, 255, 0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 2rem 1.5rem;
    }
    .header {
      max-width: 1200px;
      margin: 0 auto 3rem auto;
      text-align: center;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      background: rgba(16, 116, 177, 0.15);
      color: var(--accent);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 0.5rem; }
    .client { font-size: 1rem; color: var(--accent); font-weight: 600; margin-bottom: 0.75rem; }
    .desc { max-width: 650px; margin: 0 auto; color: var(--text-muted); font-size: 0.95rem; }
    .gallery {
      max-width: 1300px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.75rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover { transform: translateY(-4px); border-color: var(--accent); }
    .card.status-approved { border: 2px solid #52B197; }
    .card.status-revise { border: 2px solid #EAB308; }
    .card.status-favorite { border: 2px solid #A61B7A; }
    .image-wrapper {
      position: relative;
      aspect-ratio: 4/3;
      background: #000;
      overflow: hidden;
    }
    .image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .watermark {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.4);
      font-size: 1.1rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      transform: rotate(-25deg);
      pointer-events: none;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    .card-meta {
      padding: 0.85rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    .asset-title { font-size: 0.85rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
    .asset-num { font-size: 0.75rem; color: var(--text-muted); font-family: monospace; }
    .client-actions {
      padding: 0.75rem 1rem;
      display: flex;
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
    }
    .action-btn {
      flex: 1;
      padding: 0.45rem 0.25rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .action-btn:hover { background: rgba(255, 255, 255, 0.15); }
    .action-btn.active.approve { background: #52B197; color: white; border-color: #52B197; }
    .action-btn.active.revise { background: #EAB308; color: black; border-color: #EAB308; }
    .action-btn.active.favorite { background: #A61B7A; color: white; border-color: #A61B7A; }
    .footer-bar {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20, 27, 45, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      padding: 0.75rem 1.75rem;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      z-index: 50;
    }
    .footer-summary { font-size: 0.85rem; font-weight: 600; }
    .export-btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.5rem 1.25rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16, 116, 177, 0.4);
    }
    .export-btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">Official Client Proofing Delivery</div>
    <h1>${escapeHtml(project.title)}</h1>
    <div class="client">Prepared for ${escapeHtml(project.clientName)}</div>
    <p class="desc">${escapeHtml(project.description)}</p>
  </div>

  <div class="gallery">
    ${itemsHtml}
  </div>

  <div class="footer-bar">
    <div class="footer-summary" id="feedback-summary">0 Approved · 0 Revisions</div>
    <button class="export-btn" onclick="exportFeedbackJson()">Export Review Feedback (JSON)</button>
  </div>

  <script>
    const feedbackState = {};

    function setFeedback(id, status) {
      if (feedbackState[id] === status) {
        delete feedbackState[id];
      } else {
        feedbackState[id] = status;
      }
      updateUI();
    }

    function updateUI() {
      document.querySelectorAll('.card').forEach(card => {
        const id = card.getAttribute('data-id');
        const st = feedbackState[id];
        card.classList.remove('status-approved', 'status-revise', 'status-favorite');
        card.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
        if (st) {
          card.classList.add('status-' + st);
          const btn = card.querySelector('.action-btn.' + st);
          if (btn) btn.classList.add('active');
        }
      });

      let approved = 0, revise = 0, favorite = 0;
      Object.values(feedbackState).forEach(val => {
        if (val === 'approved') approved++;
        if (val === 'revise') revise++;
        if (val === 'favorite') favorite++;
      });
      document.getElementById('feedback-summary').innerText =
        approved + ' Approved · ' + revise + ' Edit Requests · ' + favorite + ' Favorites';
    }

    function exportFeedbackJson() {
      const payload = {
        project: ${JSON.stringify(project.title)},
        client: ${JSON.stringify(project.clientName)},
        timestamp: new Date().toISOString(),
        decisions: Object.keys(feedbackState).map(id => {
          const card = document.getElementById('card-' + id);
          return {
            assetId: id,
            filename: card ? card.getAttribute('data-name') : '',
            status: feedbackState[id]
          };
        })
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'client_review_' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return (str || '').replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return m;
    }
  });
}

// 1-Click Export of Standalone HTML Gallery
export async function exportStandaloneHtmlPortfolio(
  project: PortfolioProject,
  assets: MediaAsset[]
): Promise<void> {
  const html = generateStandalonePortfolioHtml(project, assets);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const filename = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_proof_gallery.html`;
  await saveFileToOS(filename, blob);
}

// 1-Click Export of Deliverables ZIP Archive (HTML + XMP Sidecars + Project Manifest)
export async function exportPortfolioDeliverablesZip(
  project: PortfolioProject,
  assets: MediaAsset[]
): Promise<void> {
  const zip = new SimpleZipBuilder();
  const selectedAssets = assets.filter((a) => project.selectedAssetIds.includes(a.id));

  // 1. Add Standalone HTML
  const html = generateStandalonePortfolioHtml(project, assets);
  zip.addFile('index.html', html);

  // 2. Add Project Manifest JSON
  zip.addFile('manifest.json', JSON.stringify(project, null, 2));

  // 3. Add XMP sidecars for each asset
  for (const asset of selectedAssets) {
    const xmp = generateXmpXml(asset);
    const xmpName = `sidecars/${asset.name.replace(/\.[^/.]+$/, '')}.xmp`;
    zip.addFile(xmpName, xmp);
  }

  const zipBlob = zip.buildBlob();
  const filename = `${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_delivery.zip`;
  await saveFileToOS(filename, zipBlob);
}

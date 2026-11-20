/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Professional Adobe XMP & Capture One Sidecar Metadata Generator
 * Non-destructive industry-standard metadata interchange.
 */

import { MediaAsset, ColorLabel } from '../types';
import { saveFileToOS } from './localFileSystem';

// Convert Drive Therapy ColorLabel to Adobe XMP label and Photoshop Urgency code
export function mapColorLabelToXmp(colorLabel?: ColorLabel): { label: string; urgency: number } {
  switch (colorLabel) {
    case 'red':
      return { label: 'Red', urgency: 1 };
    case 'yellow':
      return { label: 'Yellow', urgency: 2 };
    case 'green':
      return { label: 'Green', urgency: 3 };
    case 'blue':
      return { label: 'Blue', urgency: 4 };
    case 'purple':
      return { label: 'Purple', urgency: 5 };
    default:
      return { label: '', urgency: 0 };
  }
}

// Generate valid Adobe XMP XML string
export function generateXmpXml(asset: MediaAsset): string {
  const { label, urgency } = mapColorLabelToXmp(asset.colorLabel);
  const rating = asset.rating || 0;
  const tagsXml = (asset.tags || [])
    .map((tag) => `     <rdf:li>${escapeXml(tag)}</rdf:li>`)
    .join('\n');

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Drive Therapy XMP Engine v1.7">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:dt="http://drivetherapy.internal/1.0/">
   <xmp:Rating>${rating}</xmp:Rating>
   ${label ? `<xmp:Label>${label}</xmp:Label>` : ''}
   ${urgency > 0 ? `<photoshop:Urgency>${urgency}</photoshop:Urgency>` : ''}
   <dt:cullingStatus>${asset.cullingStatus}</dt:cullingStatus>
   <dt:sharpnessScore>${asset.quality?.sharpness || 0}</dt:sharpnessScore>
   ${asset.isBurstHero ? '<dt:isBurstHero>true</dt:isBurstHero>' : ''}
   ${
     asset.tags && asset.tags.length > 0
       ? `<dc:subject>
    <rdf:Bag>
${tagsXml}
    </rdf:Bag>
   </dc:subject>`
       : ''
   }
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Export single asset XMP file
export async function exportAssetXmp(asset: MediaAsset): Promise<void> {
  const xmpContent = generateXmpXml(asset);
  const blob = new Blob([xmpContent], { type: 'application/rdf+xml;charset=utf-8' });
  const filename = `${asset.name.replace(/\.[^/.]+$/, '')}.xmp`;
  await saveFileToOS(filename, blob);
}

// Generate culling report content as string
export function generateCullingReportContent(assets: MediaAsset[], format: 'json' | 'csv' = 'json'): string {
  if (format === 'json') {
    const report = {
      summary: {
        total: assets.length,
        picked: assets.filter((a) => a.cullingStatus === 'picked').length,
        rejected: assets.filter((a) => a.cullingStatus === 'rejected').length,
        unrated: assets.filter((a) => a.cullingStatus === 'unrated').length,
      },
      items: assets.map((a) => ({
        filename: a.name,
        rating: a.rating,
        colorLabel: a.colorLabel || 'none',
        cullingStatus: a.cullingStatus,
        isBurstHero: a.isBurstHero || false,
        sharpness: a.quality?.sharpness || 0,
        tags: a.tags,
        camera: a.exif?.camera,
        lens: a.exif?.lens,
        dateTaken: a.exif?.dateTaken,
      })),
    };
    return JSON.stringify(report, null, 2);
  } else {
    const headers = ['Filename', 'Status', 'Rating', 'ColorLabel', 'IsHero', 'Sharpness', 'Tags', 'Camera', 'Date'];
    const rows = assets.map((a) => [
      a.name,
      a.cullingStatus,
      a.rating || 0,
      a.colorLabel || 'none',
      a.isBurstHero ? 'Yes' : 'No',
      a.quality?.sharpness || 0,
      `"${(a.tags || []).join('; ')}"`,
      `"${a.exif?.camera || ''}"`,
      `"${a.exif?.dateTaken || ''}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

// Export batch XMP table as JSON/CSV
export async function exportCullingReport(assets: MediaAsset[], format: 'json' | 'csv' = 'json'): Promise<void> {
  const content = generateCullingReportContent(assets, format);
  const mime = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
  const blob = new Blob([content], { type: mime });
  await saveFileToOS(`culling_report_${Date.now()}.${format}`, blob);
}

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectAndClusterBursts, clusterNearDuplicates } from '../src/services/burstDetection.ts';
import { generateXmpXml, generateCullingReportContent } from '../src/services/xmpExporter.ts';
import { SimpleZipBuilder } from '../src/services/zipExporter.ts';
import { generateStandalonePortfolioHtml } from '../src/services/htmlBundleGenerator.ts';
import { searchCatalogByVector } from '../src/services/providerRegistry.ts';
import { MediaAsset, PortfolioProject } from '../src/types/index.ts';

function createMockAsset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: 'mock-1',
    name: 'photo.jpg',
    source: 'local',
    category: 'image',
    mimeType: 'image/jpeg',
    extension: '.jpg',
    path: '/Local OS/photo.jpg',
    sizeBytes: 1024,
    modifiedTime: new Date().toISOString(),
    thumbnailUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    isCached: true,
    cullingStatus: 'unrated',
    rating: 0,
    tags: [],
    faces: [],
    quality: {
      sharpness: 80,
      exposure: 80,
      overall: 80,
      isBlurry: false,
    },
    palette: ['#000000', '#ffffff'],
    exif: {},
    ...overrides,
  };
}

describe('Drive Therapy Master Unit Suite', () => {

  test('Burst clustering groups sequential captures within 3.5s and crowns sharpest hero', () => {
    const baseTime = new Date('2026-05-01T12:00:00Z').getTime();
    const assets: MediaAsset[] = [
      createMockAsset({
        id: 'asset-1',
        name: 'Burst 1',
        modifiedTime: new Date(baseTime).toISOString(),
        quality: { sharpness: 60, exposure: 75, overall: 65, isBlurry: false },
      }),
      createMockAsset({
        id: 'asset-2',
        name: 'Burst 2',
        modifiedTime: new Date(baseTime + 1000).toISOString(),
        quality: { sharpness: 92, exposure: 88, overall: 90, isBlurry: false }, // Sharpest hero
      }),
      createMockAsset({
        id: 'asset-3',
        name: 'Burst 3',
        modifiedTime: new Date(baseTime + 2200).toISOString(),
        quality: { sharpness: 75, exposure: 80, overall: 77, isBlurry: false },
      }),
      createMockAsset({
        id: 'asset-4',
        name: 'Separate Photo',
        modifiedTime: new Date(baseTime + 10000).toISOString(),
        quality: { sharpness: 80, exposure: 80, overall: 80, isBlurry: false },
      }),
    ];

    const { burstGroups, clusteredAssets } = detectAndClusterBursts(assets);
    assert.equal(burstGroups.length, 1, 'Should find exactly 1 multi-shot burst');
    assert.equal(burstGroups[0].assetIds.length, 3, 'Burst cluster should contain 3 assets');
    assert.equal(burstGroups[0].heroAssetId, 'asset-2', 'Asset 2 with sharpness 92 must be crowned hero');

    const heroAsset = clusteredAssets.find(a => a.id === 'asset-2');
    assert.equal(heroAsset?.isBurstHero, true, 'Hero asset flag must be set to true');
  });

  test('Near duplicate clustering groups perceptual dHash within Hamming distance threshold <= 6', () => {
    const hashA = '0000000000000000';
    const hashB = '0000000000000007'; // 3 bits flipped
    const hashC = 'ffffffffffffffff'; // 64 bits flipped

    const assets: MediaAsset[] = [
      createMockAsset({
        id: 'dup-1',
        name: 'Photo A',
        pHash: hashA,
        quality: { sharpness: 70, exposure: 80, overall: 75, isBlurry: false },
      }),
      createMockAsset({
        id: 'dup-2',
        name: 'Photo B (Near Dup)',
        pHash: hashB,
        quality: { sharpness: 88, exposure: 85, overall: 87, isBlurry: false },
      }),
      createMockAsset({
        id: 'unique-1',
        name: 'Photo C (Different)',
        pHash: hashC,
        quality: { sharpness: 85, exposure: 85, overall: 85, isBlurry: false },
      }),
    ];

    const { duplicateClusters } = clusterNearDuplicates(assets, 6);
    assert.equal(duplicateClusters.length, 1, 'Should cluster the two near duplicates');
    assert.equal(duplicateClusters[0].heroAsset.id, 'dup-2', 'Photo B with score 88 should be hero');
    assert.equal(duplicateClusters[0].duplicates.length, 1);
    assert.equal(duplicateClusters[0].duplicates[0].id, 'dup-1');
  });

  test('Adobe XMP Sidecar XML generator produces standard compliant metadata tags', () => {
    const asset = createMockAsset({
      id: 'xmp-test-1',
      name: 'DSC_0042.NEF',
      mimeType: 'image/x-nikon-nef',
      cullingStatus: 'picked',
      rating: 5,
      colorLabel: 'red',
      tags: ['automotive', 'sunset', 'trackday'],
    });

    const xmpXml = generateXmpXml(asset);
    assert.ok(xmpXml.includes('x:xmpmeta'), 'Contains root xmpmeta');
    assert.ok(xmpXml.includes('<xmp:Rating>5</xmp:Rating>'), 'Contains rating 5');
    assert.ok(xmpXml.includes('<xmp:Label>Red</xmp:Label>'), 'Contains Red label');
    assert.ok(xmpXml.includes('<rdf:li>automotive</rdf:li>'), 'Contains automotive tag in dc:subject');
    assert.ok(xmpXml.includes('<rdf:li>sunset</rdf:li>'), 'Contains sunset tag in dc:subject');
  });

  test('Culling Report Content produces valid JSON and CSV formats', () => {
    const assets: MediaAsset[] = [
      createMockAsset({
        id: 'r1',
        name: 'Car1.jpg',
        cullingStatus: 'picked',
        rating: 4,
        colorLabel: 'green',
        tags: ['hero'],
      }),
      createMockAsset({
        id: 'r2',
        name: 'Car2.jpg',
        cullingStatus: 'rejected',
        rating: 0,
        colorLabel: 'none',
        tags: [],
      }),
    ];

    const jsonReport = generateCullingReportContent(assets, 'json');
    const parsed = JSON.parse(jsonReport);
    assert.equal(parsed.summary.total, 2);
    assert.equal(parsed.summary.picked, 1);
    assert.equal(parsed.summary.rejected, 1);

    const csvReport = generateCullingReportContent(assets, 'csv');
    assert.ok(csvReport.includes('Filename,Status,Rating,ColorLabel'));
    assert.ok(csvReport.includes('Car1.jpg,picked,4,green'));
    assert.ok(csvReport.includes('Car2.jpg,rejected,0,none'));
  });

  test('SimpleZipBuilder constructs valid ZIP binary archive with valid signatures', async () => {
    const zip = new SimpleZipBuilder();
    zip.addTextFile('hello.txt', 'Hello Drive Therapy!');
    zip.addBinaryFile('data.bin', new Uint8Array([1, 2, 3, 4, 5, 6]));

    const blob = zip.buildBlob();
    assert.equal(blob.type, 'application/zip');
    assert.ok(blob.size > 100, 'ZIP blob must have non-zero file and directory headers');

    const buffer = new Uint8Array(await blob.arrayBuffer());
    // First 4 bytes of standard ZIP local file header must be 0x50, 0x4B, 0x03, 0x04 (PK\x03\x04)
    assert.equal(buffer[0], 0x50);
    assert.equal(buffer[1], 0x4b);
    assert.equal(buffer[2], 0x03);
    assert.equal(buffer[3], 0x04);
  });

  test('HTML Standalone Portfolio generator injects interactive client review controls', () => {
    const assets: MediaAsset[] = [
      createMockAsset({
        id: 'p1',
        name: 'Trackday Hero.jpg',
        thumbnailUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        tags: ['gt3rs'],
      }),
    ];

    const project: PortfolioProject = {
      id: 'proj-1',
      title: 'Spring Trackday 2026',
      clientName: 'Porsche Motorsport',
      description: 'Client review gallery',
      layout: 'masonry',
      selectedAssetIds: ['p1'],
      accentColor: '#1074B1',
      showWatermark: false,
      watermarkText: '',
      createdAt: new Date().toISOString(),
    };

    const html = generateStandalonePortfolioHtml(project, assets);

    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Spring Trackday 2026'));
    assert.ok(html.includes('Export Review Feedback (JSON)'));
    assert.ok(html.includes('Approve'));
    assert.ok(html.includes('Request Edit'));
  });

  test('searchCatalogByVector computes offline cosine similarity ranking correctly', () => {
    const assets: MediaAsset[] = [
      createMockAsset({
        id: 'vec-1',
        name: 'Exact Match',
        vectorEmbedding: [1.0, 0.0, 0.0],
      }),
      createMockAsset({
        id: 'vec-2',
        name: 'Orthogonal',
        vectorEmbedding: [0.0, 1.0, 0.0],
      }),
      createMockAsset({
        id: 'vec-3',
        name: 'Partial Match',
        vectorEmbedding: [0.7071, 0.7071, 0.0],
      }),
    ];

    const results = searchCatalogByVector(assets, [1.0, 0.0, 0.0], 10);
    assert.equal(results.length, 3, 'All 3 items scored');
    assert.equal(results[0].asset.id, 'vec-1', 'Exact match must have highest similarity at index 0');
    assert.ok(results[0].similarity > 0.99, 'Similarity of exact match should be ~1.0');
    assert.equal(results[1].asset.id, 'vec-3', 'Partial match must be second');
    assert.ok(results[1].similarity > 0.69 && results[1].similarity < 0.72, 'Partial match cosine ~0.707');
    assert.equal(results[2].asset.id, 'vec-2', 'Orthogonal must have similarity 0');
    assert.equal(results[2].similarity, 0);
  });

});

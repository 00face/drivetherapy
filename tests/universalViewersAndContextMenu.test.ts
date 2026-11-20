import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { MediaAsset } from '../src/types/index.ts';
import { getAllFormatDefinitions } from '../src/services/fileFormatEngine.ts';
import {
  getContextMenuSpecForAsset,
  parse3dWavefrontObjSummary,
  parseCubeLutData,
  parseCsvToGrid,
  parseZipDirectoryEntries,
  serializeGridToCsv,
} from '../src/services/universalFileViewerEngine.ts';

function makeAsset(name: string, mimeType = ''): MediaAsset {
  const ext = (name.split('.').pop() || '').toUpperCase();
  return {
    id: `test_${name}`,
    name,
    source: 'local',
    category: 'data',
    mimeType,
    extension: ext,
    path: `/tmp/${name}`,
    sizeBytes: 1024,
    modifiedTime: '2026-11-17T12:00:00.000Z',
    thumbnailUrl: '',
    isCached: true,
    cullingStatus: 'unrated',
    rating: 0,
    tags: [],
    faces: [],
    quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
    palette: [],
    exif: {},
  };
}

describe('Universal Viewers, Editors, Context-Aware PiP & RMB Context Menu Engine', () => {
  test('routes all 16 FormatViewerKind and 9 FormatEditorKind specs across categories', () => {
    const cases: Array<{
      name: string;
      mime?: string;
      expectedViewer: string;
      expectedRoute: string | null;
      expectedPip: 'media' | 'reference' | null;
      expectedMediaPlayer: boolean;
      expectedSubtitle?: boolean;
    }> = [
      {
        name: 'photo.jpg',
        expectedViewer: 'image-lightbox',
        expectedRoute: 'pixel-studio',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'capture.cr3',
        expectedViewer: 'raw-demosaic-viewer',
        expectedRoute: 'pixel-studio',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'clip.mp4',
        expectedViewer: 'video-player',
        expectedRoute: 'video-trimmer',
        expectedPip: 'media',
        expectedMediaPlayer: true,
      },
      {
        name: 'master.flac',
        expectedViewer: 'audio-player',
        expectedRoute: 'music-eq-studio',
        expectedPip: 'media',
        expectedMediaPlayer: true,
      },
      {
        name: 'contract.pdf',
        expectedViewer: 'pdf-viewer',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'lyrics.srt',
        expectedViewer: 'document-reader',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
        expectedSubtitle: true,
      },
      {
        name: 'README.md',
        expectedViewer: 'markdown-viewer',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'sheet.csv',
        expectedViewer: 'spreadsheet-grid',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: null,
        expectedMediaPlayer: false,
      },
      {
        name: 'index.ts',
        expectedViewer: 'code-viewer',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'manifest.json',
        expectedViewer: 'json-tree-viewer',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'bundle.zip',
        expectedViewer: 'archive-inspector',
        expectedRoute: null,
        expectedPip: null,
        expectedMediaPlayer: false,
      },
      {
        name: 'catalog.sqlite',
        expectedViewer: 'sqlite-inspector',
        expectedRoute: null,
        expectedPip: null,
        expectedMediaPlayer: false,
      },
      {
        name: 'mesh.stl',
        expectedViewer: '3d-preview',
        expectedRoute: 'cad-3d-studio',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'water.frag',
        expectedViewer: 'shader-viewer',
        expectedRoute: 'shader-studio',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'N37W122.hgt',
        expectedViewer: 'heightmap-viewer',
        expectedRoute: 'heightmap-studio',
        expectedPip: 'reference',
        expectedMediaPlayer: false,
      },
      {
        name: 'font.woff2',
        expectedViewer: 'font-specimen',
        expectedRoute: null,
        expectedPip: null,
        expectedMediaPlayer: false,
      },
      {
        name: 'app.exe',
        expectedViewer: 'hex-inspector',
        expectedRoute: null,
        expectedPip: null,
        expectedMediaPlayer: false,
      },
      {
        name: 'design.afdesign',
        expectedViewer: 'download-only',
        expectedRoute: 'lightbox-inline-editor',
        expectedPip: null,
        expectedMediaPlayer: false,
      },
    ];

    const coveredViewers = new Set<string>();
    for (const tc of cases) {
      const spec = getContextMenuSpecForAsset(makeAsset(tc.name, tc.mime));
      assert.equal(spec.format.viewer, tc.expectedViewer, `Viewer mismatch on ${tc.name}`);
      assert.equal(spec.editorRoute, tc.expectedRoute, `Editor route mismatch on ${tc.name}`);
      assert.equal(spec.pipMode, tc.expectedPip, `PiP mode mismatch on ${tc.name}`);
      assert.equal(spec.isMediaPlayerCompatible, tc.expectedMediaPlayer, `Media player mismatch on ${tc.name}`);
      if (tc.expectedSubtitle !== undefined) {
        assert.equal(spec.isSubtitleOrLyric, tc.expectedSubtitle);
      }
      assert.ok(spec.viewerLabel.length > 0);
      assert.ok(spec.categoryActions.includes('inspect-format-db'));
      coveredViewers.add(spec.format.viewer);
    }

    assert.equal(getContextMenuSpecForAsset(makeAsset('film.cube')).editorRoute, 'lightbox-inline-editor');
    assert.equal(coveredViewers.size, 18, 'Expected all 18 FormatViewerKind targets verified');
    assert.ok(getAllFormatDefinitions().some((f) => f.editor === 'metadata-xmp-editor'));
  });

  test('parseCsvToGrid and serializeGridToCsv handle quoted commas, TSV, and cell edits', () => {
    const csv = 'Name,Note,Score\n"Doe, Jane","Said ""Hi""",98\nAlex,Ready,100';
    const parsed = parseCsvToGrid(csv);
    assert.equal(parsed.delimiter, ',');
    assert.deepEqual(parsed.headers, ['Name', 'Note', 'Score']);
    assert.equal(parsed.rows[0][0], 'Doe, Jane');
    assert.equal(parsed.rows[0][1], 'Said "Hi"');
    assert.equal(parsed.rows[1][2], '100');

    parsed.rows[1][2] = '99';
    const reserialized = serializeGridToCsv(parsed.headers, parsed.rows, parsed.delimiter);
    const reparsed = parseCsvToGrid(reserialized);
    assert.equal(reparsed.rows[1][2], '99');

    const tsv = parseCsvToGrid('ColA\tColB\n1\t2');
    assert.equal(tsv.delimiter, '\t');
    assert.deepEqual(tsv.rows[0], ['1', '2']);
  });

  test('parseZipDirectoryEntries extracts file paths and byte sizes from ZIP headers', () => {
    const buildLocalEntry = (name: string, compSize: number, uncompSize: number): number[] => {
      const nameBytes = Array.from(Buffer.from(name, 'utf8'));
      const header = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(header.buffer);
      header.set([0x50, 0x4b, 0x03, 0x04], 0);
      view.setUint32(18, compSize, true);
      view.setUint32(22, uncompSize, true);
      view.setUint16(26, nameBytes.length, true);
      header.set(nameBytes, 30);
      return Array.from(header);
    };

    const zipBytes = new Uint8Array([
      ...buildLocalEntry('docs/readme.md', 420, 1024),
      ...buildLocalEntry('data/catalog.json', 880, 2400),
    ]);

    const entries = parseZipDirectoryEntries(zipBytes);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].name, 'docs/readme.md');
    assert.equal(entries[0].compressedBytes, 420);
    assert.equal(entries[0].uncompressedBytes, 1024);
    assert.equal(entries[1].name, 'data/catalog.json');
  });

  test('parse3dWavefrontObjSummary and parseCubeLutData extract geometry and color cube specs', () => {
    const obj = [
      'v 0 0 0',
      'v 1 0 0',
      'v 1 1 0',
      'v 0 1 0',
      'vn 0 0 1',
      'f 1 2 3 4',
    ].join('\n');
    const summary = parse3dWavefrontObjSummary(obj);
    assert.equal(summary.vertexCount, 4);
    assert.equal(summary.normalCount, 1);
    assert.equal(summary.faceCount, 1);
    assert.equal(summary.edges.length, 4);

    const cube = [
      'TITLE "Studio Film"',
      'LUT_3D_SIZE 33',
      'DOMAIN_MIN 0.0 0.0 0.0',
      'DOMAIN_MAX 1.0 1.0 1.0',
      '0.0 0.0 0.0',
      '1.0 0.95 0.90',
    ].join('\n');
    const lut = parseCubeLutData(cube);
    assert.equal(lut.title, 'Studio Film');
    assert.equal(lut.size3d, 33);
    assert.deepEqual(lut.domainMax, [1, 1, 1]);
    assert.equal(lut.sampleTriplets.length, 2);
  });
});

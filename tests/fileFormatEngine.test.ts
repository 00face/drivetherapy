import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFile,
  extractUniversalFileMetadata,
  getAllFormatDefinitions,
  getFormatDatabaseStats,
  lookupFileFormat,
  searchFormatDatabase,
  sniffMagicBytes,
  upsertFormatDefinition,
} from '../src/services/fileFormatEngine.ts';
import { validateFormatsList } from '../scripts/formatDbTool.ts';
import type { FormatFamily } from '../src/types/fileFormats.ts';
import type { MediaCategory } from '../src/types/index.ts';

describe('Universal File Format Flat-File DB & Magic-Byte Engine Suite', () => {
  test('flat-file database satisfies scale (>=300 formats, >=500 tokens), covers all 22 families & 7 categories with 0 collisions', () => {
    const allFormats = getAllFormatDefinitions();
    const stats = getFormatDatabaseStats();
    const collisionErrors = validateFormatsList(allFormats);

    assert.equal(collisionErrors.length, 0, `Unexpected DB collisions: ${collisionErrors.join('; ')}`);
    assert.ok(stats.totalFormats >= 300, `Expected >=300 canonical formats, got ${stats.totalFormats}`);
    assert.ok(
      stats.totalExtensionsAndAliases >= 500,
      `Expected >=500 extensions/aliases, got ${stats.totalExtensionsAndAliases}`
    );

    const expectedFamilies: FormatFamily[] = [
      'raster_image',
      'camera_raw',
      'vector_graphic',
      'design_layout',
      'cad_3d',
      'video',
      'audio',
      'document',
      'ebook',
      'spreadsheet',
      'presentation',
      'subtitle_lyric',
      'database',
      'structured_data',
      'gis_mapping',
      'source_code',
      'archive_compressed',
      'disk_image',
      'executable_package',
      'font',
      'color_lut_sidecar',
      'system_other',
    ];
    for (const family of expectedFamilies) {
      assert.ok((stats.byFamily[family] || 0) > 0, `Missing family coverage: ${family}`);
    }

    const expectedCategories: MediaCategory[] = [
      'image',
      'raw',
      'video',
      'audio',
      'document',
      'archive',
      'data',
    ];
    for (const cat of expectedCategories) {
      assert.ok((stats.byCategory[cat] || 0) > 0, `Missing category coverage: ${cat}`);
    }
  });

  test('O(1) lookup resolves canonical extensions, aliases, compound extensions, and Google Workspace MIMEs', () => {
    assert.equal(lookupFileFormat('photo.JPEG').extension, 'JPG');
    assert.equal(lookupFileFormat('scan.tif').extension, 'TIFF');
    assert.equal(lookupFileFormat('index.htm').extension, 'HTML');
    assert.equal(lookupFileFormat('config.yml').extension, 'YAML');

    const tarGz = classifyFile({ filename: 'backup.tar.gz' });
    assert.equal(tarGz.matchedBy, 'compound-extension');
    assert.equal(tarGz.matchedToken, 'TAR.GZ');
    assert.equal(tarGz.format.extension, 'GZ');

    const tarXz = classifyFile({ filename: 'archive.tar.xz' });
    assert.equal(tarXz.matchedBy, 'compound-extension');
    assert.equal(tarXz.matchedToken, 'TAR.XZ');
    assert.equal(tarXz.format.extension, 'XZ');

    const tarZst = classifyFile({ filename: 'dataset.tar.zst' });
    assert.equal(tarZst.matchedBy, 'compound-extension');
    assert.equal(tarZst.matchedToken, 'TAR.ZST');
    assert.equal(tarZst.format.extension, 'ZST');

    const gdoc = lookupFileFormat('Project Spec', 'application/vnd.google-apps.document');
    assert.equal(gdoc.category, 'document');
    assert.equal(gdoc.viewer, 'document-reader');

    const gsheet = lookupFileFormat('Budget', 'application/vnd.google-apps.spreadsheet');
    assert.equal(gsheet.category, 'document');
    assert.equal(gsheet.viewer, 'spreadsheet-grid');
  });

  test('sniffMagicBytes accurately identifies images, RAW containers, audio/video streams, DBs, archives & disambiguates MPEG-TS vs TypeScript', () => {
    const ascii = (s: string) => Array.from(Buffer.from(s, 'ascii'));

    const vectors: Array<{ name: string; bytes: Uint8Array; filename?: string; expectedExt: string }> = [
      {
        name: 'PNG',
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
        expectedExt: 'PNG',
      },
      {
        name: 'JPEG',
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        expectedExt: 'JPG',
      },
      {
        name: 'GIF89a',
        bytes: new Uint8Array([...ascii('GIF89a'), 0x10, 0x00, 0x10, 0x00]),
        expectedExt: 'GIF',
      },
      {
        name: 'WebP RIFF',
        bytes: new Uint8Array([...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBP')]),
        expectedExt: 'WEBP',
      },
      {
        name: 'Canon CR3 (ISO-BMFF ftyp crx)',
        bytes: new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypcrx '), 0, 0, 0, 0]),
        expectedExt: 'CR3',
      },
      {
        name: 'HEIC (ISO-BMFF ftyp heic)',
        bytes: new Uint8Array([0, 0, 0, 0x18, ...ascii('ftypheic'), 0, 0, 0, 0]),
        expectedExt: 'HEIC',
      },
      {
        name: 'Fujifilm RAF',
        bytes: new Uint8Array([...ascii('FUJIFILMCCD-RAW ')]),
        expectedExt: 'RAF',
      },
      {
        name: 'FLAC',
        bytes: new Uint8Array([...ascii('fLaC'), 0, 0, 0, 0x22]),
        expectedExt: 'FLAC',
      },
      {
        name: 'WAV RIFF',
        bytes: new Uint8Array([...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WAVE')]),
        expectedExt: 'WAV',
      },
      {
        name: 'OGG',
        bytes: new Uint8Array([...ascii('OggS'), 0x00, 0x02]),
        expectedExt: 'OGG',
      },
      {
        name: 'MP3 ID3',
        bytes: new Uint8Array([...ascii('ID3'), 0x04, 0x00]),
        expectedExt: 'MP3',
      },
      {
        name: 'PDF',
        bytes: new Uint8Array([...ascii('%PDF-1.7\n')]),
        expectedExt: 'PDF',
      },
      {
        name: 'SQLite3',
        bytes: new Uint8Array([...ascii('SQLite format 3\0')]),
        expectedExt: 'SQLITE',
      },
      {
        name: 'Apache Parquet',
        bytes: new Uint8Array([...ascii('PAR1'), 0x15, 0x00]),
        expectedExt: 'PARQUET',
      },
      {
        name: 'ZIP',
        bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
        expectedExt: 'ZIP',
      },
      {
        name: '7z',
        bytes: new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x04]),
        expectedExt: '7Z',
      },
      {
        name: 'ELF executable',
        bytes: new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]),
        expectedExt: 'ELF',
      },
      {
        name: 'WOFF2 font',
        bytes: new Uint8Array([...ascii('wOF2'), 0x00, 0x01, 0x00, 0x00]),
        expectedExt: 'WOFF2',
      },
    ];

    for (const v of vectors) {
      const detected = sniffMagicBytes(v.bytes, v.filename || 'unknown_blob.bin');
      assert.ok(detected, `Expected magic match for ${v.name}`);
      assert.equal(detected.extension, v.expectedExt, `Magic mismatch on ${v.name}`);
    }

    // MPEG-TS 188-byte sync disambiguates broadcast .ts video from TypeScript source
    const tsPackets = new Uint8Array(400);
    tsPackets[0] = 0x47;
    tsPackets[188] = 0x47;
    tsPackets[376] = 0x47;
    const mpegResult = classifyFile({ filename: 'capture.ts', headerBytes: tsPackets });
    assert.equal(mpegResult.matchedBy, 'magic-bytes');
    assert.equal(mpegResult.format.extension, 'MTS');
    assert.equal(mpegResult.category, 'video');

    const tsSource = classifyFile({
      filename: 'index.ts',
      headerBytes: new Uint8Array(Buffer.from('export const ok = true;\n', 'utf8')),
      textSample: 'export const ok = true;\n',
    });
    assert.equal(tsSource.format.extension, 'TS');
    assert.equal(tsSource.category, 'document');
  });

  test('extractUniversalFileMetadata extracts binary headers and text stats accurately', () => {
    // 1. PNG IHDR (1920 x 1080, 8-bit, RGBA = 6)
    const pngBuf = new Uint8Array(32);
    pngBuf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 0);
    const pngView = new DataView(pngBuf.buffer);
    pngView.setUint32(16, 1920, false);
    pngView.setUint32(20, 1080, false);
    pngBuf[24] = 8;
    pngBuf[25] = 6;
    const pngRes = classifyFile({ filename: 'frame.png', headerBytes: pngBuf, sizeBytes: 512000 });
    assert.equal(pngRes.matchedBy, 'magic-bytes');
    assert.equal(pngRes.metadata.width, 1920);
    assert.equal(pngRes.metadata.height, 1080);
    assert.equal(pngRes.metadata.dimensions, '1920 × 1080');
    assert.equal(pngRes.metadata.bitDepth, 8);
    assert.equal(pngRes.metadata.colorType, 'RGBA');

    // 2. WAV PCM header (48kHz, 2ch, 16-bit, 10 seconds -> dataSize = 1920000)
    const wavBuf = new Uint8Array(44);
    wavBuf.set(Buffer.from('RIFF', 'ascii'), 0);
    wavBuf.set(Buffer.from('WAVE', 'ascii'), 8);
    wavBuf.set(Buffer.from('fmt ', 'ascii'), 12);
    const wavView = new DataView(wavBuf.buffer);
    wavView.setUint32(16, 16, true); // fmt size
    wavView.setUint16(20, 1, true); // PCM
    wavView.setUint16(22, 2, true); // channels
    wavView.setUint32(24, 48000, true); // sampleRateHz
    wavView.setUint32(28, 192000, true); // byteRate
    wavView.setUint16(32, 4, true);
    wavView.setUint16(34, 16, true); // bitDepth
    wavBuf.set(Buffer.from('data', 'ascii'), 36);
    wavView.setUint32(40, 1920000, true);
    const wavRes = classifyFile({ filename: 'track.wav', headerBytes: wavBuf, sizeBytes: 1920044 });
    assert.equal(wavRes.metadata.sampleRateHz, 48000);
    assert.equal(wavRes.metadata.channels, 2);
    assert.equal(wavRes.metadata.bitDepth, 16);
    assert.equal(wavRes.metadata.durationSeconds, 10);

    // 3. SQLite 3 100-byte binary header
    const sqliteBuf = new Uint8Array(100);
    sqliteBuf.set(Buffer.from('SQLite format 3\0', 'ascii'), 0);
    const sqlView = new DataView(sqliteBuf.buffer);
    sqlView.setUint16(16, 4096, false);
    sqlView.setUint32(28, 128, false);
    sqlView.setUint32(56, 1, false); // UTF-8
    sqlView.setUint32(96, 3045000, false);
    const sqlRes = classifyFile({ filename: 'catalog.db', headerBytes: sqliteBuf });
    assert.equal(sqlRes.format.extension, 'SQLITE');
    assert.equal(sqlRes.metadata.sqlitePageSize, 4096);
    assert.equal(sqlRes.metadata.sqlitePageCount, 128);
    assert.equal(sqlRes.metadata.sqliteEncoding, 'UTF-8');
    assert.equal(sqlRes.metadata.sqliteWriteVersion, 3045000);

    // 4. PDF Version header
    const pdfMeta = extractUniversalFileMetadata({
      filename: 'spec.pdf',
      headerBytes: new Uint8Array(Buffer.from('%PDF-1.7\n%....\n', 'ascii')),
    });
    assert.equal(pdfMeta.pdfVersion, '1.7');

    // 5. CUBE 3D LUT text sample
    const lutRes = classifyFile({
      filename: 'Kodak2383.cube',
      textSample: 'TITLE "Film Print"\nLUT_3D_SIZE 33\n0.0 0.0 0.0\n',
    });
    assert.equal(lutRes.format.family, 'color_lut_sidecar');
    assert.equal(lutRes.metadata.lut3dSize, 33);

    // 6. JSON & CSV structured text extraction
    const jsonRes = classifyFile({
      filename: 'manifest.json',
      textSample: '{"name":"drivetherapy","version":2,"entries":[1,2,3]}',
    });
    assert.equal(jsonRes.metadata.jsonRootType, 'Object');
    assert.equal(jsonRes.metadata.jsonKeyCount, 3);

    const csvRes = classifyFile({
      filename: 'metrics.csv',
      textSample: 'id,filename,category,viewer\n1,test.png,image,image-lightbox\n',
    });
    assert.equal(csvRes.metadata.csvColumns, 4);
    assert.equal(csvRes.metadata.csvDelimiter, ',');
  });

  test('searchFormatDatabase filters and upsertFormatDefinition updates live index cleanly', () => {
    const dbFormats = searchFormatDatabase('sqlite', { family: 'database' });
    assert.ok(dbFormats.some((f) => f.extension === 'SQLITE'));

    const upserted = upsertFormatDefinition({
      extension: 'DTXTEST',
      aliases: ['DTXTST'],
      name: 'Drive Therapy Test Container',
      family: 'structured_data',
      category: 'data',
      mimeTypes: ['application/x-dtxtest'],
      magicSignatures: [],
      metadataParsers: ['text'],
      viewer: 'json-tree-viewer',
      editor: 'text-code-editor',
      isLossless: true,
      isStreamable: true,
      preservationGrade: 'LOC-Acceptable',
      description: 'Ephemeral unit test format entry.',
    });

    assert.equal(upserted.extension, 'DTXTEST');
    assert.equal(lookupFileFormat('sample.dtxtst').extension, 'DTXTEST');
    assert.equal(lookupFileFormat('sample.dtxtst').viewer, 'json-tree-viewer');
    assert.ok(searchFormatDatabase('DTXTEST').length >= 1);
  });
});

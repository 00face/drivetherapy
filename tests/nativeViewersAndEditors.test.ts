import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSpreadsheetColumnStats,
  extractDocxOrOdtTextFromBytes,
  extractSvgPaletteAndElements,
  extractTextFromRtf,
  parseBinaryOrAsciiStl,
  parseDxfCadEntities,
  parseGisFeatures,
  parseGlbHeaderAndScene,
  parsePlyMesh,
  parseSqliteSchemaTables,
  parseStepCadHeaderAndPoints,
  parseSubtitleCues,
  parseTarDirectoryEntries,
  replaceSvgColor,
  serializeSubtitleCues,
} from '../src/services/nativeFormatParsers.ts';

describe('Native Multi-Format Viewers & Editors Parsers Suite', () => {
  test('parseBinaryOrAsciiStl decodes both ASCII and Binary STL triangle meshes', () => {
    const asciiStl = [
      'solid cube_tri',
      '  facet normal 0 0 1',
      '    outer loop',
      '      vertex 0 0 0',
      '      vertex 10 0 0',
      '      vertex 0 10 0',
      '    endloop',
      '  endfacet',
      'endsolid cube_tri',
    ].join('\n');
    const resAscii = parseBinaryOrAsciiStl(new Uint8Array(Buffer.from(asciiStl, 'utf8')), asciiStl);
    assert.equal(resAscii.format, 'ascii-stl');
    assert.equal(resAscii.triangleCount, 1);
    assert.equal(resAscii.vertexCount, 3);
    assert.deepEqual(resAscii.boundsDim, [10, 10, 0]);

    // Build Binary STL (84-byte header + 1 triangle * 50 bytes = 134 bytes)
    const bin = new Uint8Array(134);
    const dv = new DataView(bin.buffer);
    dv.setUint32(80, 1, true); // 1 triangle
    dv.setFloat32(84, 0, true); // nx
    dv.setFloat32(88, 0, true); // ny
    dv.setFloat32(92, 1, true); // nz
    dv.setFloat32(96, 0, true);
    dv.setFloat32(100, 0, true);
    dv.setFloat32(104, 0, true);
    dv.setFloat32(108, 4, true);
    dv.setFloat32(112, 0, true);
    dv.setFloat32(116, 0, true);
    dv.setFloat32(120, 4, true);
    dv.setFloat32(124, 4, true);
    dv.setFloat32(128, 2, true);

    const resBin = parseBinaryOrAsciiStl(bin);
    assert.equal(resBin.format, 'binary-stl');
    assert.equal(resBin.triangleCount, 1);
    assert.equal(resBin.vertexCount, 3);
    assert.deepEqual(resBin.boundsDim, [4, 4, 2]);
  });

  test('parsePlyMesh, parseGlbHeaderAndScene, parseDxfCadEntities & parseStepCadHeaderAndPoints parse 3D/CAD containers', () => {
    const plyText = [
      'ply',
      'format ascii 1.0',
      'element vertex 4',
      'property float x',
      'property float y',
      'property float z',
      'element face 1',
      'property list uchar int vertex_indices',
      'end_header',
      '0 0 0',
      '2 0 0',
      '2 2 0',
      '0 2 0',
      '4 0 1 2 3',
    ].join('\n');
    const ply = parsePlyMesh(plyText);
    assert.equal(ply.vertexCount, 4);
    assert.equal(ply.triangleCount, 2); // Quad triangulated into 2 triangles

    // Construct Binary GLB v2 with JSON scene chunk
    const jsonPayload = JSON.stringify({
      asset: { version: '2.0', generator: 'DriveTherapyCAD' },
      nodes: [{ name: 'CameraRig' }],
      meshes: [{ name: 'TripodMount' }],
      materials: [{ name: 'AnodizedAluminum' }],
    });
    const jsonBytes = Buffer.from(jsonPayload, 'utf8');
    const glb = new Uint8Array(20 + jsonBytes.length);
    const gv = new DataView(glb.buffer);
    glb.set([0x67, 0x6c, 0x54, 0x46], 0); // 'glTF'
    gv.setUint32(4, 2, true);
    gv.setUint32(8, glb.length, true);
    gv.setUint32(12, jsonBytes.length, true);
    gv.setUint32(16, 0x4e4f534a, true); // 'JSON'
    glb.set(jsonBytes, 20);

    const glbRes = parseGlbHeaderAndScene(glb);
    assert.equal(glbRes.isBinaryGlb, true);
    assert.equal(glbRes.generator, 'DriveTherapyCAD');
    assert.deepEqual(glbRes.meshes, ['TripodMount']);
    assert.deepEqual(glbRes.materials, ['AnodizedAluminum']);

    const dxfText = [
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'LINE',
      '8',
      'WALLS',
      '10',
      '0',
      '20',
      '0',
      '11',
      '100',
      '21',
      '50',
      '0',
      'CIRCLE',
      '8',
      'HOLES',
      '10',
      '25',
      '20',
      '25',
      '40',
      '5',
      '0',
      'ENDSEC',
    ].join('\n');
    const dxf = parseDxfCadEntities(dxfText);
    assert.equal(dxf.entityCount, 2);
    assert.deepEqual(dxf.layers, ['WALLS', 'HOLES']);
    assert.equal(dxf.segments.length, 17); // 1 LINE + 16 CIRCLE chords

    const stepText = [
      "ISO-10303-21;",
      "HEADER;",
      "FILE_DESCRIPTION(('Drive Therapy Bracket'),'2;1');",
      "FILE_NAME('bracket.step','2026-11-17',('Engineer'),('Lab'),'','','');",
      "FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));",
      "ENDSEC;",
      "DATA;",
      "#10=CARTESIAN_POINT('Origin',(0.0,0.0,0.0));",
      "#11=CARTESIAN_POINT('Corner',(10.0,5.0,2.5));",
      "ENDSEC;",
    ].join('\n');
    const step = parseStepCadHeaderAndPoints(stepText);
    assert.equal(step.schema, 'AUTOMOTIVE_DESIGN');
    assert.equal(step.fileName, 'bracket.step');
    assert.equal(step.entityCounts.CARTESIAN_POINT, 2);
    assert.equal(step.points.length, 2);
  });

  test('extractTextFromRtf, extractDocxOrOdtTextFromBytes, parseSqliteSchemaTables & parseTarDirectoryEntries', () => {
    const rtf = "{\\rtf1\\ansi{\\fonttbl\\f0 Helvetica;}Hello Caf\\'e9\\par Second Line}";
    assert.equal(extractTextFromRtf(rtf), 'Hello Café\nSecond Line');

    const docxXml = '<w:document><w:body><w:p><w:r><w:t>Shoot Brief Ready</w:t></w:r></w:p></w:body></w:document>';
    const doc = extractDocxOrOdtTextFromBytes(new Uint8Array(Buffer.from(docxXml, 'utf8')));
    assert.equal(doc.paragraphs[0], 'Shoot Brief Ready');
    assert.equal(doc.wordCount, 3);

    const sqliteBlob = Buffer.from(
      'SQLite format 3\0...CREATE TABLE assets (id TEXT PRIMARY KEY, rating INTEGER)...CREATE INDEX idx_rating ON assets(rating);',
      'latin1'
    );
    const tables = parseSqliteSchemaTables(new Uint8Array(sqliteBlob));
    assert.ok(tables.some((t) => t.type === 'table' && t.name === 'assets' && t.sql.includes('CREATE TABLE assets')));

    // Build single 512-byte ustar TAR header for docs/notes.txt (size = 128 bytes = 0200 octal)
    const tar = new Uint8Array(1024);
    tar.set(Buffer.from('docs/notes.txt', 'utf8'), 0);
    tar.set(Buffer.from('0000644', 'utf8'), 100);
    tar.set(Buffer.from('00000000200\0', 'utf8'), 124);
    tar[156] = '0'.charCodeAt(0);
    const entries = parseTarDirectoryEntries(tar);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, 'docs/notes.txt');
    assert.equal(entries[0].sizeBytes, 128);
  });

  test('parseGisFeatures, SVG palette recolor, Subtitle converter & Spreadsheet stats work accurately', () => {
    const geoJson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'Studio Base' }, geometry: { type: 'Point', coordinates: [-97.7431, 30.2672, 149] } },
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[-97.74, 30.26], [-97.75, 30.27]] } },
      ],
    });
    const gisGeo = parseGisFeatures(geoJson, 'geojson');
    assert.equal(gisGeo.featureCount, 2);
    assert.equal(gisGeo.points[0].label, 'Studio Base');
    assert.equal(gisGeo.paths.length, 1);

    const gpx = '<gpx><trk><trkseg><trkpt lat="30.1" lon="-97.7"><ele>150</ele></trkpt><trkpt lat="30.2" lon="-97.8"><ele>165</ele></trkpt></trkseg></trk></gpx>';
    const gisGpx = parseGisFeatures(gpx, 'gpx');
    assert.equal(gisGpx.format, 'gpx');
    assert.equal(gisGpx.points.length, 2);
    assert.equal(gisGpx.points[1].ele, 165);

    const svg = '<svg viewBox="0 0 24 24"><path fill="#ff0000" d="M0 0h24v24H0z"/><circle stroke="#00ff00" cx="12" cy="12" r="5"/></svg>';
    const svgInfo = extractSvgPaletteAndElements(svg);
    assert.deepEqual(svgInfo.colors, ['#FF0000', '#00FF00']);
    assert.equal(svgInfo.pathCount, 1);
    assert.equal(svgInfo.shapeCount, 1);
    assert.ok(replaceSvgColor(svg, '#FF0000', '#1074B1').includes('#1074B1'));

    const srt = '1\n00:00:01,000 --> 00:00:03,500\nFirst Cue\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond Cue';
    const cues = parseSubtitleCues(srt);
    assert.equal(cues.length, 2);
    assert.equal(cues[0].startMs, 1000);
    const lrc = serializeSubtitleCues(cues, 'lrc', 500);
    assert.ok(lrc.includes('[00:01.50] First Cue'));
    const vtt = serializeSubtitleCues(cues, 'vtt', 0);
    assert.ok(vtt.startsWith('WEBVTT'));

    const stats = computeSpreadsheetColumnStats(['File', 'Score', 'SizeMB'], [
      ['a.jpg', '80', '12.5'],
      ['b.jpg', '100', '7.5'],
    ]);
    assert.equal(stats[1].sum, 180);
    assert.equal(stats[1].avg, 90);
    assert.equal(stats[1].min, 80);
    assert.equal(stats[1].max, 100);
  });
});

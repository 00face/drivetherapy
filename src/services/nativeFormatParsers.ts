/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native Multi-Format Binary & Structured Parsers Engine
 * 100% dependency-free, browser/Node dual-compatible parsers for:
 *  - 3D & CAD (STL binary/ASCII, PLY, GLB/GLTF, DXF, STEP/STP/IGES) [Viewer Mode]
 *  - Documents & Ebooks (RTF, DOCX/ODT/EPUB XML runs)
 *  - Databases & Archives (SQLite sqlite_schema DDL extraction, POSIX ustar TAR headers)
 *  - GIS Mapping (GeoJSON, GPX, KML)
 *  - Vector & Subtitles & Spreadsheets (SVG palette/recolor, SRT/VTT/LRC cue converter, column stats)
 */

export interface MeshGeometryResult {
  format: 'binary-stl' | 'ascii-stl' | 'ply' | 'step-points' | 'obj';
  vertexCount: number;
  triangleCount: number;
  vertices: Array<[number, number, number]>;
  normals: Array<[number, number, number]>;
  triangles: Array<[number, number, number]>;
  edges: Array<[number, number]>;
  boundsDim: [number, number, number];
  uvs?: Array<[number, number]>;
  uvTriangles?: Array<[number, number, number]>;
}

export interface GlbSceneSummary {
  isBinaryGlb: boolean;
  version: number;
  totalByteLength: number;
  nodes: string[];
  meshes: string[];
  materials: string[];
  animationsCount: number;
  generator: string;
}

export interface DxfCadSegment {
  layer: string;
  type: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DxfCadResult {
  layers: string[];
  segments: DxfCadSegment[];
  entityCount: number;
}

export interface StepCadResult {
  schema: string;
  fileName: string;
  description: string;
  entityCounts: Record<string, number>;
  points: Array<[number, number, number]>;
  edges: Array<[number, number]>;
}

export interface SqliteSchemaItem {
  type: 'table' | 'index' | 'view';
  name: string;
  sql: string;
}

export interface TarDirectoryEntry {
  name: string;
  sizeBytes: number;
  mode: string;
  isDirectory: boolean;
}

export interface GisPoint {
  lat: number;
  lon: number;
  ele?: number;
  label?: string;
}

export interface GisFeaturesResult {
  format: 'geojson' | 'gpx' | 'kml';
  featureCount: number;
  points: GisPoint[];
  paths: Array<Array<[number, number]>>;
  properties: Array<Record<string, string | number>>;
}

export interface SvgPaletteSummary {
  colors: string[];
  pathCount: number;
  shapeCount: number;
  textCount: number;
  viewBox: string;
}

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SpreadsheetColumnStat {
  header: string;
  numericCount: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

function normalizeVerticesAndBounds(
  rawVertices: Array<[number, number, number]>,
  maxKeep = 6000
): {
  vertices: Array<[number, number, number]>;
  boundsDim: [number, number, number];
} {
  if (rawVertices.length === 0) {
    return { vertices: [], boundsDim: [0, 0, 0] };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of rawVertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const dx = Math.max(0, maxX - minX);
  const dy = Math.max(0, maxY - minY);
  const dz = Math.max(0, maxZ - minZ);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(0.0001, dx, dy, dz);
  const scale = 2 / span;

  const vertices = rawVertices
    .slice(0, maxKeep)
    .map(([x, y, z]): [number, number, number] => [
      (x - cx) * scale,
      (y - cy) * scale,
      (z - cz) * scale,
    ]);

  return {
    vertices,
    boundsDim: [
      Number(dx.toFixed(3)),
      Number(dy.toFixed(3)),
      Number(dz.toFixed(3)),
    ],
  };
}

function buildUniqueEdgesFromTriangles(
  triangles: Array<[number, number, number]>,
  vertexCap: number,
  maxEdges = 9000
): Array<[number, number]> {
  const edges: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const [a, b, c] of triangles) {
    if (a >= vertexCap || b >= vertexCap || c >= vertexCap) continue;
    const pairs: Array<[number, number]> = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [u, v] of pairs) {
      const key = u < v ? `${u}:${v}` : `${v}:${u}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([u, v]);
        if (edges.length >= maxEdges) return edges;
      }
    }
  }
  return edges;
}

/**
 * Parse Binary STL (80-byte header + uint32 count + 50B facets) or ASCII STL cleanly.
 */
export function parseBinaryOrAsciiStl(
  bytes: Uint8Array,
  textSample?: string
): MeshGeometryResult {
  const sample =
    textSample ??
    (bytes.length > 0 ? new TextDecoder('utf-8', { fatal: false }).decode(bytes) : '');
  const trimmed = sample.trimStart();

  // Check if buffer matches binary STL structure first
  let isBinary = false;
  if (bytes.length >= 84) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const triCount = view.getUint32(80, true);
    const expectedLen = 84 + triCount * 50;
    const looksAscii =
      trimmed.startsWith('solid') && trimmed.toLowerCase().includes('facet normal');
    if (!looksAscii && (expectedLen === bytes.length || (triCount > 0 && bytes.length >= 134))) {
      isBinary = true;
    }
  }

  const rawVertices: Array<[number, number, number]> = [];
  const normals: Array<[number, number, number]> = [];
  const triangles: Array<[number, number, number]> = [];

  if (isBinary && bytes.length >= 84) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const triCount = view.getUint32(80, true);
    const readable = Math.min(triCount, Math.floor((bytes.length - 84) / 50), 4000);
    for (let i = 0; i < readable; i++) {
      const off = 84 + i * 50;
      const nx = view.getFloat32(off, true);
      const ny = view.getFloat32(off + 4, true);
      const nz = view.getFloat32(off + 8, true);
      const baseIdx = rawVertices.length;
      for (let v = 0; v < 3; v++) {
        const vOff = off + 12 + v * 12;
        rawVertices.push([
          view.getFloat32(vOff, true),
          view.getFloat32(vOff + 4, true),
          view.getFloat32(vOff + 8, true),
        ]);
      }
      normals.push([nx, ny, nz]);
      triangles.push([baseIdx, baseIdx + 1, baseIdx + 2]);
    }
    const norm = normalizeVerticesAndBounds(rawVertices, 12000);
    return {
      format: 'binary-stl',
      vertexCount: norm.vertices.length,
      triangleCount: triCount,
      vertices: norm.vertices,
      normals,
      triangles,
      edges: buildUniqueEdgesFromTriangles(triangles, norm.vertices.length),
      boundsDim: norm.boundsDim,
    };
  }

  // ASCII STL fallback
  let pendingNormal: [number, number, number] = [0, 0, 1];
  let facetVerts: number[] = [];
  for (const rawLine of sample.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'facet' && parts[1] === 'normal' && parts.length >= 5) {
      pendingNormal = [
        Number.parseFloat(parts[2]) || 0,
        Number.parseFloat(parts[3]) || 0,
        Number.parseFloat(parts[4]) || 1,
      ];
      facetVerts = [];
    } else if (parts[0] === 'vertex' && parts.length >= 4) {
      const x = Number.parseFloat(parts[1]);
      const y = Number.parseFloat(parts[2]);
      const z = Number.parseFloat(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        facetVerts.push(rawVertices.length);
        rawVertices.push([x, y, z]);
      }
    } else if (parts[0] === 'endfacet' && facetVerts.length >= 3) {
      normals.push(pendingNormal);
      triangles.push([facetVerts[0], facetVerts[1], facetVerts[2]]);
      facetVerts = [];
    }
  }

  const norm = normalizeVerticesAndBounds(rawVertices, 12000);
  return {
    format: 'ascii-stl',
    vertexCount: norm.vertices.length,
    triangleCount: triangles.length,
    vertices: norm.vertices,
    normals,
    triangles,
    edges: buildUniqueEdgesFromTriangles(triangles, norm.vertices.length),
    boundsDim: norm.boundsDim,
  };
}

/**
 * Parse Stanford .PLY ASCII geometry into normalized vertices & triangles.
 */
export function parsePlyMesh(text: string): MeshGeometryResult {
  const lines = text.split(/\r?\n/);
  let vertexCount = 0;
  let faceCount = 0;
  let headerEndLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('element vertex ')) {
      vertexCount = Number.parseInt(line.slice(15).trim(), 10) || 0;
    } else if (line.startsWith('element face ')) {
      faceCount = Number.parseInt(line.slice(13).trim(), 10) || 0;
    } else if (line === 'end_header') {
      headerEndLine = i;
      break;
    }
  }

  const rawVertices: Array<[number, number, number]> = [];
  const triangles: Array<[number, number, number]> = [];
  if (headerEndLine >= 0) {
    let cursor = headerEndLine + 1;
    for (let v = 0; v < vertexCount && cursor < lines.length; cursor++) {
      const parts = lines[cursor].trim().split(/\s+/);
      if (parts.length < 3) continue;
      const x = Number.parseFloat(parts[0]);
      const y = Number.parseFloat(parts[1]);
      const z = Number.parseFloat(parts[2]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        rawVertices.push([x, y, z]);
        v++;
      }
    }
    for (let f = 0; f < faceCount && cursor < lines.length; cursor++) {
      const parts = lines[cursor].trim().split(/\s+/);
      if (parts.length < 4) continue;
      const count = Number.parseInt(parts[0], 10);
      if (!Number.isFinite(count) || count < 3) continue;
      const idx = parts.slice(1, 1 + count).map((s) => Number.parseInt(s, 10));
      for (let t = 1; t + 1 < idx.length; t++) {
        triangles.push([idx[0], idx[t], idx[t + 1]]);
      }
      f++;
    }
  }

  const norm = normalizeVerticesAndBounds(rawVertices);
  return {
    format: 'ply',
    vertexCount: norm.vertices.length,
    triangleCount: triangles.length,
    vertices: norm.vertices,
    normals: [],
    triangles,
    edges: buildUniqueEdgesFromTriangles(triangles, norm.vertices.length),
    boundsDim: norm.boundsDim,
  };
}

/**
 * Parse Wavefront .OBJ geometry including vertices (v), texture UVs (vt),
 * normals (vn), and triangulated faces (f v/vt/vn) with negative index support.
 */
export function parseWavefrontObjMesh(text: string): MeshGeometryResult {
  const rawVertices: Array<[number, number, number]> = [];
  const rawUvs: Array<[number, number]> = [];
  const triangles: Array<[number, number, number]> = [];
  const uvTriangles: Array<[number, number, number]> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) {
      const x = Number.parseFloat(parts[1]);
      const y = Number.parseFloat(parts[2]);
      const z = Number.parseFloat(parts[3]);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        rawVertices.push([x, y, z]);
      }
    } else if (parts[0] === 'vt' && parts.length >= 3) {
      const u = Number.parseFloat(parts[1]);
      const v = Number.parseFloat(parts[2]);
      if (Number.isFinite(u) && Number.isFinite(v)) {
        rawUvs.push([u, v]);
      }
    } else if (parts[0] === 'f' && parts.length >= 4) {
      const vIdx: number[] = [];
      const vtIdx: number[] = [];
      for (const tok of parts.slice(1)) {
        const segs = tok.split('/');
        const viRaw = Number.parseInt(segs[0], 10);
        if (!Number.isFinite(viRaw)) continue;
        const vi = viRaw < 0 ? rawVertices.length + viRaw : viRaw - 1;
        if (vi < 0 || vi >= rawVertices.length) continue;
        vIdx.push(vi);

        if (segs[1]) {
          const vtiRaw = Number.parseInt(segs[1], 10);
          const vti = vtiRaw < 0 ? rawUvs.length + vtiRaw : vtiRaw - 1;
          vtIdx.push(vti >= 0 && vti < rawUvs.length ? vti : 0);
        } else {
          vtIdx.push(0);
        }
      }
      // Fan-triangulate polygon faces (tris, quads, n-gons)
      for (let i = 1; i + 1 < vIdx.length; i++) {
        triangles.push([vIdx[0], vIdx[i], vIdx[i + 1]]);
        if (rawUvs.length > 0) {
          uvTriangles.push([vtIdx[0], vtIdx[i], vtIdx[i + 1]]);
        }
      }
    }
  }

  const norm = normalizeVerticesAndBounds(rawVertices, 12000);
  return {
    format: 'obj',
    vertexCount: norm.vertices.length,
    triangleCount: triangles.length,
    vertices: norm.vertices,
    normals: [],
    triangles,
    edges: buildUniqueEdgesFromTriangles(triangles, norm.vertices.length),
    boundsDim: norm.boundsDim,
    uvs: rawUvs,
    uvTriangles,
  };
}

/**
 * Parse binary GLB v2 header + JSON scene chunk or ASCII .GLTF JSON scene graph.
 */
export function parseGlbHeaderAndScene(bytes: Uint8Array, textSample?: string): GlbSceneSummary {
  const isGlbMagic =
    bytes.length >= 20 &&
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46;

  let version = 2;
  let totalByteLength = bytes.length;
  let jsonText = textSample || '';

  if (isGlbMagic) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    version = view.getUint32(4, true);
    totalByteLength = view.getUint32(8, true);
    const chunkLen = view.getUint32(12, true);
    const chunkType = view.getUint32(16, true);
    // 0x4E4F534A === 'JSON'
    if (chunkType === 0x4e4f534a && 20 + chunkLen <= bytes.length) {
      jsonText = new TextDecoder('utf-8', { fatal: false }).decode(
        bytes.subarray(20, 20 + chunkLen)
      );
    }
  }

  const empty: GlbSceneSummary = {
    isBinaryGlb: isGlbMagic,
    version,
    totalByteLength,
    nodes: [],
    meshes: [],
    materials: [],
    animationsCount: 0,
    generator: 'Unknown glTF Producer',
  };

  if (!jsonText.trim().startsWith('{')) {
    return empty;
  }

  try {
    const doc = JSON.parse(jsonText) as Record<string, unknown>;
    const assetBlock = (doc.asset as Record<string, unknown> | undefined) || {};
    const nodesRaw = Array.isArray(doc.nodes) ? doc.nodes : [];
    const meshesRaw = Array.isArray(doc.meshes) ? doc.meshes : [];
    const matsRaw = Array.isArray(doc.materials) ? doc.materials : [];
    const animsRaw = Array.isArray(doc.animations) ? doc.animations : [];

    return {
      isBinaryGlb: isGlbMagic,
      version,
      totalByteLength,
      nodes: nodesRaw.map((n: any, idx: number) => String(n?.name || `Node_${idx}`)),
      meshes: meshesRaw.map((m: any, idx: number) => String(m?.name || `Mesh_${idx}`)),
      materials: matsRaw.map((m: any, idx: number) => String(m?.name || `Material_${idx}`)),
      animationsCount: animsRaw.length,
      generator: String(assetBlock.generator || 'Khronos glTF 2.0'),
    };
  } catch {
    return empty;
  }
}

/**
 * Parse AutoCAD .DXF LINE / LWPOLYLINE / CIRCLE / ARC entities into 2D CAD vector segments.
 */
export function parseDxfCadEntities(text: string): DxfCadResult {
  const lines = text.split(/\r?\n/);
  const segments: DxfCadSegment[] = [];
  const layerSet = new Set<string>();
  let entityCount = 0;

  let currentEntity = '';
  let layer = '0';
  let x1: number | null = null;
  let y1: number | null = null;
  let x2: number | null = null;
  let y2: number | null = null;
  let radius: number | null = null;
  let startAngle = 0;
  let endAngle = 360;
  let polyPts: Array<[number, number]> = [];
  let pendingX: number | null = null;

  const flushEntity = () => {
    if (!currentEntity) return;
    layerSet.add(layer);
    if (currentEntity === 'LINE' && x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
      entityCount++;
      segments.push({ layer, type: 'LINE', x1, y1, x2, y2 });
    } else if (
      (currentEntity === 'CIRCLE' || currentEntity === 'ARC') &&
      x1 !== null &&
      y1 !== null &&
      radius !== null &&
      radius > 0
    ) {
      entityCount++;
      const a0 = currentEntity === 'CIRCLE' ? 0 : (startAngle * Math.PI) / 180;
      let a1 = currentEntity === 'CIRCLE' ? Math.PI * 2 : (endAngle * Math.PI) / 180;
      if (a1 <= a0) a1 += Math.PI * 2;
      const steps = 16;
      for (let s = 0; s < steps; s++) {
        const t0 = a0 + ((a1 - a0) * s) / steps;
        const t1 = a0 + ((a1 - a0) * (s + 1)) / steps;
        segments.push({
          layer,
          type: currentEntity === 'CIRCLE' ? 'CIRCLE' : 'ARC',
          x1: x1 + Math.cos(t0) * radius,
          y1: y1 + Math.sin(t0) * radius,
          x2: x1 + Math.cos(t1) * radius,
          y2: y1 + Math.sin(t1) * radius,
        });
      }
    } else if (currentEntity === 'LWPOLYLINE' && polyPts.length >= 2) {
      entityCount++;
      for (let i = 0; i + 1 < polyPts.length; i++) {
        segments.push({
          layer,
          type: 'POLYLINE',
          x1: polyPts[i][0],
          y1: polyPts[i][1],
          x2: polyPts[i + 1][0],
          y2: polyPts[i + 1][1],
        });
      }
    }
    currentEntity = '';
    layer = '0';
    x1 = y1 = x2 = y2 = radius = pendingX = null;
    startAngle = 0;
    endAngle = 360;
    polyPts = [];
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const val = lines[i + 1].trim();
    if (code === '0') {
      flushEntity();
      if (['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE'].includes(val.toUpperCase())) {
        currentEntity = val.toUpperCase();
      }
      continue;
    }
    if (!currentEntity) continue;
    if (code === '8') layer = val || '0';
    else if (code === '10') {
      const n = Number.parseFloat(val);
      if (currentEntity === 'LWPOLYLINE') pendingX = n;
      else x1 = n;
    } else if (code === '20') {
      const n = Number.parseFloat(val);
      if (currentEntity === 'LWPOLYLINE' && pendingX !== null) {
        polyPts.push([pendingX, n]);
        pendingX = null;
      } else {
        y1 = n;
      }
    } else if (code === '11') x2 = Number.parseFloat(val);
    else if (code === '21') y2 = Number.parseFloat(val);
    else if (code === '40') radius = Number.parseFloat(val);
    else if (code === '50') startAngle = Number.parseFloat(val) || 0;
    else if (code === '51') endAngle = Number.parseFloat(val) || 360;
  }
  flushEntity();

  return {
    layers: Array.from(layerSet),
    segments: segments.slice(0, 6000),
    entityCount,
  };
}

/**
 * Parse ISO-10303-21 STEP (.step / .stp) headers, entity counts, and CARTESIAN_POINT cloud.
 */
export function parseStepCadHeaderAndPoints(text: string): StepCadResult {
  let schema = 'AP214 / STEP';
  let fileName = 'CAD Model';
  let description = 'ISO-10303-21 CAD B-Rep Exchange';

  const schemaMatch = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i);
  if (schemaMatch) schema = schemaMatch[1];
  const nameMatch = text.match(/FILE_NAME\s*\(\s*'([^']+)'/i);
  if (nameMatch) fileName = nameMatch[1];
  const descMatch = text.match(/FILE_DESCRIPTION\s*\(\s*\(\s*'([^']+)'/i);
  if (descMatch) description = descMatch[1];

  const entityCounts: Record<string, number> = {};
  const entityRegex = /#\d+\s*=\s*([A-Z0-9_]+)\s*\(/gi;
  let em: RegExpExecArray | null;
  while ((em = entityRegex.exec(text)) !== null) {
    const kind = em[1].toUpperCase();
    entityCounts[kind] = (entityCounts[kind] || 0) + 1;
  }

  const rawPoints: Array<[number, number, number]> = [];
  const ptRegex =
    /CARTESIAN_POINT\s*\([^,]*,\s*\(\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*,\s*([-+\d.eE]+)\s*\)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = ptRegex.exec(text)) !== null && rawPoints.length < 1500) {
    const x = Number.parseFloat(pm[1]);
    const y = Number.parseFloat(pm[2]);
    const z = Number.parseFloat(pm[3]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      rawPoints.push([x, y, z]);
    }
  }

  const norm = normalizeVerticesAndBounds(rawPoints, 1500);
  const edges: Array<[number, number]> = [];
  for (let i = 0; i + 1 < norm.vertices.length; i++) {
    edges.push([i, i + 1]);
  }

  return {
    schema,
    fileName,
    description,
    entityCounts,
    points: norm.vertices,
    edges,
  };
}

/**
 * Convert Rich Text Format (.RTF) into readable & editable plain text paragraphs.
 */
export function extractTextFromRtf(rtfText: string): string {
  if (!rtfText || !rtfText.trimStart().startsWith('{\\rtf')) {
    return rtfText || '';
  }

  let out = '';
  let depth = 0;
  let skipDepth: number | null = null;
  const skipDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'header',
    'footer',
    'footnote',
  ]);

  for (let i = 0; i < rtfText.length; i++) {
    const ch = rtfText[i];
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      if (skipDepth !== null && depth <= skipDepth) {
        skipDepth = null;
      }
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (skipDepth !== null && depth >= skipDepth) continue;

    if (ch === '\\') {
      const next = rtfText[i + 1];
      if (!next) break;
      if (next === '\\' || next === '{' || next === '}') {
        out += next;
        i++;
        continue;
      }
      if (next === '*') {
        skipDepth = depth;
        i++;
        continue;
      }
      if (next === "'") {
        const hex = rtfText.slice(i + 2, i + 4);
        const code = Number.parseInt(hex, 16);
        if (Number.isFinite(code)) out += String.fromCharCode(code);
        i += 3;
        continue;
      }
      if (next === '\n' || next === '\r') {
        out += '\n';
        i++;
        continue;
      }

      const match = rtfText.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)?\s?/);
      if (match) {
        const word = match[1].toLowerCase();
        const param = match[2];
        i += match[0].length;
        if (skipDestinations.has(word)) {
          skipDepth = depth;
        } else if (word === 'par' || word === 'line') {
          out += '\n';
        } else if (word === 'tab') {
          out += '\t';
        } else if (word === 'u' && param) {
          const cp = Number.parseInt(param, 10);
          out += String.fromCodePoint(cp < 0 ? cp + 65536 : cp);
          if (rtfText[i + 1] === '?') i++;
        }
        continue;
      }
    } else if (ch !== '\r' && ch !== '\n') {
      out += ch;
    }
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract readable text paragraphs from stored ZIP XML (.DOCX / .ODT / .EPUB) or XML fallback.
 */
export function extractDocxOrOdtTextFromBytes(
  bytes: Uint8Array,
  fallbackText?: string
): { paragraphs: string[]; wordCount: number } {
  const decoded =
    bytes.length > 0
      ? new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      : fallbackText || '';

  const runs: string[] = [];
  const xmlRegex = /<(?:w:t|text:p|text:h|p|h[1-6]|li|title)[^>]*>([\s\S]*?)<\/(?:w:t|text:p|text:h|p|h[1-6]|li|title)>/gi;
  let match: RegExpExecArray | null;
  while ((match = xmlRegex.exec(decoded)) !== null && runs.length < 400) {
    const clean = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (clean) runs.push(clean);
  }

  const paragraphs =
    runs.length > 0
      ? runs
      : (fallbackText || decoded)
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .split(/\n+/)
          .map((l) => l.trim())
          .filter((l) => l.length > 2)
          .slice(0, 80);

  const wordCount = paragraphs.join(' ').trim().split(/\s+/).filter(Boolean).length;
  return { paragraphs, wordCount };
}

/**
 * Inspect binary SQLite 3 bytes to recover sqlite_schema CREATE TABLE / INDEX / VIEW SQL DDL statements.
 */
export function parseSqliteSchemaTables(
  bytes: Uint8Array,
  textSample?: string
): SqliteSchemaItem[] {
  const hay =
    bytes.length > 0
      ? new TextDecoder('latin1').decode(bytes)
      : textSample || '';
  const results: SqliteSchemaItem[] = [];
  const seen = new Set<string>();
  const ddlStart = /CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?([A-Za-z0-9_.-]+)["`\]]?/gi;

  let m: RegExpExecArray | null;
  while ((m = ddlStart.exec(hay)) !== null && results.length < 64) {
    const rawType = m[1].toLowerCase() as 'table' | 'index' | 'view';
    const name = m[2];
    const startIdx = m.index;

    let sql = hay.slice(startIdx, Math.min(hay.length, startIdx + 1200));
    const openParen = sql.indexOf('(');
    if (openParen >= 0) {
      let depth = 0;
      let endPos = sql.length;
      for (let i = openParen; i < sql.length; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') {
          depth--;
          if (depth === 0) {
            endPos = i + 1;
            break;
          }
        }
      }
      sql = sql.slice(0, endPos);
    }

    const cleanSql = sql.replace(/[^\x20-\x7E\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
    const key = `${rawType}:${name}`;
    if (!seen.has(key) && cleanSql.length >= 12) {
      seen.add(key);
      results.push({ type: rawType, name, sql: cleanSql });
    }
  }

  return results;
}

/**
 * Parse POSIX ustar 512-byte .TAR archive directory entries natively.
 */
export function parseTarDirectoryEntries(bytes: Uint8Array): TarDirectoryEntry[] {
  const entries: TarDirectoryEntry[] = [];
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const cleanStr = (start: number, len: number) =>
    decoder.decode(bytes.subarray(start, start + len)).replace(/\0.*$/, '').trim();

  let offset = 0;
  while (offset + 512 <= bytes.length && entries.length < 500) {
    // Check two zero blocks EOF
    let allZero = true;
    for (let i = 0; i < 32; i++) {
      if (bytes[offset + i] !== 0) {
        allZero = false;
        break;
      }
    }
    if (allZero) break;

    const name = cleanStr(offset, 100);
    if (!name) break;
    const mode = cleanStr(offset + 100, 8);
    const sizeOctal = cleanStr(offset + 124, 12);
    const sizeBytes = Number.parseInt(sizeOctal || '0', 8) || 0;
    const typeflag = String.fromCharCode(bytes[offset + 156]);
    const prefix = cleanStr(offset + 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;

    entries.push({
      name: fullName,
      sizeBytes,
      mode,
      isDirectory: typeflag === '5' || fullName.endsWith('/'),
    });

    const dataBlocks = Math.ceil(sizeBytes / 512) * 512;
    offset += 512 + dataBlocks;
  }

  return entries;
}

/**
 * Parse GeoJSON, GPX tracks/waypoints, or KML placemarks into renderable points & polyline paths.
 */
export function parseGisFeatures(text: string, ext = 'GEOJSON'): GisFeaturesResult {
  const upperExt = ext.toUpperCase().replace(/^\./, '');
  const points: GisPoint[] = [];
  const paths: Array<Array<[number, number]>> = [];
  const properties: Array<Record<string, string | number>> = [];

  if (upperExt === 'GPX') {
    const trkPts = Array.from(
      text.matchAll(/<(?:trkpt|wpt|rtept)[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:trkpt|wpt|rtept)>/gi)
    );
    const trackPath: Array<[number, number]> = [];
    for (const m of trkPts) {
      const lat = Number.parseFloat(m[1]);
      const lon = Number.parseFloat(m[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const inner = m[3] || '';
      const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/i);
      const nameMatch = inner.match(/<name>([^<]+)<\/name>/i);
      const ele = eleMatch ? Number.parseFloat(eleMatch[1]) : undefined;
      points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : undefined, label: nameMatch?.[1] });
      trackPath.push([lon, lat]);
    }
    if (trackPath.length >= 2) paths.push(trackPath);
    return {
      format: 'gpx',
      featureCount: points.length,
      points,
      paths,
      properties: points.slice(0, 50).map((p, idx) => ({
        idx: idx + 1,
        lat: p.lat,
        lon: p.lon,
        ...(p.ele !== undefined ? { elevationM: p.ele } : {}),
        ...(p.label ? { name: p.label } : {}),
      })),
    };
  }

  if (upperExt === 'KML') {
    const coordsMatches = Array.from(text.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi));
    for (const cm of coordsMatches) {
      const tuplePath: Array<[number, number]> = [];
      for (const tuple of cm[1].trim().split(/\s+/)) {
        const [lonS, latS, eleS] = tuple.split(',');
        const lon = Number.parseFloat(lonS);
        const lat = Number.parseFloat(latS);
        const ele = eleS ? Number.parseFloat(eleS) : undefined;
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : undefined });
          tuplePath.push([lon, lat]);
        }
      }
      if (tuplePath.length >= 2) paths.push(tuplePath);
    }
    return {
      format: 'kml',
      featureCount: coordsMatches.length,
      points,
      paths,
      properties: points.slice(0, 50).map((p, idx) => ({ idx: idx + 1, lat: p.lat, lon: p.lon })),
    };
  }

  // GeoJSON / TopoJSON
  try {
    const parsed = JSON.parse(text) as any;
    const features =
      parsed?.type === 'FeatureCollection' && Array.isArray(parsed.features)
        ? parsed.features
        : parsed?.type === 'Feature'
        ? [parsed]
        : [{ type: 'Feature', geometry: parsed, properties: {} }];

    for (const feat of features) {
      const geom = feat?.geometry || {};
      const props = (feat?.properties && typeof feat.properties === 'object' ? feat.properties : {}) as Record<string, string | number>;
      if (feat?.properties) properties.push(props);
      const label = typeof props.name === 'string' ? props.name : undefined;

      if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
        const [lon, lat, ele] = geom.coordinates;
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          points.push({ lat, lon, ele: Number.isFinite(ele) ? ele : undefined, label });
        }
      } else if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
        const line: Array<[number, number]> = geom.coordinates
          .filter((c: any) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map((c: any) => [c[0], c[1]] as [number, number]);
        if (line.length > 0) paths.push(line);
      } else if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        for (const ring of geom.coordinates) {
          if (Array.isArray(ring)) {
            const poly: Array<[number, number]> = ring
              .filter((c: any) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
              .map((c: any) => [c[0], c[1]] as [number, number]);
            if (poly.length > 0) paths.push(poly);
          }
        }
      }
    }

    return {
      format: 'geojson',
      featureCount: features.length,
      points,
      paths,
      properties: properties.slice(0, 50),
    };
  } catch {
    return { format: 'geojson', featureCount: 0, points: [], paths: [], properties: [] };
  }
}

/**
 * Inspect SVG XML elements and extract unique hex/rgb palette swatches.
 */
export function extractSvgPaletteAndElements(svgText: string): SvgPaletteSummary {
  const colorSet = new Set<string>();
  const hexMatches = svgText.match(/#(?:[0-9a-fA-F]{3,8})\b/g) || [];
  for (const hex of hexMatches) {
    colorSet.add(hex.toUpperCase());
  }

  const pathCount = (svgText.match(/<path\b/gi) || []).length;
  const shapeCount = (svgText.match(/<(?:rect|circle|ellipse|polygon|polyline|line)\b/gi) || []).length;
  const textCount = (svgText.match(/<text\b/gi) || []).length;
  const vbMatch = svgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);

  return {
    colors: Array.from(colorSet).slice(0, 32),
    pathCount,
    shapeCount,
    textCount,
    viewBox: vbMatch ? vbMatch[1] : '0 0 100 100',
  };
}

/**
 * Non-destructively replace all occurrences of a color hex inside SVG source XML.
 */
export function replaceSvgColor(svgText: string, oldColor: string, newColor: string): string {
  if (!oldColor || !newColor) return svgText;
  const escaped = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return svgText.replace(new RegExp(escaped, 'gi'), newColor);
}

function parseTimestampMs(raw: string): number {
  const clean = raw.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const h = Number.parseFloat(parts[0]) || 0;
    const m = Number.parseFloat(parts[1]) || 0;
    const s = Number.parseFloat(parts[2]) || 0;
    return Math.round((h * 3600 + m * 60 + s) * 1000);
  }
  if (parts.length === 2) {
    const m = Number.parseFloat(parts[0]) || 0;
    const s = Number.parseFloat(parts[1]) || 0;
    return Math.round((m * 60 + s) * 1000);
  }
  return 0;
}

function formatMsTimestamp(ms: number, mode: 'srt' | 'vtt' | 'lrc'): string {
  const clamped = Math.max(0, Math.round(ms));
  if (mode === 'lrc') {
    const mins = Math.floor(clamped / 60000);
    const secs = Math.floor((clamped % 60000) / 1000);
    const cs = Math.floor((clamped % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
  const hrs = Math.floor(clamped / 3600000);
  const mins = Math.floor((clamped % 3600000) / 60000);
  const secs = Math.floor((clamped % 60000) / 1000);
  const rem = clamped % 1000;
  const sep = mode === 'srt' ? ',' : '.';
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}${sep}${String(rem).padStart(3, '0')}`;
}

/**
 * Parse .SRT, .VTT, or .LRC timed cues into structured editable records.
 */
export function parseSubtitleCues(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lrcMatches = Array.from(text.matchAll(/^\[(\d{2}:\d{2}(?:\.\d{1,3})?)\]\s*(.+)$/gm));
  if (lrcMatches.length > 0) {
    for (let i = 0; i < lrcMatches.length; i++) {
      const startMs = parseTimestampMs(lrcMatches[i][1]);
      const nextStart =
        i + 1 < lrcMatches.length ? parseTimestampMs(lrcMatches[i + 1][1]) : startMs + 3500;
      cues.push({
        index: i + 1,
        startMs,
        endMs: Math.max(startMs + 500, nextStart),
        text: lrcMatches[i][2].trim(),
      });
    }
    return cues;
  }

  const blocks = text.replace(/^WEBVTT[^\n]*\n+/i, '').split(/\r?\n\s*\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const [startRaw, endRaw] = lines[timeIdx].split('-->');
    const body = lines.slice(timeIdx + 1).join('\n').trim();
    if (!startRaw || !endRaw) continue;
    cues.push({
      index: cues.length + 1,
      startMs: parseTimestampMs(startRaw),
      endMs: parseTimestampMs(endRaw.split(/\s+/)[0]),
      text: body,
    });
  }

  return cues;
}

/**
 * Serialize & optionally time-shift subtitle cues to .SRT, .VTT, or .LRC.
 */
export function serializeSubtitleCues(
  cues: SubtitleCue[],
  targetFormat: 'srt' | 'vtt' | 'lrc',
  offsetMs = 0
): string {
  if (targetFormat === 'lrc') {
    return cues
      .map((c) => `[${formatMsTimestamp(c.startMs + offsetMs, 'lrc')}] ${c.text.replace(/\n+/g, ' ')}`)
      .join('\n');
  }

  const header = targetFormat === 'vtt' ? 'WEBVTT\n\n' : '';
  const body = cues
    .map((c, idx) => {
      const start = formatMsTimestamp(c.startMs + offsetMs, targetFormat);
      const end = formatMsTimestamp(c.endMs + offsetMs, targetFormat);
      return `${idx + 1}\n${start} --> ${end}\n${c.text}`;
    })
    .join('\n\n');
  return `${header}${body}`;
}

/**
 * Compute aggregate numerical statistics (count, sum, avg, min, max) across spreadsheet columns.
 */
export function computeSpreadsheetColumnStats(
  headers: string[],
  rows: string[][]
): SpreadsheetColumnStat[] {
  return headers.map((header, colIdx) => {
    const nums: number[] = [];
    for (const row of rows) {
      const raw = (row[colIdx] || '').trim().replace(/[$,%\s]/g, '');
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) nums.push(n);
    }
    if (nums.length === 0) {
      return { header, numericCount: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    for (const n of nums) {
      sum += n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    return {
      header,
      numericCount: nums.length,
      sum: Number(sum.toFixed(4)),
      avg: Number((sum / nums.length).toFixed(4)),
      min,
      max,
    };
  });
}

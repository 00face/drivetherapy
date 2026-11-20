/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native Heightmap, DEM & Cartographic Terrain Engine
 *  - Parsers for NASA SRTM .HGT (16-bit BE), USGS/ESRI ASCII Grid .ASC/.DEM, and 16-bit Raw Heightfields
 *  - Analytical Horn 3x3 Hillshade Computation (Azimuth / Altitude)
 *  - Marching-Squares Topographic Contour Isolines
 *  - A->B Elevation Transect Profile Sampling (Distance, Elevation Gain/Loss, Grade %)
 *  - Terrain Sculpting Brushes & Watertight 3D-Printable .STL Plinth Exporter
 */

import type { EditableMesh, Vec3 } from './meshModelingEngine';
import { exportMeshToBinaryStl, recomputeMeshNormals } from './meshModelingEngine';

export interface ElevationGrid {
  width: number;
  height: number;
  elevations: Float32Array;
  minElevation: number;
  maxElevation: number;
  cellSizeMeters: number;
  sourceLabel: string;
}

export interface ContourSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  elevation: number;
}

export interface ElevationProfilePoint {
  distanceMeters: number;
  elevationMeters: number;
  u: number;
  v: number;
}

export interface ElevationProfileSummary {
  points: ElevationProfilePoint[];
  totalDistanceMeters: number;
  minElevation: number;
  maxElevation: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  maxSlopePercent: number;
}

export type TerrainRampKind =
  | 'hypsometric'
  | 'usgs-topo'
  | 'bathymetry'
  | 'thermal'
  | 'grayscale';

function computeMinMax(elevations: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < elevations.length; i++) {
    const v = elevations[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  return { min, max };
}

/**
 * Parses NASA SRTM .HGT (16-bit big-endian signed integers on square N x N grid)
 */
export function parseSrtmHgtBytes(bytes: Uint8Array, sourceLabel = 'SRTM.hgt'): ElevationGrid {
  const totalSamples = Math.floor(bytes.byteLength / 2);
  const side = Math.max(2, Math.round(Math.sqrt(totalSamples)));
  const count = side * side;
  const elevations = new Float32Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let i = 0; i < count; i++) {
    if (i * 2 + 1 >= bytes.byteLength) break;
    const val = view.getInt16(i * 2, false);
    elevations[i] = val <= -32760 ? 0 : val;
  }
  const { min, max } = computeMinMax(elevations);
  return {
    width: side,
    height: side,
    elevations,
    minElevation: min,
    maxElevation: max,
    cellSizeMeters: side >= 3601 ? 30 : 90,
    sourceLabel,
  };
}

/**
 * Parses ESRI / USGS ASCII Grid (.ASC / .DEM text)
 */
export function parseAsciiGridDem(text: string, sourceLabel = 'terrain.asc'): ElevationGrid {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let ncols = 0;
  let nrows = 0;
  let cellsize = 30;
  let nodata = -9999;
  const values: number[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    const key = parts[0].toLowerCase();
    if (key === 'ncols' && parts[1]) ncols = parseInt(parts[1], 10);
    else if (key === 'nrows' && parts[1]) nrows = parseInt(parts[1], 10);
    else if (key === 'cellsize' && parts[1]) cellsize = parseFloat(parts[1]) || 30;
    else if ((key === 'nodata_value' || key === 'nodata') && parts[1]) nodata = parseFloat(parts[1]);
    else if (/^[-+]?\d/.test(parts[0])) {
      for (const tok of parts) {
        const num = parseFloat(tok);
        values.push(Number.isFinite(num) && num !== nodata ? num : 0);
      }
    }
  }

  if (ncols <= 0 || nrows <= 0) {
    const side = Math.max(2, Math.floor(Math.sqrt(values.length)));
    ncols = side;
    nrows = side;
  }

  const elevations = new Float32Array(ncols * nrows);
  for (let i = 0; i < elevations.length; i++) {
    elevations[i] = values[i] ?? 0;
  }
  const { min, max } = computeMinMax(elevations);
  return {
    width: ncols,
    height: nrows,
    elevations,
    minElevation: min,
    maxElevation: max,
    cellSizeMeters: cellsize,
    sourceLabel,
  };
}

/**
 * Deterministic multi-octave ridged multifractal terrain generator (fallback / synth mode)
 */
export function generateProceduralDemGrid(size = 64, sourceLabel = 'Procedural Terrain'): ElevationGrid {
  const elevations = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const ny = (y / size) * 4.2;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 4.2;
      const ridge1 = 1 - Math.abs(Math.sin(nx * 1.4 + Math.cos(ny * 1.1)));
      const ridge2 = 0.5 * (1 - Math.abs(Math.cos(nx * 2.7 - ny * 2.2)));
      const basin = Math.sin(nx * 0.7) * Math.cos(ny * 0.7) * 0.4;
      const peak = Math.exp(-((nx - 2.1) ** 2 + (ny - 2.0) ** 2) * 0.65);
      elevations[y * size + x] = (ridge1 * 0.55 + ridge2 * 0.35 + basin * 0.25 + peak * 0.9) * 1400;
    }
  }
  const { min, max } = computeMinMax(elevations);
  return {
    width: size,
    height: size,
    elevations,
    minElevation: min,
    maxElevation: max,
    cellSizeMeters: 30,
    sourceLabel,
  };
}

/**
 * Horn's 3x3 Analytical Hillshade (returns 0..255 shade per grid cell)
 */
export function computeAnalyticalHillshade(
  grid: ElevationGrid,
  azimuthDeg = 315,
  altitudeDeg = 45,
  zFactor = 1.0
): Uint8Array {
  const { width, height, elevations, cellSizeMeters } = grid;
  const out = new Uint8Array(width * height);
  const azRad = ((360 - azimuthDeg + 90) * Math.PI) / 180;
  const zenRad = ((90 - altitudeDeg) * Math.PI) / 180;
  const cosZen = Math.cos(zenRad);
  const sinZen = Math.sin(zenRad);
  const cell8 = Math.max(0.01, 8 * cellSizeMeters);

  const sample = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    return elevations[cy * width + cx] * zFactor;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = sample(x - 1, y - 1);
      const b = sample(x, y - 1);
      const c = sample(x + 1, y - 1);
      const d = sample(x - 1, y);
      const f = sample(x + 1, y);
      const g = sample(x - 1, y + 1);
      const h = sample(x, y + 1);
      const i = sample(x + 1, y + 1);

      const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / cell8;
      const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / cell8;
      const slopeRad = Math.atan(Math.hypot(dzdx, dzdy));
      const aspectRad =
        dzdx !== 0
          ? Math.atan2(dzdy, -dzdx)
          : dzdy > 0
          ? Math.PI / 2
          : -Math.PI / 2;

      const shade =
        cosZen * Math.cos(slopeRad) +
        sinZen * Math.sin(slopeRad) * Math.cos(azRad - aspectRad);
      out[y * width + x] = Math.max(0, Math.min(255, Math.round(shade * 255)));
    }
  }
  return out;
}

/**
 * Marching-Squares Topographic Contour Isolines
 */
export function extractContourSegments(
  grid: ElevationGrid,
  intervalMeters = 150
): ContourSegment[] {
  const { width, height, elevations, minElevation, maxElevation } = grid;
  const step = Math.max(1, intervalMeters);
  const startLevel = Math.ceil(minElevation / step) * step;
  const segments: ContourSegment[] = [];

  for (let level = startLevel; level <= maxElevation; level += step) {
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const z0 = elevations[y * width + x];
        const z1 = elevations[y * width + x + 1];
        const z2 = elevations[(y + 1) * width + x + 1];
        const z3 = elevations[(y + 1) * width + x];

        const crossings: Array<[number, number]> = [];
        const interp = (a: number, b: number): number => {
          const d = b - a;
          return Math.abs(d) > 1e-6 ? (level - a) / d : 0.5;
        };
        if ((z0 < level) !== (z1 < level)) crossings.push([x + interp(z0, z1), y]);
        if ((z1 < level) !== (z2 < level)) crossings.push([x + 1, y + interp(z1, z2)]);
        if ((z2 < level) !== (z3 < level)) crossings.push([x + 1 - interp(z2, z3), y + 1]);
        if ((z3 < level) !== (z0 < level)) crossings.push([x, y + 1 - interp(z3, z0)]);

        if (crossings.length >= 2) {
          segments.push({
            x1: crossings[0][0],
            y1: crossings[0][1],
            x2: crossings[1][0],
            y2: crossings[1][1],
            elevation: level,
          });
        }
      }
    }
  }
  return segments;
}

export function sampleElevationProfile(
  grid: ElevationGrid,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  sampleCount = 48
): ElevationProfileSummary {
  const count = Math.max(2, sampleCount);
  const points: ElevationProfilePoint[] = [];
  const dxMeters = (u1 - u0) * (grid.width - 1) * grid.cellSizeMeters;
  const dyMeters = (v1 - v0) * (grid.height - 1) * grid.cellSizeMeters;
  const totalDist = Math.hypot(dxMeters, dyMeters);

  let minEl = Infinity;
  let maxEl = -Infinity;
  let gain = 0;
  let loss = 0;
  let maxSlope = 0;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const u = u0 + (u1 - u0) * t;
    const v = v0 + (v1 - v0) * t;
    const gx = Math.max(0, Math.min(grid.width - 1, Math.round(u * (grid.width - 1))));
    const gy = Math.max(0, Math.min(grid.height - 1, Math.round(v * (grid.height - 1))));
    const el = grid.elevations[gy * grid.width + gx];
    if (el < minEl) minEl = el;
    if (el > maxEl) maxEl = el;
    if (i > 0) {
      const prevEl = points[i - 1].elevationMeters;
      const diff = el - prevEl;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
      const stepDist = totalDist / (count - 1);
      if (stepDist > 0.01) {
        maxSlope = Math.max(maxSlope, (Math.abs(diff) / stepDist) * 100);
      }
    }
    points.push({
      distanceMeters: Number((totalDist * t).toFixed(1)),
      elevationMeters: Number(el.toFixed(1)),
      u,
      v,
    });
  }

  return {
    points,
    totalDistanceMeters: Number(totalDist.toFixed(1)),
    minElevation: Number(minEl.toFixed(1)),
    maxElevation: Number(maxEl.toFixed(1)),
    elevationGainMeters: Number(gain.toFixed(1)),
    elevationLossMeters: Number(loss.toFixed(1)),
    maxSlopePercent: Number(maxSlope.toFixed(1)),
  };
}

export function applyTerrainBrush(
  grid: ElevationGrid,
  u: number,
  v: number,
  radiusNorm: number,
  strengthMeters: number,
  mode: 'raise' | 'lower' | 'smooth' | 'flatten'
): ElevationGrid {
  const next = new Float32Array(grid.elevations);
  const cx = u * (grid.width - 1);
  const cy = v * (grid.height - 1);
  const radCells = Math.max(1, radiusNorm * Math.max(grid.width, grid.height));
  const targetFlat = grid.elevations[Math.round(cy) * grid.width + Math.round(cx)] ?? grid.minElevation;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radCells) continue;
      const t = 1 - d / radCells;
      const falloff = t * t * (3 - 2 * t);
      const idx = y * grid.width + x;
      if (mode === 'raise') {
        next[idx] += strengthMeters * falloff;
      } else if (mode === 'lower') {
        next[idx] -= strengthMeters * falloff;
      } else if (mode === 'flatten') {
        next[idx] += (targetFlat - next[idx]) * Math.min(1, falloff * 0.65);
      } else if (mode === 'smooth') {
        let sum = 0;
        let cnt = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = Math.max(0, Math.min(grid.width - 1, x + ox));
            const ny = Math.max(0, Math.min(grid.height - 1, y + oy));
            sum += grid.elevations[ny * grid.width + nx];
            cnt++;
          }
        }
        next[idx] += (sum / cnt - next[idx]) * Math.min(1, falloff * 0.7);
      }
    }
  }

  const { min, max } = computeMinMax(next);
  return {
    ...grid,
    elevations: next,
    minElevation: min,
    maxElevation: max,
  };
}

/**
 * Converts a heightfield grid into a watertight 3D-printable solid plinth mesh + Binary STL
 */
export function buildWatertightTerrainPlinthMesh(
  grid: ElevationGrid,
  opts?: { targetWidthMm?: number; maxHeightMm?: number; baseThicknessMm?: number }
): EditableMesh {
  const targetW = opts?.targetWidthMm ?? 100;
  const maxH = opts?.maxHeightMm ?? 24;
  const baseMm = opts?.baseThicknessMm ?? 4;

  // Subsample to <= 48x48 for responsive 3D print export
  const cols = Math.min(48, grid.width);
  const rows = Math.min(48, grid.height);
  const range = Math.max(1e-4, grid.maxElevation - grid.minElevation);

  const vertices: Vec3[] = [];
  const triangles: [number, number, number][] = [];

  // Top surface vertices [0 .. rows*cols - 1]
  for (let r = 0; r < rows; r++) {
    const sy = Math.round((r / Math.max(1, rows - 1)) * (grid.height - 1));
    const z = ((r / Math.max(1, rows - 1)) - 0.5) * targetW;
    for (let c = 0; c < cols; c++) {
      const sx = Math.round((c / Math.max(1, cols - 1)) * (grid.width - 1));
      const x = ((c / Math.max(1, cols - 1)) - 0.5) * targetW;
      const el = grid.elevations[sy * grid.width + sx];
      const y = baseMm + ((el - grid.minElevation) / range) * maxH;
      vertices.push([x, y, z]);
    }
  }

  // Bottom surface vertices [rows*cols .. 2*rows*cols - 1]
  const botOffset = rows * cols;
  for (let r = 0; r < rows; r++) {
    const z = ((r / Math.max(1, rows - 1)) - 0.5) * targetW;
    for (let c = 0; c < cols; c++) {
      const x = ((c / Math.max(1, cols - 1)) - 0.5) * targetW;
      vertices.push([x, 0, z]);
    }
  }

  // Top & bottom grid triangles
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      triangles.push([a, d, b], [b, d, e]);
      // Bottom flipped
      triangles.push([botOffset + a, botOffset + b, botOffset + d], [botOffset + b, botOffset + e, botOffset + d]);
    }
  }

  // 4 watertight side walls
  for (let c = 0; c < cols - 1; c++) {
    // North edge (r=0)
    triangles.push([c, c + 1, botOffset + c + 1], [c, botOffset + c + 1, botOffset + c]);
    // South edge (r=rows-1)
    const s = (rows - 1) * cols + c;
    triangles.push([s, botOffset + s + 1, s + 1], [s, botOffset + s, botOffset + s + 1]);
  }
  for (let r = 0; r < rows - 1; r++) {
    // West edge (c=0)
    const w0 = r * cols;
    const w1 = (r + 1) * cols;
    triangles.push([w0, botOffset + w1, w1], [w0, botOffset + w0, botOffset + w1]);
    // East edge (c=cols-1)
    const e0 = r * cols + (cols - 1);
    const e1 = (r + 1) * cols + (cols - 1);
    triangles.push([e0, e1, botOffset + e1], [e0, botOffset + e1, botOffset + e0]);
  }

  return recomputeMeshNormals({
    vertices,
    triangles,
    normals: [],
    vertexMask: new Array(vertices.length).fill(0),
    edgeCreases: {},
    unit: 'mm',
    name: `${grid.sourceLabel}_plinth`,
  });
}

export function exportHeightmapToWatertightStl(
  grid: ElevationGrid,
  opts?: { targetWidthMm?: number; maxHeightMm?: number; baseThicknessMm?: number }
): Uint8Array {
  const mesh = buildWatertightTerrainPlinthMesh(grid, opts);
  return exportMeshToBinaryStl(mesh);
}

export function mapElevationToRgb(
  norm: number,
  ramp: TerrainRampKind
): [number, number, number] {
  const t = Math.max(0, Math.min(1, norm));
  if (ramp === 'grayscale') {
    const v = Math.round(t * 255);
    return [v, v, v];
  }
  if (ramp === 'thermal') {
    return [
      Math.round(Math.min(255, t * 2 * 255)),
      Math.round(Math.max(0, Math.min(255, (t - 0.35) * 380))),
      Math.round(Math.max(0, (1 - t * 1.5) * 180)),
    ];
  }
  if (ramp === 'bathymetry') {
    return [
      Math.round(12 + t * 90),
      Math.round(45 + t * 185),
      Math.round(115 + t * 135),
    ];
  }
  if (ramp === 'usgs-topo') {
    if (t < 0.25) return [34, 118, 86];
    if (t < 0.55) return [128, 178, 92];
    if (t < 0.8) return [205, 168, 108];
    return [242, 240, 238];
  }
  // hypsometric
  if (t < 0.2) return [26, 98, 148];
  if (t < 0.45) return [56, 152, 92];
  if (t < 0.72) return [196, 166, 86];
  if (t < 0.9) return [148, 98, 72];
  return [245, 248, 252];
}

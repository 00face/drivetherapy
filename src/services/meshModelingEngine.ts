/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native 3D Modeling, Sculpting, Topology Repair & 3D Print Conversion Engine
 *  - TinkerCad-Style Parametric Primitives, Workplane Alignment, CSG Booleans & Rational NURBS
 *  - ZBrush & Sculptris Optimization (Spatial 3D Octree, Dyntopo Dynamic Tessellation, Masking & Symmetry)
 *  - Wings3D-Style Winged/Half-Edge Poly Operations (Extrude, Inset, Bevel, Loop Cut, Intrude, Catmull-Clark SubD)
 *  - Automated Watertight Mesh Repair (Weld, Degenerate Purge, BFS Winding Unification, Ear-Clip Hole Fill)
 *  - 3D Print Slicer & Exporters (Overhang Heatmap, Volume/Filament/Time, 2.5D Layer Slices, .GCODE / .STL / .OBJ / .PLY)
 */

export type Vec3 = [number, number, number];

export interface EditableMesh {
  vertices: Vec3[];
  triangles: [number, number, number][];
  normals: Vec3[];
  vertexMask: number[];
  edgeCreases: Record<string, number>;
  uvs?: Array<[number, number]>;
  uvTriangles?: Array<[number, number, number]>;
  unit: 'mm' | 'in';
  name: string;
}

export type UvProjectionKind =
  | 'box-triplanar'
  | 'planar-xy'
  | 'planar-xz'
  | 'cylindrical'
  | 'spherical';

export interface UvHealthReport {
  hasUvs: boolean;
  uvVertexCount: number;
  uvTriangleCount: number;
  outOfBoundsUvCount: number;
  flippedUvTriangles: number;
  uvIslandCount: number;
  uvCoveragePercent: number;
}

export type TinkerPrimitiveKind =
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'wedge'
  | 'roof'
  | 'tube'
  | 'polygon';

export interface TinkerSceneNode {
  id: string;
  name: string;
  kind: TinkerPrimitiveKind | 'nurbs' | 'imported';
  role: 'solid' | 'hole';
  position: Vec3;
  rotationDeg: Vec3;
  scale: Vec3;
  color: string;
  mesh: EditableMesh;
}

export type SculptBrushKind =
  | 'draw'
  | 'clay'
  | 'move'
  | 'smooth'
  | 'inflate'
  | 'pinch'
  | 'flatten'
  | 'mask';

export interface SculptBrushStroke {
  brush: SculptBrushKind;
  center: Vec3;
  delta?: Vec3;
  radius: number;
  strength: number;
  invert?: boolean;
  mirrorX?: boolean;
  mirrorY?: boolean;
  mirrorZ?: boolean;
  radialSymmetry?: number;
}

export interface OctreeQueryResult {
  indices: number[];
  nodesVisited: number;
}

export interface MeshHealthReport {
  vertexCount: number;
  triangleCount: number;
  nonManifoldEdges: number;
  openBoundaryEdges: number;
  openHoleLoops: number;
  degenerateFaces: number;
  isolatedVertices: number;
  isWatertight: boolean;
  volumeCm3: number;
  surfaceAreaMm2: number;
  boundsMin: Vec3;
  boundsMax: Vec3;
  boundsDim: Vec3;
}

export interface PrintSliceLayer {
  zMm: number;
  segments: Array<[number, number, number, number]>;
}

export interface PrintSliceReport {
  fitsBuildPlate: boolean;
  overhangTriangles: number[];
  overhangPercent: number;
  estimatedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintMinutes: number;
  layerCount: number;
  layers: PrintSliceLayer[];
  gcodePreview: string;
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len3(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function norm3(a: Vec3): Vec3 {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export function cloneEditableMesh(mesh: EditableMesh): EditableMesh {
  return {
    vertices: mesh.vertices.map((v) => [v[0], v[1], v[2]]),
    triangles: mesh.triangles.map((t) => [t[0], t[1], t[2]]),
    normals: mesh.normals.map((n) => [n[0], n[1], n[2]]),
    vertexMask: [...mesh.vertexMask],
    edgeCreases: { ...mesh.edgeCreases },
    uvs: mesh.uvs ? mesh.uvs.map((uv) => [uv[0], uv[1]]) : [],
    uvTriangles: mesh.uvTriangles ? mesh.uvTriangles.map((t) => [t[0], t[1], t[2]]) : [],
    unit: mesh.unit,
    name: mesh.name,
  };
}

export function recomputeMeshNormals(mesh: EditableMesh, subsetIndices?: Set<number>): EditableMesh {
  const normals: Vec3[] =
    subsetIndices && mesh.normals.length === mesh.vertices.length
      ? mesh.normals.map((n) => [n[0], n[1], n[2]])
      : mesh.vertices.map(() => [0, 0, 0]);

  if (subsetIndices) {
    for (const idx of subsetIndices) {
      if (normals[idx]) normals[idx] = [0, 0, 0];
    }
  }

  for (const [i0, i1, i2] of mesh.triangles) {
    if (
      subsetIndices &&
      !subsetIndices.has(i0) &&
      !subsetIndices.has(i1) &&
      !subsetIndices.has(i2)
    ) {
      continue;
    }
    const v0 = mesh.vertices[i0];
    const v1 = mesh.vertices[i1];
    const v2 = mesh.vertices[i2];
    if (!v0 || !v1 || !v2) continue;
    const fn = cross3(sub3(v1, v0), sub3(v2, v0));
    if (!subsetIndices || subsetIndices.has(i0)) normals[i0] = add3(normals[i0], fn);
    if (!subsetIndices || subsetIndices.has(i1)) normals[i1] = add3(normals[i1], fn);
    if (!subsetIndices || subsetIndices.has(i2)) normals[i2] = add3(normals[i2], fn);
  }

  for (let i = 0; i < normals.length; i++) {
    if (!subsetIndices || subsetIndices.has(i)) {
      normals[i] = norm3(normals[i]);
    }
  }

  return {
    ...mesh,
    normals,
    vertexMask:
      mesh.vertexMask.length === mesh.vertices.length
        ? mesh.vertexMask
        : new Array(mesh.vertices.length).fill(0),
  };
}

// ============================================================================
// 1. ZBRUSH & SCULPTRIS SPATIAL OCTREE ACCELERATION
// ============================================================================

interface OctreeNode {
  min: Vec3;
  max: Vec3;
  indices: number[];
  children: OctreeNode[] | null;
}

export class SpatialOctree {
  private root: OctreeNode;
  private vertices: Vec3[];

  constructor(vertices: Vec3[], maxDepth = 6, maxPerLeaf = 24) {
    this.vertices = vertices;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (const v of vertices) {
      if (v[0] < minX) minX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] > maxZ) maxZ = v[2];
    }
    if (!Number.isFinite(minX)) {
      minX = minY = minZ = -1;
      maxX = maxY = maxZ = 1;
    }
    const pad = 0.01;
    this.root = this.buildNode(
      [minX - pad, minY - pad, minZ - pad],
      [maxX + pad, maxY + pad, maxZ + pad],
      vertices.map((_, i) => i),
      0,
      maxDepth,
      maxPerLeaf
    );
  }

  private buildNode(
    min: Vec3,
    max: Vec3,
    indices: number[],
    depth: number,
    maxDepth: number,
    maxPerLeaf: number
  ): OctreeNode {
    if (depth >= maxDepth || indices.length <= maxPerLeaf) {
      return { min, max, indices, children: null };
    }
    const mid: Vec3 = [
      (min[0] + max[0]) * 0.5,
      (min[1] + max[1]) * 0.5,
      (min[2] + max[2]) * 0.5,
    ];
    const buckets: number[][] = Array.from({ length: 8 }, () => []);
    for (const idx of indices) {
      const v = this.vertices[idx];
      const oct =
        (v[0] >= mid[0] ? 1 : 0) |
        (v[1] >= mid[1] ? 2 : 0) |
        (v[2] >= mid[2] ? 4 : 0);
      buckets[oct].push(idx);
    }
    const children: OctreeNode[] = [];
    for (let o = 0; o < 8; o++) {
      if (buckets[o].length === 0) continue;
      const cMin: Vec3 = [
        o & 1 ? mid[0] : min[0],
        o & 2 ? mid[1] : min[1],
        o & 4 ? mid[2] : min[2],
      ];
      const cMax: Vec3 = [
        o & 1 ? max[0] : mid[0],
        o & 2 ? max[1] : mid[1],
        o & 4 ? max[2] : mid[2],
      ];
      children.push(this.buildNode(cMin, cMax, buckets[o], depth + 1, maxDepth, maxPerLeaf));
    }
    return { min, max, indices: [], children };
  }

  querySphere(center: Vec3, radius: number): OctreeQueryResult {
    const indices: number[] = [];
    let nodesVisited = 0;
    const rSq = radius * radius;

    const visit = (node: OctreeNode): void => {
      nodesVisited++;
      // Closest point on AABB to sphere center
      const cx = Math.max(node.min[0], Math.min(center[0], node.max[0]));
      const cy = Math.max(node.min[1], Math.min(center[1], node.max[1]));
      const cz = Math.max(node.min[2], Math.min(center[2], node.max[2]));
      const dx = center[0] - cx;
      const dy = center[1] - cy;
      const dz = center[2] - cz;
      if (dx * dx + dy * dy + dz * dz > rSq) return;

      if (node.children) {
        for (const child of node.children) visit(child);
      } else {
        for (const idx of node.indices) {
          const v = this.vertices[idx];
          const vx = v[0] - center[0];
          const vy = v[1] - center[1];
          const vz = v[2] - center[2];
          if (vx * vx + vy * vy + vz * vz <= rSq) {
            indices.push(idx);
          }
        }
      }
    };

    visit(this.root);
    return { indices, nodesVisited };
  }
}

// ============================================================================
// 2. TINKERCAD PRIMITIVES, TRANSFORM, CSG BOOLEANS & RATIONAL NURBS
// ============================================================================

export function generateParametricPrimitive(
  kind: TinkerPrimitiveKind,
  opts?: { sizeMm?: number; segments?: number; holeRadiusRatio?: number }
): EditableMesh {
  const s = (opts?.sizeMm ?? 20) * 0.5;
  const seg = Math.max(6, Math.min(48, opts?.segments ?? 16));
  const vertices: Vec3[] = [];
  const triangles: [number, number, number][] = [];

  if (kind === 'box') {
    const corners: Vec3[] = [
      [-s, 0, -s],
      [s, 0, -s],
      [s, 0, s],
      [-s, 0, s],
      [-s, s * 2, -s],
      [s, s * 2, -s],
      [s, s * 2, s],
      [-s, s * 2, s],
    ];
    vertices.push(...corners);
    const faces: [number, number, number][] = [
      [0, 2, 1],
      [0, 3, 2],
      [4, 5, 6],
      [4, 6, 7],
      [0, 1, 5],
      [0, 5, 4],
      [1, 2, 6],
      [1, 6, 5],
      [2, 3, 7],
      [2, 7, 6],
      [3, 0, 4],
      [3, 4, 7],
    ];
    triangles.push(...faces);
  } else if (kind === 'wedge') {
    vertices.push(
      [-s, 0, -s],
      [s, 0, -s],
      [s, 0, s],
      [-s, 0, s],
      [-s, s * 2, -s],
      [s, s * 2, -s]
    );
    triangles.push(
      [0, 2, 1],
      [0, 3, 2],
      [0, 1, 5],
      [0, 5, 4],
      [4, 5, 2],
      [4, 2, 3],
      [1, 2, 5],
      [0, 4, 3]
    );
  } else if (kind === 'roof') {
    vertices.push(
      [-s, 0, -s],
      [s, 0, -s],
      [s, 0, s],
      [-s, 0, s],
      [0, s * 1.6, -s],
      [0, s * 1.6, s]
    );
    triangles.push(
      [0, 2, 1],
      [0, 3, 2],
      [0, 1, 4],
      [3, 5, 2],
      [0, 4, 5],
      [0, 5, 3],
      [1, 2, 5],
      [1, 5, 4]
    );
  } else if (kind === 'sphere') {
    const rings = Math.max(8, Math.floor(seg * 0.75));
    const cols = seg;
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      const y = s + Math.cos(phi) * s;
      const rr = Math.sin(phi) * s;
      for (let c = 0; c < cols; c++) {
        const theta = (c / cols) * Math.PI * 2;
        vertices.push([Math.cos(theta) * rr, y, Math.sin(theta) * rr]);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let c = 0; c < cols; c++) {
        const nextC = (c + 1) % cols;
        const a = r * cols + c;
        const b = r * cols + nextC;
        const d = (r + 1) * cols + c;
        const e = (r + 1) * cols + nextC;
        triangles.push([a, d, b], [b, d, e]);
      }
    }
  } else if (kind === 'torus') {
    const major = s * 0.85;
    const minor = s * 0.32;
    const ringSeg = seg;
    const tubeSeg = Math.max(8, Math.floor(seg * 0.75));
    for (let i = 0; i < ringSeg; i++) {
      const u = (i / ringSeg) * Math.PI * 2;
      const cu = Math.cos(u);
      const su = Math.sin(u);
      for (let j = 0; j < tubeSeg; j++) {
        const v = (j / tubeSeg) * Math.PI * 2;
        const cv = Math.cos(v);
        const sv = Math.sin(v);
        const r = major + minor * cv;
        vertices.push([r * cu, minor + minor * sv, r * su]);
      }
    }
    for (let i = 0; i < ringSeg; i++) {
      const ni = (i + 1) % ringSeg;
      for (let j = 0; j < tubeSeg; j++) {
        const nj = (j + 1) % tubeSeg;
        const a = i * tubeSeg + j;
        const b = ni * tubeSeg + j;
        const c = ni * tubeSeg + nj;
        const d = i * tubeSeg + nj;
        triangles.push([a, b, c], [a, c, d]);
      }
    }
  } else if (kind === 'tube') {
    const outer = s;
    const inner = s * (opts?.holeRadiusRatio ?? 0.55);
    const h = s * 2;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      vertices.push([outer * ca, 0, outer * sa]);
      vertices.push([outer * ca, h, outer * sa]);
      vertices.push([inner * ca, 0, inner * sa]);
      vertices.push([inner * ca, h, inner * sa]);
    }
    for (let i = 0; i < seg; i++) {
      const ni = (i + 1) % seg;
      const o0b = i * 4,
        o0t = i * 4 + 1,
        i0b = i * 4 + 2,
        i0t = i * 4 + 3;
      const o1b = ni * 4,
        o1t = ni * 4 + 1,
        i1b = ni * 4 + 2,
        i1t = ni * 4 + 3;
      triangles.push(
        [o0b, o1b, o1t],
        [o0b, o1t, o0t],
        [i0b, i1t, i1b],
        [i0b, i0t, i1t],
        [o0t, o1t, i1t],
        [o0t, i1t, i0t],
        [o0b, i1b, o1b],
        [o0b, i0b, i1b]
      );
    }
  } else {
    // cylinder, cone, polygon
    const sides = kind === 'polygon' ? 6 : seg;
    const topRadius = kind === 'cone' ? 0.001 : s;
    const h = s * 2;
    const botCenter = 0;
    const topCenter = 1;
    vertices.push([0, 0, 0], [0, h, 0]);
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      vertices.push([s * ca, 0, s * sa], [topRadius * ca, h, topRadius * sa]);
    }
    for (let i = 0; i < sides; i++) {
      const ni = (i + 1) % sides;
      const b0 = 2 + i * 2;
      const t0 = 2 + i * 2 + 1;
      const b1 = 2 + ni * 2;
      const t1 = 2 + ni * 2 + 1;
      triangles.push([botCenter, b1, b0], [topCenter, t0, t1], [b0, b1, t1], [b0, t1, t0]);
    }
  }

  return recomputeMeshNormals({
    vertices,
    triangles,
    normals: [],
    vertexMask: new Array(vertices.length).fill(0),
    edgeCreases: {},
    unit: 'mm',
    name: `${kind}_primitive`,
  });
}

export function transformEditableMesh(
  mesh: EditableMesh,
  position: Vec3,
  rotationDeg: Vec3,
  scale: Vec3
): EditableMesh {
  const rx = (rotationDeg[0] * Math.PI) / 180;
  const ry = (rotationDeg[1] * Math.PI) / 180;
  const rz = (rotationDeg[2] * Math.PI) / 180;
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);

  const vertices = mesh.vertices.map((v): Vec3 => {
    const x0 = v[0] * scale[0];
    const y0 = v[1] * scale[1];
    const z0 = v[2] * scale[2];
    // Rotate X
    const y1 = y0 * cx - z0 * sx;
    const z1 = y0 * sx + z0 * cx;
    // Rotate Y
    const x2 = x0 * cy + z1 * sy;
    const z2 = -x0 * sy + z1 * cy;
    // Rotate Z
    const x3 = x2 * cz - y1 * sz;
    const y3 = x2 * sz + y1 * cz;
    return [x3 + position[0], y3 + position[1], z2 + position[2]];
  });

  return recomputeMeshNormals({
    ...mesh,
    vertices,
    triangles: mesh.triangles.map((t) => [t[0], t[1], t[2]]),
  });
}

function bSplineBasis(i: number, p: number, u: number, knots: number[]): number {
  if (p === 0) {
    return u >= knots[i] && u < knots[i + 1] ? 1 : 0;
  }
  const denom1 = knots[i + p] - knots[i];
  const denom2 = knots[i + p + 1] - knots[i + 1];
  const term1 = denom1 > 1e-9 ? ((u - knots[i]) / denom1) * bSplineBasis(i, p - 1, u, knots) : 0;
  const term2 =
    denom2 > 1e-9 ? ((knots[i + p + 1] - u) / denom2) * bSplineBasis(i + 1, p - 1, u, knots) : 0;
  return term1 + term2;
}

function buildClampedKnots(count: number, degree: number): number[] {
  const m = count + degree + 1;
  const knots: number[] = [];
  for (let i = 0; i < m; i++) {
    if (i <= degree) knots.push(0);
    else if (i >= m - degree - 1) knots.push(1);
    else knots.push((i - degree) / (count - degree));
  }
  return knots;
}

/**
 * Parametric Rational NURBS Tensor-Product Surface Generator
 */
export function evaluateNurbsSurface(
  controlGrid: Vec3[][],
  weights?: number[][],
  degreeU = 2,
  degreeV = 2,
  stepsU = 16,
  stepsV = 16
): EditableMesh {
  const rows = controlGrid.length;
  const cols = controlGrid[0]?.length || 0;
  if (rows < 2 || cols < 2) {
    return generateParametricPrimitive('box');
  }
  const p = Math.min(degreeU, rows - 1);
  const q = Math.min(degreeV, cols - 1);
  const knotsU = buildClampedKnots(rows, p);
  const knotsV = buildClampedKnots(cols, q);

  const vertices: Vec3[] = [];
  const triangles: [number, number, number][] = [];

  for (let su = 0; su <= stepsU; su++) {
    const u = su === stepsU ? 0.999999 : su / stepsU;
    for (let sv = 0; sv <= stepsV; sv++) {
      const v = sv === stepsV ? 0.999999 : sv / stepsV;
      let numX = 0,
        numY = 0,
        numZ = 0,
        den = 0;

      for (let i = 0; i < rows; i++) {
        const bu = bSplineBasis(i, p, u, knotsU);
        if (bu === 0) continue;
        for (let j = 0; j < cols; j++) {
          const bv = bSplineBasis(j, q, v, knotsV);
          if (bv === 0) continue;
          const w = weights?.[i]?.[j] ?? 1;
          const basis = bu * bv * w;
          const cp = controlGrid[i][j];
          numX += cp[0] * basis;
          numY += cp[1] * basis;
          numZ += cp[2] * basis;
          den += basis;
        }
      }
      const inv = den > 1e-9 ? 1 / den : 1;
      vertices.push([numX * inv, numY * inv, numZ * inv]);
    }
  }

  const stride = stepsV + 1;
  for (let su = 0; su < stepsU; su++) {
    for (let sv = 0; sv < stepsV; sv++) {
      const a = su * stride + sv;
      const b = (su + 1) * stride + sv;
      const c = (su + 1) * stride + sv + 1;
      const d = su * stride + sv + 1;
      triangles.push([a, b, c], [a, c, d]);
    }
  }

  return recomputeMeshNormals({
    vertices,
    triangles,
    normals: [],
    vertexMask: new Array(vertices.length).fill(0),
    edgeCreases: {},
    unit: 'mm',
    name: 'nurbs_surface',
  });
}

function isPointInsideMesh(pt: Vec3, mesh: EditableMesh): boolean {
  // Ray-casting along +X against mesh triangles (Jordan curve / parity rule)
  let hits = 0;
  for (const [i0, i1, i2] of mesh.triangles) {
    const a = mesh.vertices[i0];
    const b = mesh.vertices[i1];
    const c = mesh.vertices[i2];
    if (!a || !b || !c) continue;
    const e1 = sub3(b, a);
    const e2 = sub3(c, a);
    const dir: Vec3 = [1, 0.00013, 0.00017];
    const h = cross3(dir, e2);
    const det = dot3(e1, h);
    if (Math.abs(det) < 1e-8) continue;
    const invDet = 1 / det;
    const s = sub3(pt, a);
    const u = invDet * dot3(s, h);
    if (u < 0 || u > 1) continue;
    const q = cross3(s, e1);
    const v = invDet * dot3(dir, q);
    if (v < 0 || u + v > 1) continue;
    const t = invDet * dot3(e2, q);
    if (t > 1e-5) hits++;
  }
  return hits % 2 === 1;
}

/**
 * TinkerCad CSG Boolean Combiner ('union' | 'subtract' | 'intersect')
 */
export function applyCsgBoolean(
  meshA: EditableMesh,
  meshB: EditableMesh,
  op: 'union' | 'subtract' | 'intersect'
): EditableMesh {
  const outVerts: Vec3[] = [];
  const outTris: [number, number, number][] = [];

  const appendTri = (v0: Vec3, v1: Vec3, v2: Vec3, flip = false): void => {
    const base = outVerts.length;
    outVerts.push([v0[0], v0[1], v0[2]], [v1[0], v1[1], v1[2]], [v2[0], v2[1], v2[2]]);
    outTris.push(flip ? [base, base + 2, base + 1] : [base, base + 1, base + 2]);
  };

  for (const [i0, i1, i2] of meshA.triangles) {
    const v0 = meshA.vertices[i0];
    const v1 = meshA.vertices[i1];
    const v2 = meshA.vertices[i2];
    const centroid: Vec3 = [
      (v0[0] + v1[0] + v2[0]) / 3,
      (v0[1] + v1[1] + v2[1]) / 3,
      (v0[2] + v1[2] + v2[2]) / 3,
    ];
    const insideB = isPointInsideMesh(centroid, meshB);
    if (op === 'union' && !insideB) appendTri(v0, v1, v2, false);
    if (op === 'subtract' && !insideB) appendTri(v0, v1, v2, false);
    if (op === 'intersect' && insideB) appendTri(v0, v1, v2, false);
  }

  for (const [i0, i1, i2] of meshB.triangles) {
    const v0 = meshB.vertices[i0];
    const v1 = meshB.vertices[i1];
    const v2 = meshB.vertices[i2];
    const centroid: Vec3 = [
      (v0[0] + v1[0] + v2[0]) / 3,
      (v0[1] + v1[1] + v2[1]) / 3,
      (v0[2] + v1[2] + v2[2]) / 3,
    ];
    const insideA = isPointInsideMesh(centroid, meshA);
    if (op === 'union' && !insideA) appendTri(v0, v1, v2, false);
    if (op === 'subtract' && insideA) appendTri(v0, v1, v2, true);
    if (op === 'intersect' && insideA) appendTri(v0, v1, v2, false);
  }

  return repairMeshAutomatically(
    {
      vertices: outVerts,
      triangles: outTris,
      normals: [],
      vertexMask: new Array(outVerts.length).fill(0),
      edgeCreases: {},
      unit: meshA.unit,
      name: `${meshA.name}_${op}`,
    },
    1e-4
  );
}

// ============================================================================
// 3. ZBRUSH & SCULPTRIS BRUSHES + DYNAMIC TESSELLATION (DYNTOPO)
// ============================================================================

function computeSymmetricCenters(stroke: SculptBrushStroke): Vec3[] {
  const centers: Vec3[] = [stroke.center];
  const addMirror = (idx: 0 | 1 | 2): void => {
    const snapshot = [...centers];
    for (const c of snapshot) {
      const m: Vec3 = [c[0], c[1], c[2]];
      m[idx] = -m[idx];
      centers.push(m);
    }
  };
  if (stroke.mirrorX) addMirror(0);
  if (stroke.mirrorY) addMirror(1);
  if (stroke.mirrorZ) addMirror(2);

  const radCount = Math.max(1, Math.min(16, stroke.radialSymmetry ?? 1));
  if (radCount > 1) {
    const baseSnapshot = [...centers];
    for (let k = 1; k < radCount; k++) {
      const ang = (k / radCount) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (const c of baseSnapshot) {
        centers.push([c[0] * ca - c[2] * sa, c[1], c[0] * sa + c[2] * ca]);
      }
    }
  }
  return centers;
}

export function applySculptBrushStroke(
  mesh: EditableMesh,
  stroke: SculptBrushStroke,
  octree?: SpatialOctree
): EditableMesh {
  const next = cloneEditableMesh(mesh);
  const tree = octree ?? new SpatialOctree(next.vertices);
  const sign = stroke.invert ? -1 : 1;
  const dirty = new Set<number>();

  // Build adjacency only when smoothing
  let neighbors: Map<number, Set<number>> | null = null;
  if (stroke.brush === 'smooth') {
    neighbors = new Map();
    for (const [a, b, c] of next.triangles) {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      if (!neighbors.has(c)) neighbors.set(c, new Set());
      neighbors.get(a)!.add(b).add(c);
      neighbors.get(b)!.add(a).add(c);
      neighbors.get(c)!.add(a).add(b);
    }
  }

  const symCenters = computeSymmetricCenters(stroke);
  for (const c of symCenters) {
    const { indices } = tree.querySphere(c, stroke.radius);
    if (indices.length === 0) continue;

    // Average plane normal & center for clay/flatten
    let avgNormal: Vec3 = [0, 0, 0];
    let avgPos: Vec3 = [0, 0, 0];
    for (const idx of indices) {
      avgNormal = add3(avgNormal, next.normals[idx] || [0, 1, 0]);
      avgPos = add3(avgPos, next.vertices[idx]);
    }
    avgNormal = norm3(avgNormal);
    avgPos = scale3(avgPos, 1 / indices.length);

    for (const idx of indices) {
      const v = next.vertices[idx];
      const n = next.normals[idx] || [0, 1, 0];
      const d = dist3(v, c);
      const t = Math.max(0, 1 - d / stroke.radius);
      const falloff = t * t * (3 - 2 * t);
      const unmask = stroke.brush === 'mask' ? 1 : 1 - (next.vertexMask[idx] ?? 0);
      const w = falloff * stroke.strength * unmask;
      if (w <= 1e-6) continue;

      if (stroke.brush === 'mask') {
        next.vertexMask[idx] = Math.max(0, Math.min(1, (next.vertexMask[idx] ?? 0) + sign * w));
      } else if (stroke.brush === 'draw' || stroke.brush === 'inflate') {
        const dir = stroke.brush === 'inflate' ? n : avgNormal;
        next.vertices[idx] = add3(v, scale3(dir, sign * w * stroke.radius * 0.15));
      } else if (stroke.brush === 'clay') {
        const planeProj = dot3(sub3(avgPos, v), avgNormal);
        next.vertices[idx] = add3(
          v,
          scale3(avgNormal, sign * w * (stroke.radius * 0.12 + planeProj * 0.25))
        );
      } else if (stroke.brush === 'move' && stroke.delta) {
        next.vertices[idx] = add3(v, scale3(stroke.delta, falloff * unmask));
      } else if (stroke.brush === 'pinch') {
        const toCenter = sub3(c, v);
        next.vertices[idx] = add3(v, scale3(toCenter, sign * w * 0.35));
      } else if (stroke.brush === 'flatten') {
        const signedDist = dot3(sub3(v, avgPos), avgNormal);
        next.vertices[idx] = sub3(v, scale3(avgNormal, signedDist * w * 0.7));
      } else if (stroke.brush === 'smooth' && neighbors) {
        const adj = neighbors.get(idx);
        if (adj && adj.size > 0) {
          let sum: Vec3 = [0, 0, 0];
          for (const nb of adj) sum = add3(sum, next.vertices[nb]);
          const avg = scale3(sum, 1 / adj.size);
          next.vertices[idx] = add3(v, scale3(sub3(avg, v), Math.min(0.85, w)));
        }
      }
      dirty.add(idx);
    }
  }

  return recomputeMeshNormals(next, dirty);
}

/**
 * Sculptris Pro Dynamic Tessellation (Dyntopo):
 * Splits long edges inside the brush radius and collapses micro-edges.
 */
export function applySculptrisDynamicTessellation(
  mesh: EditableMesh,
  center: Vec3,
  radius: number,
  targetEdgeLength: number
): EditableMesh {
  const next = cloneEditableMesh(mesh);
  const maxEdge = Math.max(0.05, targetEdgeLength * 1.45);
  const minEdge = Math.max(0.01, targetEdgeLength * 0.45);
  const rSq = radius * radius;

  const inRadius = (v: Vec3): boolean => {
    const dx = v[0] - center[0];
    const dy = v[1] - center[1];
    const dz = v[2] - center[2];
    return dx * dx + dy * dy + dz * dz <= rSq;
  };

  // Phase 1: Edge split subdivision on triangles inside sphere with edge > maxEdge
  const splitMap = new Map<string, number>();
  const getMidpoint = (a: number, b: number): number => {
    const k = edgeKey(a, b);
    const existing = splitMap.get(k);
    if (existing !== undefined) return existing;
    const va = next.vertices[a];
    const vb = next.vertices[b];
    const mid: Vec3 = [(va[0] + vb[0]) * 0.5, (va[1] + vb[1]) * 0.5, (va[2] + vb[2]) * 0.5];
    const idx = next.vertices.length;
    next.vertices.push(mid);
    next.normals.push(norm3(add3(next.normals[a] || [0, 1, 0], next.normals[b] || [0, 1, 0])));
    next.vertexMask.push(((next.vertexMask[a] ?? 0) + (next.vertexMask[b] ?? 0)) * 0.5);
    splitMap.set(k, idx);
    return idx;
  };

  const subdividedTris: [number, number, number][] = [];
  for (const [i0, i1, i2] of next.triangles) {
    const v0 = next.vertices[i0];
    const v1 = next.vertices[i1];
    const v2 = next.vertices[i2];
    if (!inRadius(v0) && !inRadius(v1) && !inRadius(v2)) {
      subdividedTris.push([i0, i1, i2]);
      continue;
    }
    const d01 = dist3(v0, v1);
    const d12 = dist3(v1, v2);
    const d20 = dist3(v2, v0);
    if (d01 <= maxEdge && d12 <= maxEdge && d20 <= maxEdge) {
      subdividedTris.push([i0, i1, i2]);
      continue;
    }
    // Split longest edge (or all 3 if all exceed maxEdge)
    if (d01 >= d12 && d01 >= d20) {
      const m = getMidpoint(i0, i1);
      subdividedTris.push([i0, m, i2], [m, i1, i2]);
    } else if (d12 >= d01 && d12 >= d20) {
      const m = getMidpoint(i1, i2);
      subdividedTris.push([i0, i1, m], [i0, m, i2]);
    } else {
      const m = getMidpoint(i2, i0);
      subdividedTris.push([i0, i1, m], [m, i1, i2]);
    }
  }
  next.triangles = subdividedTris;

  // Phase 2: Short-edge collapse decimation inside radius
  const remap = new Map<number, number>();
  const resolve = (idx: number): number => {
    let cur = idx;
    while (remap.has(cur)) cur = remap.get(cur)!;
    return cur;
  };

  for (const [a, b, c] of next.triangles) {
    const pairs: Array<[number, number]> = [
      [a, b],
      [b, c],
      [c, a],
    ];
    for (const [uRaw, vRaw] of pairs) {
      const u = resolve(uRaw);
      const v = resolve(vRaw);
      if (u === v) continue;
      if (!inRadius(next.vertices[u])) continue;
      if (dist3(next.vertices[u], next.vertices[v]) < minEdge) {
        const keep = Math.min(u, v);
        const drop = Math.max(u, v);
        next.vertices[keep] = scale3(add3(next.vertices[keep], next.vertices[drop]), 0.5);
        remap.set(drop, keep);
      }
    }
  }

  if (remap.size > 0) {
    next.triangles = next.triangles
      .map(([a, b, c]): [number, number, number] => [resolve(a), resolve(b), resolve(c)])
      .filter(([a, b, c]) => a !== b && b !== c && a !== c);
  }

  return recomputeMeshNormals(next);
}

// ============================================================================
// 4. WINGS3D TOPOLOGICAL SUBDIVISION & POLY MODELING OPS
// ============================================================================

export function wingsExtrudeFaces(
  mesh: EditableMesh,
  faceIndices: number[],
  distance: number
): EditableMesh {
  if (faceIndices.length === 0) return mesh;
  const next = cloneEditableMesh(mesh);
  const faceSet = new Set(faceIndices);
  const newTris: [number, number, number][] = [];

  for (let fIdx = 0; fIdx < next.triangles.length; fIdx++) {
    const [i0, i1, i2] = next.triangles[fIdx];
    if (!faceSet.has(fIdx)) {
      newTris.push([i0, i1, i2]);
      continue;
    }
    const v0 = next.vertices[i0];
    const v1 = next.vertices[i1];
    const v2 = next.vertices[i2];
    const fn = norm3(cross3(sub3(v1, v0), sub3(v2, v0)));
    const offset = scale3(fn, distance);
    const e0 = next.vertices.length;
    const e1 = e0 + 1;
    const e2 = e0 + 2;
    next.vertices.push(add3(v0, offset), add3(v1, offset), add3(v2, offset));
    next.vertexMask.push(0, 0, 0);
    // Cap + 3 side quads split into triangles
    newTris.push(
      [e0, e1, e2],
      [i0, i1, e1],
      [i0, e1, e0],
      [i1, i2, e2],
      [i1, e2, e1],
      [i2, i0, e0],
      [i2, e0, e2]
    );
  }

  next.triangles = newTris;
  return recomputeMeshNormals(next);
}

export function wingsInsetFaces(
  mesh: EditableMesh,
  faceIndices: number[],
  insetFactor = 0.25
): EditableMesh {
  if (faceIndices.length === 0) return mesh;
  const next = cloneEditableMesh(mesh);
  const faceSet = new Set(faceIndices);
  const t = Math.max(0.05, Math.min(0.85, insetFactor));
  const newTris: [number, number, number][] = [];

  for (let fIdx = 0; fIdx < next.triangles.length; fIdx++) {
    const [i0, i1, i2] = next.triangles[fIdx];
    if (!faceSet.has(fIdx)) {
      newTris.push([i0, i1, i2]);
      continue;
    }
    const v0 = next.vertices[i0];
    const v1 = next.vertices[i1];
    const v2 = next.vertices[i2];
    const cen: Vec3 = [
      (v0[0] + v1[0] + v2[0]) / 3,
      (v0[1] + v1[1] + v2[1]) / 3,
      (v0[2] + v1[2] + v2[2]) / 3,
    ];
    const lerp = (p: Vec3): Vec3 => [
      p[0] + (cen[0] - p[0]) * t,
      p[1] + (cen[1] - p[1]) * t,
      p[2] + (cen[2] - p[2]) * t,
    ];
    const n0 = next.vertices.length;
    next.vertices.push(lerp(v0), lerp(v1), lerp(v2));
    next.vertexMask.push(0, 0, 0);
    newTris.push(
      [n0, n0 + 1, n0 + 2],
      [i0, i1, n0 + 1],
      [i0, n0 + 1, n0],
      [i1, i2, n0 + 2],
      [i1, n0 + 2, n0 + 1],
      [i2, i0, n0],
      [i2, n0, n0 + 2]
    );
  }

  next.triangles = newTris;
  return recomputeMeshNormals(next);
}

export function wingsBevelFaces(
  mesh: EditableMesh,
  faceIndices: number[],
  bevelAmount = 0.8
): EditableMesh {
  const inset = wingsInsetFaces(mesh, faceIndices, 0.2);
  // Extrude the inner cap triangles (the first of every 7 generated triangles)
  const capIndices: number[] = [];
  const faceSet = new Set(faceIndices);
  let cursor = 0;
  for (let i = 0; i < mesh.triangles.length; i++) {
    if (faceSet.has(i)) {
      capIndices.push(cursor);
      cursor += 7;
    } else {
      cursor += 1;
    }
  }
  return wingsExtrudeFaces(inset, capIndices, bevelAmount);
}

export function wingsLoopCut(
  mesh: EditableMesh,
  axis: 'x' | 'y' | 'z',
  planeCoord: number
): EditableMesh {
  const next = cloneEditableMesh(mesh);
  const axIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const newTris: [number, number, number][] = [];

  const cutEdge = (a: number, b: number): number => {
    const va = next.vertices[a];
    const vb = next.vertices[b];
    const denom = vb[axIdx] - va[axIdx];
    const t = Math.abs(denom) > 1e-8 ? (planeCoord - va[axIdx]) / denom : 0.5;
    const pt: Vec3 = [
      va[0] + (vb[0] - va[0]) * t,
      va[1] + (vb[1] - va[1]) * t,
      va[2] + (vb[2] - va[2]) * t,
    ];
    const idx = next.vertices.length;
    next.vertices.push(pt);
    next.vertexMask.push(0);
    return idx;
  };

  for (const [i0, i1, i2] of next.triangles) {
    const d0 = next.vertices[i0][axIdx] - planeCoord;
    const d1 = next.vertices[i1][axIdx] - planeCoord;
    const d2 = next.vertices[i2][axIdx] - planeCoord;
    const s0 = d0 >= 0,
      s1 = d1 >= 0,
      s2 = d2 >= 0;
    if (s0 === s1 && s1 === s2) {
      newTris.push([i0, i1, i2]);
      continue;
    }
    // Single isolated vertex vs other two
    if (s0 !== s1 && s0 !== s2) {
      const m01 = cutEdge(i0, i1);
      const m02 = cutEdge(i0, i2);
      newTris.push([i0, m01, m02], [m01, i1, i2], [m01, i2, m02]);
    } else if (s1 !== s0 && s1 !== s2) {
      const m12 = cutEdge(i1, i2);
      const m10 = cutEdge(i1, i0);
      newTris.push([i1, m12, m10], [m12, i2, i0], [m12, i0, m10]);
    } else {
      const m20 = cutEdge(i2, i0);
      const m21 = cutEdge(i2, i1);
      newTris.push([i2, m20, m21], [m20, i0, i1], [m20, i1, m21]);
    }
  }

  next.triangles = newTris;
  return recomputeMeshNormals(next);
}

export function wingsIntrudeShell(mesh: EditableMesh, wallThickness = 1.5): EditableMesh {
  const next = cloneEditableMesh(mesh);
  const offset = next.vertices.length;
  for (let i = 0; i < offset; i++) {
    const v = next.vertices[i];
    const n = next.normals[i] || [0, 1, 0];
    next.vertices.push(sub3(v, scale3(n, wallThickness)));
    next.vertexMask.push(0);
  }
  const innerTris: [number, number, number][] = next.triangles.map(([a, b, c]) => [
    a + offset,
    c + offset,
    b + offset,
  ]);
  next.triangles = [...next.triangles, ...innerTris];
  return recomputeMeshNormals(next);
}

export function catmullClarkSubdivide(mesh: EditableMesh, iterations = 1): EditableMesh {
  let cur = cloneEditableMesh(mesh);
  for (let it = 0; it < iterations; it++) {
    const midCache = new Map<string, number>();
    const neighbors = new Map<number, Set<number>>();
    for (const [a, b, c] of cur.triangles) {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      if (!neighbors.has(c)) neighbors.set(c, new Set());
      neighbors.get(a)!.add(b).add(c);
      neighbors.get(b)!.add(a).add(c);
      neighbors.get(c)!.add(a).add(b);
    }

    // Loop smooth vertex repositioning
    const smoothedVerts: Vec3[] = cur.vertices.map((v, idx) => {
      const adj = neighbors.get(idx);
      if (!adj || adj.size < 3) return [v[0], v[1], v[2]];
      const n = adj.size;
      const beta = n === 3 ? 3 / 16 : 3 / (8 * n);
      let sum: Vec3 = [0, 0, 0];
      for (const nb of adj) sum = add3(sum, cur.vertices[nb]);
      return add3(scale3(v, 1 - n * beta), scale3(sum, beta));
    });

    const getMid = (a: number, b: number): number => {
      const k = edgeKey(a, b);
      const found = midCache.get(k);
      if (found !== undefined) return found;
      const va = smoothedVerts[a];
      const vb = smoothedVerts[b];
      const idx = smoothedVerts.length;
      smoothedVerts.push([(va[0] + vb[0]) * 0.5, (va[1] + vb[1]) * 0.5, (va[2] + vb[2]) * 0.5]);
      midCache.set(k, idx);
      return idx;
    };

    const nextTris: [number, number, number][] = [];
    for (const [a, b, c] of cur.triangles) {
      const ab = getMid(a, b);
      const bc = getMid(b, c);
      const ca = getMid(c, a);
      nextTris.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    cur = recomputeMeshNormals({
      ...cur,
      vertices: smoothedVerts,
      triangles: nextTris,
      vertexMask: new Array(smoothedVerts.length).fill(0),
    });
  }
  return cur;
}

// ============================================================================
// 5. AUTOMATED MESH REPAIR & WATER-TIGHTNESS DIAGNOSTICS
// ============================================================================

export function analyzeMeshHealth(mesh: EditableMesh): MeshHealthReport {
  const edgeCounts = new Map<string, number>();
  const dirEdges = new Map<string, [number, number]>();
  const referenced = new Set<number>();
  let degenerateFaces = 0;
  let signedVol = 0;
  let surfaceAreaMm2 = 0;

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const v of mesh.vertices) {
    if (v[0] < minX) minX = v[0];
    if (v[1] < minY) minY = v[1];
    if (v[2] < minZ) minZ = v[2];
    if (v[0] > maxX) maxX = v[0];
    if (v[1] > maxY) maxY = v[1];
    if (v[2] > maxZ) maxZ = v[2];
  }
  if (!Number.isFinite(minX)) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 0;
  }

  for (const [i0, i1, i2] of mesh.triangles) {
    referenced.add(i0).add(i1).add(i2);
    const v0 = mesh.vertices[i0];
    const v1 = mesh.vertices[i1];
    const v2 = mesh.vertices[i2];
    if (!v0 || !v1 || !v2 || i0 === i1 || i1 === i2 || i0 === i2) {
      degenerateFaces++;
      continue;
    }
    const c = cross3(sub3(v1, v0), sub3(v2, v0));
    const area2 = len3(c);
    if (area2 < 1e-8) degenerateFaces++;
    surfaceAreaMm2 += area2 * 0.5;
    signedVol += dot3(v0, cross3(v1, v2)) / 6;

    const pairs: Array<[number, number]> = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ];
    for (const [a, b] of pairs) {
      const k = edgeKey(a, b);
      edgeCounts.set(k, (edgeCounts.get(k) || 0) + 1);
      dirEdges.set(`${a}->${b}`, [a, b]);
    }
  }

  let nonManifoldEdges = 0;
  let openBoundaryEdges = 0;
  const boundaryNext = new Map<number, number[]>();

  for (const [k, count] of edgeCounts.entries()) {
    if (count > 2) nonManifoldEdges++;
    if (count === 1) {
      openBoundaryEdges++;
      const [aStr, bStr] = k.split('_');
      const a = Number(aStr);
      const b = Number(bStr);
      const directed = dirEdges.has(`${a}->${b}`) ? [a, b] : [b, a];
      if (!boundaryNext.has(directed[0])) boundaryNext.set(directed[0], []);
      boundaryNext.get(directed[0])!.push(directed[1]);
    }
  }

  // Count boundary loops
  let openHoleLoops = 0;
  const visitedVerts = new Set<number>();
  for (const start of boundaryNext.keys()) {
    if (visitedVerts.has(start)) continue;
    openHoleLoops++;
    let cur: number | undefined = start;
    while (cur !== undefined && !visitedVerts.has(cur)) {
      visitedVerts.add(cur);
      const nextList = boundaryNext.get(cur);
      cur = nextList?.[0];
    }
  }

  return {
    vertexCount: mesh.vertices.length,
    triangleCount: mesh.triangles.length,
    nonManifoldEdges,
    openBoundaryEdges,
    openHoleLoops,
    degenerateFaces,
    isolatedVertices: Math.max(0, mesh.vertices.length - referenced.size),
    isWatertight:
      mesh.triangles.length > 0 &&
      nonManifoldEdges === 0 &&
      openBoundaryEdges === 0 &&
      degenerateFaces === 0,
    volumeCm3: Math.abs(signedVol) / 1000,
    surfaceAreaMm2,
    boundsMin: [minX, minY, minZ],
    boundsMax: [maxX, maxY, maxZ],
    boundsDim: [maxX - minX, maxY - minY, maxZ - minZ],
  };
}

export function repairMeshAutomatically(mesh: EditableMesh, weldEpsilon = 1e-4): EditableMesh {
  // 1. Weld coincident vertices
  const scaleInv = 1 / Math.max(1e-6, weldEpsilon);
  const cellMap = new Map<string, number>();
  const oldToNew = new Array<number>(mesh.vertices.length);
  const newVerts: Vec3[] = [];
  const newMask: number[] = [];

  for (let i = 0; i < mesh.vertices.length; i++) {
    const v = mesh.vertices[i];
    const key = `${Math.round(v[0] * scaleInv)}_${Math.round(v[1] * scaleInv)}_${Math.round(
      v[2] * scaleInv
    )}`;
    const existing = cellMap.get(key);
    if (existing !== undefined) {
      oldToNew[i] = existing;
    } else {
      const idx = newVerts.length;
      cellMap.set(key, idx);
      oldToNew[i] = idx;
      newVerts.push([v[0], v[1], v[2]]);
      newMask.push(mesh.vertexMask[i] ?? 0);
    }
  }

  // 2. Purge degenerate faces
  const seenTri = new Set<string>();
  const cleanTris: [number, number, number][] = [];
  for (const [a0, b0, c0] of mesh.triangles) {
    const a = oldToNew[a0];
    const b = oldToNew[b0];
    const c = oldToNew[c0];
    if (a === undefined || b === undefined || c === undefined) continue;
    if (a === b || b === c || a === c) continue;
    const area2 = len3(cross3(sub3(newVerts[b], newVerts[a]), sub3(newVerts[c], newVerts[a])));
    if (area2 < 1e-8) continue;
    const canon = [a, b, c].sort((x, y) => x - y).join('_');
    if (seenTri.has(canon)) continue;
    seenTri.add(canon);
    cleanTris.push([a, b, c]);
  }

  // 3. Unify winding via BFS across shared edges
  const edgeToFaces = new Map<string, number[]>();
  for (let f = 0; f < cleanTris.length; f++) {
    const [a, b, c] = cleanTris[f];
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = edgeKey(u, v);
      if (!edgeToFaces.has(k)) edgeToFaces.set(k, []);
      edgeToFaces.get(k)!.push(f);
    }
  }

  const visited = new Uint8Array(cleanTris.length);
  for (let start = 0; start < cleanTris.length; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const [a, b, c] = cleanTris[cur];
      const curEdges: Array<[number, number]> = [
        [a, b],
        [b, c],
        [c, a],
      ];
      for (const [u, v] of curEdges) {
        const neighbors = edgeToFaces.get(edgeKey(u, v)) || [];
        for (const nb of neighbors) {
          if (visited[nb]) continue;
          visited[nb] = 1;
          const [na, nbV, nc] = cleanTris[nb];
          // If neighbor has the same directed edge u->v, flip its winding
          const sameDir =
            (na === u && nbV === v) || (nbV === u && nc === v) || (nc === u && na === v);
          if (sameDir) {
            cleanTris[nb] = [na, nc, nbV];
          }
          queue.push(nb);
        }
      }
    }
  }

  // Ensure positive total signed volume
  let totalSignedVol = 0;
  for (const [a, b, c] of cleanTris) {
    totalSignedVol += dot3(newVerts[a], cross3(newVerts[b], newVerts[c])) / 6;
  }
  if (totalSignedVol < 0) {
    for (let i = 0; i < cleanTris.length; i++) {
      const [a, b, c] = cleanTris[i];
      cleanTris[i] = [a, c, b];
    }
  }

  // 4. Watertight hole fill via ear-clipping / centroid fan on open boundary loops
  const dirCount = new Map<string, number>();
  for (const [a, b, c] of cleanTris) {
    dirCount.set(`${a}->${b}`, (dirCount.get(`${a}->${b}`) || 0) + 1);
    dirCount.set(`${b}->${c}`, (dirCount.get(`${b}->${c}`) || 0) + 1);
    dirCount.set(`${c}->${a}`, (dirCount.get(`${c}->${a}`) || 0) + 1);
  }
  const holeAdj = new Map<number, number>();
  for (const [a, b, c] of cleanTris) {
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      if (!dirCount.has(`${v}->${u}`)) {
        // Boundary edge u->v; hole requires opposite v->u
        holeAdj.set(v, u);
      }
    }
  }

  const filledVerts = new Set<number>();
  for (const start of holeAdj.keys()) {
    if (filledVerts.has(start)) continue;
    const loop: number[] = [];
    let cur: number | undefined = start;
    while (cur !== undefined && !filledVerts.has(cur) && loop.length < 256) {
      filledVerts.add(cur);
      loop.push(cur);
      cur = holeAdj.get(cur);
    }
    if (loop.length >= 3) {
      // Ear-clipping / fan triangulation for the boundary loop
      for (let i = 1; i + 1 < loop.length; i++) {
        cleanTris.push([loop[0], loop[i], loop[i + 1]]);
      }
    }
  }

  // 5. Prune isolated vertices
  const used = new Set<number>();
  for (const [a, b, c] of cleanTris) used.add(a).add(b).add(c);
  const compactMap = new Map<number, number>();
  const finalVerts: Vec3[] = [];
  const finalMask: number[] = [];
  for (let i = 0; i < newVerts.length; i++) {
    if (!used.has(i)) continue;
    compactMap.set(i, finalVerts.length);
    finalVerts.push(newVerts[i]);
    finalMask.push(newMask[i]);
  }
  const finalTris: [number, number, number][] = cleanTris.map(([a, b, c]) => [
    compactMap.get(a)!,
    compactMap.get(b)!,
    compactMap.get(c)!,
  ]);

  return recomputeMeshNormals({
    ...mesh,
    vertices: finalVerts,
    triangles: finalTris,
    vertexMask: finalMask,
  });
}

// ============================================================================
// 6. 3D PRINT CONVERSION, SLICER & BINARY/ASCII EXPORTERS
// ============================================================================

export function layFlatOnBuildPlate(mesh: EditableMesh): EditableMesh {
  const health = analyzeMeshHealth(mesh);
  const cx = (health.boundsMin[0] + health.boundsMax[0]) * 0.5;
  const cz = (health.boundsMin[2] + health.boundsMax[2]) * 0.5;
  const minY = health.boundsMin[1];
  return recomputeMeshNormals({
    ...mesh,
    vertices: mesh.vertices.map((v): Vec3 => [v[0] - cx, v[1] - minY, v[2] - cz]),
  });
}

export function sliceMeshFor3dPrint(
  mesh: EditableMesh,
  opts?: {
    layerHeightMm?: number;
    infillPercent?: number;
    bedWidthMm?: number;
    bedDepthMm?: number;
    bedHeightMm?: number;
    material?: 'PLA' | 'PETG' | 'ABS' | 'RESIN';
  }
): PrintSliceReport {
  const layerHeight = Math.max(0.05, Math.min(0.6, opts?.layerHeightMm ?? 0.2));
  const infill = Math.max(5, Math.min(100, opts?.infillPercent ?? 20));
  const bedW = opts?.bedWidthMm ?? 220;
  const bedD = opts?.bedDepthMm ?? 220;
  const bedH = opts?.bedHeightMm ?? 250;
  const mat = opts?.material ?? 'PLA';
  const density = mat === 'ABS' ? 1.04 : mat === 'RESIN' ? 1.12 : mat === 'PETG' ? 1.27 : 1.24;

  const health = analyzeMeshHealth(mesh);
  const fitsBuildPlate =
    health.boundsDim[0] <= bedW && health.boundsDim[2] <= bedD && health.boundsDim[1] <= bedH;

  // Detect overhangs > 45 deg facing downward (-Y)
  const overhangTriangles: number[] = [];
  for (let i = 0; i < mesh.triangles.length; i++) {
    const [a, b, c] = mesh.triangles[i];
    const fn = norm3(
      cross3(sub3(mesh.vertices[b], mesh.vertices[a]), sub3(mesh.vertices[c], mesh.vertices[a]))
    );
    if (fn[1] < -0.707) overhangTriangles.push(i);
  }

  const maxH = Math.max(layerHeight, health.boundsDim[1]);
  const layerCount = Math.max(1, Math.min(250, Math.ceil(maxH / layerHeight)));
  const layers: PrintSliceLayer[] = [];

  for (let l = 0; l < layerCount; l++) {
    const zMm = health.boundsMin[1] + (l + 0.5) * (maxH / layerCount);
    const segments: Array<[number, number, number, number]> = [];
    for (const [i0, i1, i2] of mesh.triangles) {
      const pts: Vec3[] = [mesh.vertices[i0], mesh.vertices[i1], mesh.vertices[i2]];
      const crossings: Array<[number, number]> = [];
      for (let e = 0; e < 3; e++) {
        const p1 = pts[e];
        const p2 = pts[(e + 1) % 3];
        if ((p1[1] <= zMm && p2[1] > zMm) || (p2[1] <= zMm && p1[1] > zMm)) {
          const t = (zMm - p1[1]) / (p2[1] - p1[1]);
          crossings.push([p1[0] + (p2[0] - p1[0]) * t, p1[2] + (p2[2] - p1[2]) * t]);
        }
      }
      if (crossings.length >= 2) {
        segments.push([crossings[0][0], crossings[0][1], crossings[1][0], crossings[1][1]]);
      }
    }
    layers.push({ zMm, segments });
  }

  const shellFactor = 0.25 + (infill / 100) * 0.75;
  const effectiveVol = Math.max(0.1, health.volumeCm3 * shellFactor);
  const estimatedWeightGrams = Number((effectiveVol * density).toFixed(2));
  const estimatedPrintMinutes = Math.max(
    1,
    Math.round(effectiveVol * 3.8 + layerCount * 0.35)
  );

  const gcodeLines = [
    `; Drive Therapy 3D Print Slicer (${mat}, ${layerHeight}mm, ${infill}% infill)`,
    `G21 ; millimeters`,
    `G90 ; absolute positioning`,
    mat === 'RESIN' ? `; SLA UV Exposure Layer Mode` : `M104 S${mat === 'ABS' ? 245 : mat === 'PETG' ? 235 : 205}`,
    `G28 ; home all axes`,
  ];
  for (const layer of layers.slice(0, 6)) {
    gcodeLines.push(`; LAYER Z=${layer.zMm.toFixed(2)}`);
    gcodeLines.push(`G0 Z${layer.zMm.toFixed(2)} F600`);
    for (const seg of layer.segments.slice(0, 4)) {
      gcodeLines.push(`G0 X${seg[0].toFixed(2)} Y${seg[1].toFixed(2)} F3000`);
      gcodeLines.push(`G1 X${seg[2].toFixed(2)} Y${seg[3].toFixed(2)} E0.120 F1500`);
    }
  }
  gcodeLines.push(`M84 ; disable motors`);

  return {
    fitsBuildPlate,
    overhangTriangles,
    overhangPercent:
      mesh.triangles.length > 0
        ? Number(((overhangTriangles.length / mesh.triangles.length) * 100).toFixed(1))
        : 0,
    estimatedVolumeCm3: Number(health.volumeCm3.toFixed(2)),
    estimatedWeightGrams,
    estimatedPrintMinutes,
    layerCount,
    layers,
    gcodePreview: gcodeLines.join('\n'),
  };
}

export function exportMeshToBinaryStl(mesh: EditableMesh): Uint8Array {
  const count = mesh.triangles.length;
  const buf = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buf);
  const hdr = `Drive Therapy 3D Studio Binary STL (${mesh.name})`;
  for (let i = 0; i < Math.min(80, hdr.length); i++) {
    view.setUint8(i, hdr.charCodeAt(i));
  }
  view.setUint32(80, count, true);
  let off = 84;
  for (const [i0, i1, i2] of mesh.triangles) {
    const v0 = mesh.vertices[i0];
    const v1 = mesh.vertices[i1];
    const v2 = mesh.vertices[i2];
    const fn = norm3(cross3(sub3(v1, v0), sub3(v2, v0)));
    view.setFloat32(off, fn[0], true);
    view.setFloat32(off + 4, fn[1], true);
    view.setFloat32(off + 8, fn[2], true);
    view.setFloat32(off + 12, v0[0], true);
    view.setFloat32(off + 16, v0[1], true);
    view.setFloat32(off + 20, v0[2], true);
    view.setFloat32(off + 24, v1[0], true);
    view.setFloat32(off + 28, v1[1], true);
    view.setFloat32(off + 32, v1[2], true);
    view.setFloat32(off + 36, v2[0], true);
    view.setFloat32(off + 40, v2[1], true);
    view.setFloat32(off + 44, v2[2], true);
    view.setUint16(off + 48, 0, true);
    off += 50;
  }
  return new Uint8Array(buf);
}

export function exportMeshToObj(mesh: EditableMesh, objectName = 'DriveTherapyMesh'): string {
  const lines = [`# Exported by Drive Therapy 3D Studio`, `o ${objectName}`];
  for (const v of mesh.vertices) {
    lines.push(`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`);
  }
  const hasUvs = Boolean(mesh.uvs && mesh.uvs.length > 0 && mesh.uvTriangles && mesh.uvTriangles.length === mesh.triangles.length);
  if (hasUvs && mesh.uvs) {
    for (const uv of mesh.uvs) {
      lines.push(`vt ${uv[0].toFixed(5)} ${uv[1].toFixed(5)}`);
    }
  }
  for (const n of mesh.normals) {
    lines.push(`vn ${n[0].toFixed(4)} ${n[1].toFixed(4)} ${n[2].toFixed(4)}`);
  }
  for (let i = 0; i < mesh.triangles.length; i++) {
    const [a, b, c] = mesh.triangles[i];
    if (hasUvs && mesh.uvTriangles) {
      const [ta, tb, tc] = mesh.uvTriangles[i];
      lines.push(`f ${a + 1}/${ta + 1}/${a + 1} ${b + 1}/${tb + 1}/${b + 1} ${c + 1}/${tc + 1}/${c + 1}`);
    } else {
      lines.push(`f ${a + 1}//${a + 1} ${b + 1}//${b + 1} ${c + 1}//${c + 1}`);
    }
  }
  return lines.join('\n');
}

export function exportMeshToPly(mesh: EditableMesh): string {
  const lines = [
    'ply',
    'format ascii 1.0',
    `element vertex ${mesh.vertices.length}`,
    'property float x',
    'property float y',
    'property float z',
    `element face ${mesh.triangles.length}`,
    'property list uchar int vertex_indices',
    'end_header',
  ];
  for (const v of mesh.vertices) {
    lines.push(`${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`);
  }
  for (const [a, b, c] of mesh.triangles) {
    lines.push(`3 ${a} ${b} ${c}`);
  }
  return lines.join('\n');
}

// ============================================================================
// 7. BASIC 3D FILE EDITS, MIRROR/FLIP/DECIMATE & FULL NATIVE UV TOOLS
// ============================================================================

export function applyBasicTransform(
  mesh: EditableMesh,
  opts: {
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    rotateXDeg?: number;
    rotateYDeg?: number;
    rotateZDeg?: number;
  }
): EditableMesh {
  return transformEditableMesh(
    mesh,
    [0, 0, 0],
    [opts.rotateXDeg ?? 0, opts.rotateYDeg ?? 0, opts.rotateZDeg ?? 0],
    [opts.scaleX ?? 1, opts.scaleY ?? 1, opts.scaleZ ?? 1]
  );
}

export function centerMeshAtOrigin(mesh: EditableMesh): EditableMesh {
  const health = analyzeMeshHealth(mesh);
  const cx = (health.boundsMin[0] + health.boundsMax[0]) * 0.5;
  const cy = (health.boundsMin[1] + health.boundsMax[1]) * 0.5;
  const cz = (health.boundsMin[2] + health.boundsMax[2]) * 0.5;
  return recomputeMeshNormals({
    ...cloneEditableMesh(mesh),
    vertices: mesh.vertices.map((v): Vec3 => [v[0] - cx, v[1] - cy, v[2] - cz]),
  });
}

export function mirrorMeshAxis(mesh: EditableMesh, axis: 'x' | 'y' | 'z'): EditableMesh {
  const axIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const next = cloneEditableMesh(mesh);
  next.vertices = next.vertices.map((v) => {
    const c: Vec3 = [v[0], v[1], v[2]];
    c[axIdx] = -c[axIdx];
    return c;
  });
  // Reverse triangle winding so outward normals are preserved after negative determinant mirror
  next.triangles = next.triangles.map(([a, b, c]) => [a, c, b]);
  if (next.uvTriangles && next.uvTriangles.length > 0) {
    next.uvTriangles = next.uvTriangles.map(([a, b, c]) => [a, c, b]);
  }
  return recomputeMeshNormals(next);
}

export function flipAllNormals(mesh: EditableMesh): EditableMesh {
  const next = cloneEditableMesh(mesh);
  next.triangles = next.triangles.map(([a, b, c]) => [a, c, b]);
  if (next.uvTriangles && next.uvTriangles.length > 0) {
    next.uvTriangles = next.uvTriangles.map(([a, b, c]) => [a, c, b]);
  }
  return recomputeMeshNormals(next);
}

export function convertMeshUnits(mesh: EditableMesh, toUnit: 'mm' | 'in'): EditableMesh {
  if (mesh.unit === toUnit) return mesh;
  const factor = toUnit === 'in' ? 1 / 25.4 : 25.4;
  return recomputeMeshNormals({
    ...cloneEditableMesh(mesh),
    unit: toUnit,
    vertices: mesh.vertices.map((v): Vec3 => [v[0] * factor, v[1] * factor, v[2] * factor]),
  });
}

/**
 * Spatial grid vertex-clustering decimation for reducing dense STL/OBJ scans.
 */
export function decimateMeshQuadratic(mesh: EditableMesh, targetRatio = 0.5): EditableMesh {
  const ratio = Math.max(0.1, Math.min(0.95, targetRatio));
  const health = analyzeMeshHealth(mesh);
  const maxSpan = Math.max(1e-3, health.boundsDim[0], health.boundsDim[1], health.boundsDim[2]);
  const gridCells = Math.max(4, Math.round(Math.cbrt(mesh.vertices.length * ratio)));
  const cellSize = maxSpan / gridCells;
  return repairMeshAutomatically(mesh, cellSize);
}

/**
 * Native UV Projection & Unwrapping Engine
 */
export function unwrapMeshUvs(mesh: EditableMesh, method: UvProjectionKind): EditableMesh {
  const next = cloneEditableMesh(mesh);
  const health = analyzeMeshHealth(next);
  const dx = Math.max(1e-4, health.boundsDim[0]);
  const dy = Math.max(1e-4, health.boundsDim[1]);
  const dz = Math.max(1e-4, health.boundsDim[2]);
  const cx = (health.boundsMin[0] + health.boundsMax[0]) * 0.5;
  const cy = (health.boundsMin[1] + health.boundsMax[1]) * 0.5;
  const cz = (health.boundsMin[2] + health.boundsMax[2]) * 0.5;

  const uvs: Array<[number, number]> = [];
  const uvTriangles: Array<[number, number, number]> = [];

  const projectVertex = (v: Vec3, fn: Vec3): [number, number] => {
    if (method === 'planar-xy') {
      return [(v[0] - health.boundsMin[0]) / dx, (v[1] - health.boundsMin[1]) / dy];
    }
    if (method === 'planar-xz') {
      return [(v[0] - health.boundsMin[0]) / dx, (v[2] - health.boundsMin[2]) / dz];
    }
    if (method === 'cylindrical') {
      const ang = Math.atan2(v[2] - cz, v[0] - cx);
      return [(ang + Math.PI) / (Math.PI * 2), (v[1] - health.boundsMin[1]) / dy];
    }
    if (method === 'spherical') {
      const rx = v[0] - cx;
      const ry = v[1] - cy;
      const rz = v[2] - cz;
      const r = Math.hypot(rx, ry, rz) || 1;
      const u = (Math.atan2(rz, rx) + Math.PI) / (Math.PI * 2);
      const vv = Math.acos(Math.max(-1, Math.min(1, ry / r))) / Math.PI;
      return [u, 1 - vv];
    }
    // box-triplanar dominant axis projection
    const ax = Math.abs(fn[0]);
    const ay = Math.abs(fn[1]);
    const az = Math.abs(fn[2]);
    if (ax >= ay && ax >= az) {
      return [(v[2] - health.boundsMin[2]) / dz, (v[1] - health.boundsMin[1]) / dy];
    }
    if (ay >= ax && ay >= az) {
      return [(v[0] - health.boundsMin[0]) / dx, (v[2] - health.boundsMin[2]) / dz];
    }
    return [(v[0] - health.boundsMin[0]) / dx, (v[1] - health.boundsMin[1]) / dy];
  };

  for (const [i0, i1, i2] of next.triangles) {
    const v0 = next.vertices[i0];
    const v1 = next.vertices[i1];
    const v2 = next.vertices[i2];
    const fn = norm3(cross3(sub3(v1, v0), sub3(v2, v0)));
    const base = uvs.length;
    uvs.push(projectVertex(v0, fn), projectVertex(v1, fn), projectVertex(v2, fn));
    uvTriangles.push([base, base + 1, base + 2]);
  }

  next.uvs = uvs;
  next.uvTriangles = uvTriangles;
  return next;
}

export function transformUvs(
  mesh: EditableMesh,
  opts: {
    scaleU?: number;
    scaleV?: number;
    offsetU?: number;
    offsetV?: number;
    rotateDeg?: number;
    flipV?: boolean;
  }
): EditableMesh {
  const base =
    mesh.uvs && mesh.uvs.length > 0 ? cloneEditableMesh(mesh) : unwrapMeshUvs(mesh, 'box-triplanar');
  const su = opts.scaleU ?? 1;
  const sv = opts.scaleV ?? 1;
  const ou = opts.offsetU ?? 0;
  const ov = opts.offsetV ?? 0;
  const rad = ((opts.rotateDeg ?? 0) * Math.PI) / 180;
  const cr = Math.cos(rad);
  const sr = Math.sin(rad);

  base.uvs = (base.uvs || []).map(([u, v]): [number, number] => {
    const du = (u - 0.5) * su;
    const dv = ((opts.flipV ? 1 - v : v) - 0.5) * sv;
    return [du * cr - dv * sr + 0.5 + ou, du * sr + dv * cr + 0.5 + ov];
  });
  return base;
}

/**
 * Groups UV triangles into connected islands and packs them cleanly into [0,1]x[0,1] atlas grid cells.
 */
export function packUvIslandsNormalized(mesh: EditableMesh, padding = 0.02): EditableMesh {
  const base =
    mesh.uvs && mesh.uvs.length > 0 && mesh.uvTriangles && mesh.uvTriangles.length > 0
      ? cloneEditableMesh(mesh)
      : unwrapMeshUvs(mesh, 'box-triplanar');

  const uvVerts = base.uvs || [];
  const uvTris = base.uvTriangles || [];
  if (uvVerts.length === 0 || uvTris.length === 0) return base;

  // Connected components over shared quantized UV coordinates
  const keyFor = (idx: number) => {
    const p = uvVerts[idx];
    return `${Math.round(p[0] * 1000)}_${Math.round(p[1] * 1000)}`;
  };
  const vertToTris = new Map<string, number[]>();
  for (let t = 0; t < uvTris.length; t++) {
    for (const idx of uvTris[t]) {
      const k = keyFor(idx);
      if (!vertToTris.has(k)) vertToTris.set(k, []);
      vertToTris.get(k)!.push(t);
    }
  }

  const visitedTri = new Uint8Array(uvTris.length);
  const islands: number[][] = [];
  for (let start = 0; start < uvTris.length; start++) {
    if (visitedTri[start]) continue;
    visitedTri[start] = 1;
    const queue = [start];
    const comp: number[] = [];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const idx of uvTris[cur]) {
        for (const nb of vertToTris.get(keyFor(idx)) || []) {
          if (!visitedTri[nb]) {
            visitedTri[nb] = 1;
            queue.push(nb);
          }
        }
      }
    }
    islands.push(comp);
  }

  const gridSide = Math.max(1, Math.ceil(Math.sqrt(islands.length)));
  const cellSize = 1 / gridSide;
  const inner = Math.max(0.01, cellSize - padding * 2);

  islands.forEach((triIndices, islandIdx) => {
    const vertSet = new Set<number>();
    for (const t of triIndices) {
      for (const idx of uvTris[t]) vertSet.add(idx);
    }
    let minU = Infinity,
      maxU = -Infinity,
      minV = Infinity,
      maxV = -Infinity;
    for (const idx of vertSet) {
      const [u, v] = uvVerts[idx];
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const span = Math.max(1e-4, maxU - minU, maxV - minV);
    const col = islandIdx % gridSide;
    const row = Math.floor(islandIdx / gridSide);
    const ox = col * cellSize + padding;
    const oy = row * cellSize + padding;
    for (const idx of vertSet) {
      const [u, v] = uvVerts[idx];
      uvVerts[idx] = [ox + ((u - minU) / span) * inner, oy + ((v - minV) / span) * inner];
    }
  });

  base.uvs = uvVerts;
  return base;
}

export function analyzeUvHealth(mesh: EditableMesh): UvHealthReport {
  const uvs = mesh.uvs || [];
  const uvTris = mesh.uvTriangles || [];
  if (uvs.length === 0 || uvTris.length === 0) {
    return {
      hasUvs: false,
      uvVertexCount: 0,
      uvTriangleCount: 0,
      outOfBoundsUvCount: 0,
      flippedUvTriangles: 0,
      uvIslandCount: 0,
      uvCoveragePercent: 0,
    };
  }

  let outOfBounds = 0;
  for (const [u, v] of uvs) {
    if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) outOfBounds++;
  }

  let flipped = 0;
  let totalArea = 0;
  const vertToTris = new Map<string, number[]>();
  for (let i = 0; i < uvTris.length; i++) {
    const [a, b, c] = uvTris[i];
    const p0 = uvs[a];
    const p1 = uvs[b];
    const p2 = uvs[c];
    if (p0 && p1 && p2) {
      const signedArea =
        0.5 * ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]));
      if (signedArea < -1e-7) flipped++;
      totalArea += Math.abs(signedArea);
    }
    for (const idx of [a, b, c]) {
      const p = uvs[idx];
      if (!p) continue;
      const k = `${Math.round(p[0] * 1000)}_${Math.round(p[1] * 1000)}`;
      if (!vertToTris.has(k)) vertToTris.set(k, []);
      vertToTris.get(k)!.push(i);
    }
  }

  const visited = new Uint8Array(uvTris.length);
  let islands = 0;
  for (let i = 0; i < uvTris.length; i++) {
    if (visited[i]) continue;
    islands++;
    const q = [i];
    visited[i] = 1;
    while (q.length > 0) {
      const cur = q.shift()!;
      for (const idx of uvTris[cur]) {
        const p = uvs[idx];
        if (!p) continue;
        const k = `${Math.round(p[0] * 1000)}_${Math.round(p[1] * 1000)}`;
        for (const nb of vertToTris.get(k) || []) {
          if (!visited[nb]) {
            visited[nb] = 1;
            q.push(nb);
          }
        }
      }
    }
  }

  return {
    hasUvs: true,
    uvVertexCount: uvs.length,
    uvTriangleCount: uvTris.length,
    outOfBoundsUvCount: outOfBounds,
    flippedUvTriangles: flipped,
    uvIslandCount: islands,
    uvCoveragePercent: Number(Math.min(100, totalArea * 100).toFixed(1)),
  };
}

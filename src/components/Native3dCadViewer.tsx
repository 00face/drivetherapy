/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native 3D & CAD Studio (Basic File Edits, Mesh Repair, UV Tools, 3D Print & Sculpting)
 * Harmonized with Drive Therapy Context Menus, Reference PiP, Format DB & WCAG AAA Controls.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Compass,
  Download,
  Eye,
  Grid3X3,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Database,
  Info,
  Hammer,
  Wrench,
  Printer,
  Undo2,
  Sliders,
  Tv,
  HardDrive,
  Save,
  LayoutGrid,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import { lookupFileFormat } from '../services/fileFormatEngine';
import { loadAssetContentSample } from '../services/universalFileViewerEngine';
import {
  parseBinaryOrAsciiStl,
  parseDxfCadEntities,
  parseGlbHeaderAndScene,
  parsePlyMesh,
  parseStepCadHeaderAndPoints,
  parseWavefrontObjMesh,
  type DxfCadResult,
  type GlbSceneSummary,
  type StepCadResult,
} from '../services/nativeFormatParsers';
import {
  SpatialOctree,
  analyzeMeshHealth,
  analyzeUvHealth,
  applyBasicTransform,
  applyCsgBoolean,
  applySculptBrushStroke,
  applySculptrisDynamicTessellation,
  catmullClarkSubdivide,
  centerMeshAtOrigin,
  cloneEditableMesh,
  convertMeshUnits,
  decimateMeshQuadratic,
  evaluateNurbsSurface,
  exportMeshToBinaryStl,
  exportMeshToObj,
  exportMeshToPly,
  flipAllNormals,
  generateParametricPrimitive,
  layFlatOnBuildPlate,
  mirrorMeshAxis,
  packUvIslandsNormalized,
  recomputeMeshNormals,
  repairMeshAutomatically,
  sliceMeshFor3dPrint,
  transformEditableMesh,
  transformUvs,
  unwrapMeshUvs,
  wingsExtrudeFaces,
  wingsInsetFaces,
  wingsLoopCut,
  type EditableMesh,
  type SculptBrushKind,
  type TinkerPrimitiveKind,
  type UvProjectionKind,
  type Vec3,
} from '../services/meshModelingEngine';

export interface Native3dCadViewerProps {
  asset: MediaAsset;
  compact?: boolean;
  onDownload?: (asset: MediaAsset) => void;
  onOpenFormatDb?: (query: string) => void;
  onOpenPip?: (asset: MediaAsset) => void;
  isPipActive?: boolean;
  onSaveEditedAsset?: (asset: MediaAsset, updatedText: string, saveToDisk?: boolean) => Promise<void> | void;
}

type RenderMode = 'shaded' | 'wireframe' | 'shaded-wireframe' | 'points' | 'cad-blueprint' | 'uv-checker';
type StudioTab = 'basic-edit' | 'repair' | 'uv-tools' | 'print' | 'create-sculpt' | 'inspect';
type MatCapPreset = 'clay' | 'red-wax' | 'chrome' | 'normal' | 'blueprint';

export const Native3dCadViewer: React.FC<Native3dCadViewerProps> = ({
  asset,
  compact = false,
  onDownload,
  onOpenFormatDb,
  onOpenPip,
  isPipActive = false,
  onSaveEditedAsset,
}) => {
  const fmt = useMemo(() => lookupFileFormat(asset.name, asset.mimeType), [asset.name, asset.mimeType]);
  const ext = (asset.extension || fmt.extension || '').toUpperCase();

  const [studioTab, setStudioTab] = useState<StudioTab>(compact ? 'inspect' : 'basic-edit');
  const [renderMode, setRenderMode] = useState<RenderMode>(
    ext === 'DXF' || ext === 'DWG' ? 'cad-blueprint' : 'shaded-wireframe'
  );
  const [matCap, setMatCap] = useState<MatCapPreset>('clay');
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(22);
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isOrtho, setIsOrtho] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [autoSpin, setAutoSpin] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSynthesized, setIsSynthesized] = useState(false);
  const [rawBytes, setRawBytes] = useState<Uint8Array>(new Uint8Array());
  const [textSample, setTextSample] = useState('');

  const [editedMesh, setEditedMesh] = useState<EditableMesh | null>(null);
  const [undoStack, setUndoStack] = useState<EditableMesh[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Basic Edit state
  const [uniformScalePct, setUniformScalePct] = useState(100);

  // Create & Sculpt state
  const [csgPrimitiveKind, setCsgPrimitiveKind] = useState<TinkerPrimitiveKind>('cylinder');
  const [sculptBrush, setSculptBrush] = useState<SculptBrushKind>('draw');
  const [sculptRadius, setSculptRadius] = useState(6.5);
  const [sculptStrength, setSculptStrength] = useState(0.55);
  const [dyntopoEnabled, setDyntopoEnabled] = useState(true);
  const [mirrorX, setMirrorX] = useState(false);
  const [nurbsCrown, setNurbsCrown] = useState(8);

  // 3D Print state
  const [printMaterial, setPrintMaterial] = useState<'PLA' | 'PETG' | 'ABS' | 'RESIN'>('PLA');
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [infillPct, setInfillPct] = useState(20);
  const [previewSliceIdx, setPreviewSliceIdx] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const draggingRef = useRef<{ active: boolean; pan: boolean; lastX: number; lastY: number }>({
    active: false,
    pan: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    setRenderMode(ext === 'DXF' || ext === 'DWG' ? 'cad-blueprint' : 'shaded-wireframe');
    setYaw(35);
    setPitch(22);
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setEditedMesh(null);
    setUndoStack([]);
    setUniformScalePct(100);

    let cancelled = false;
    setIsLoading(true);
    loadAssetContentSample(asset, 524288)
      .then((res) => {
        if (cancelled) return;
        setRawBytes(res.bytes);
        setTextSample(res.text);
        setIsSynthesized(res.isSynthesizedFallback);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [asset.id, ext]);

  useEffect(() => {
    if (!autoSpin) return;
    let frame = 0;
    const tick = () => {
      setYaw((y) => (y + 0.65) % 360);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoSpin]);

  const parsedScene = useMemo(() => {
    let vertices: Array<[number, number, number]> = [];
    let triangles: Array<[number, number, number]> = [];
    let edges: Array<[number, number]> = [];
    let uvs: Array<[number, number]> = [];
    let uvTriangles: Array<[number, number, number]> = [];
    let boundsDim: [number, number, number] = [2, 2, 2];
    let glbSummary: GlbSceneSummary | null = null;
    let dxfSummary: DxfCadResult | null = null;
    let stepSummary: StepCadResult | null = null;

    if (ext === 'STL') {
      const stl = parseBinaryOrAsciiStl(rawBytes, textSample);
      vertices = stl.vertices;
      triangles = stl.triangles;
      edges = stl.edges;
      boundsDim = stl.boundsDim;
    } else if (ext === 'PLY') {
      const ply = parsePlyMesh(textSample);
      vertices = ply.vertices;
      triangles = ply.triangles;
      edges = ply.edges;
      boundsDim = ply.boundsDim;
    } else if (ext === 'DXF' || ext === 'DWG') {
      dxfSummary = parseDxfCadEntities(textSample);
    } else if (ext === 'STEP' || ext === 'STP' || ext === 'IGES' || ext === 'IGS') {
      stepSummary = parseStepCadHeaderAndPoints(textSample);
      vertices = stepSummary.points;
      edges = stepSummary.edges;
    } else if (ext === 'GLB' || ext === 'GLTF') {
      glbSummary = parseGlbHeaderAndScene(rawBytes, textSample);
      const box = generateParametricPrimitive('box', { sizeMm: 20 });
      vertices = box.vertices;
      triangles = box.triangles;
    } else {
      const obj = parseWavefrontObjMesh(textSample);
      if (obj.vertices.length > 0 && obj.triangles.length > 0) {
        vertices = obj.vertices;
        triangles = obj.triangles;
        edges = obj.edges;
        uvs = obj.uvs || [];
        uvTriangles = obj.uvTriangles || [];
        boundsDim = obj.boundsDim;
      } else {
        const box = generateParametricPrimitive('box', { sizeMm: 20 });
        vertices = box.vertices;
        triangles = box.triangles;
      }
    }

    return { vertices, triangles, edges, uvs, uvTriangles, boundsDim, glbSummary, dxfSummary, stepSummary };
  }, [ext, rawBytes, textSample]);

  const activeMesh: EditableMesh = useMemo(() => {
    if (editedMesh) return editedMesh;
    if (parsedScene.vertices.length > 0 && parsedScene.triangles.length > 0) {
      return recomputeMeshNormals({
        vertices: parsedScene.vertices,
        triangles: parsedScene.triangles,
        normals: [],
        vertexMask: new Array(parsedScene.vertices.length).fill(0),
        edgeCreases: {},
        uvs: parsedScene.uvs,
        uvTriangles: parsedScene.uvTriangles,
        unit: 'mm',
        name: asset.name,
      });
    }
    return generateParametricPrimitive('box', { sizeMm: 20 });
  }, [editedMesh, parsedScene, asset.name]);

  const commitMeshEdit = (nextMesh: EditableMesh, label: string) => {
    setUndoStack((prev) => [...prev.slice(-14), cloneEditableMesh(activeMesh)]);
    setEditedMesh(nextMesh);
    setStatusBanner(label);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setEditedMesh(prev);
    setStatusBanner('Undid last 3D edit');
  };

  const meshHealth = useMemo(() => analyzeMeshHealth(activeMesh), [activeMesh]);
  const uvHealth = useMemo(() => analyzeUvHealth(activeMesh), [activeMesh]);

  const printReport = useMemo(() => {
    if (studioTab !== 'print') return null;
    return sliceMeshFor3dPrint(activeMesh, {
      layerHeightMm: layerHeight,
      infillPercent: infillPct,
      material: printMaterial,
    });
  }, [studioTab, activeMesh, layerHeight, infillPct, printMaterial]);

  const octree = useMemo(() => new SpatialOctree(activeMesh.vertices), [activeMesh.vertices]);

  // 2D UV Layout Inspector Canvas
  useEffect(() => {
    const uvCanvas = uvCanvasRef.current;
    if (!uvCanvas || studioTab !== 'uv-tools') return;
    const ctx = uvCanvas.getContext('2d');
    if (!ctx) return;

    const W = uvCanvas.width;
    const H = uvCanvas.height;
    ctx.fillStyle = '#090f1d';
    ctx.fillRect(0, 0, W, H);

    // Draw 8x8 UV tile grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const p = (i / 8) * W;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, H);
      ctx.moveTo(0, p);
      ctx.lineTo(W, p);
      ctx.stroke();
    }

    const uvs = activeMesh.uvs || [];
    const uvTris = activeMesh.uvTriangles || [];
    if (uvs.length === 0 || uvTris.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No UV coordinates yet — choose a Projection Unwrap below', W * 0.5, H * 0.5);
      return;
    }

    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    for (const [a, b, c] of uvTris.slice(0, 5000)) {
      const p0 = uvs[a];
      const p1 = uvs[b];
      const p2 = uvs[c];
      if (!p0 || !p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p0[0] * W, (1 - p0[1]) * H);
      ctx.lineTo(p1[0] * W, (1 - p1[1]) * H);
      ctx.lineTo(p2[0] * W, (1 - p2[1]) * H);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, [activeMesh, studioTab]);

  // 3D Viewport Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle =
      renderMode === 'cad-blueprint' || matCap === 'blueprint' ? '#071b34' : '#090f1d';
    ctx.fillRect(0, 0, W, H);

    if ((ext === 'DXF' || ext === 'DWG') && parsedScene.dxfSummary && !editedMesh) {
      const segs = parsedScene.dxfSummary.segments;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const s of segs) {
        minX = Math.min(minX, s.x1, s.x2);
        maxX = Math.max(maxX, s.x1, s.x2);
        minY = Math.min(minY, s.y1, s.y2);
        maxY = Math.max(maxY, s.y1, s.y2);
      }
      const span = Math.max(1e-3, maxX - minX, maxY - minY);
      const sc = (Math.min(W, H) * 0.68 * zoom) / span;
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      for (const s of segs) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5 + panX + (s.x1 - cx) * sc, H * 0.5 + panY - (s.y1 - cy) * sc);
        ctx.lineTo(W * 0.5 + panX + (s.x2 - cx) * sc, H * 0.5 + panY - (s.y2 - cy) * sc);
        ctx.stroke();
      }
      return;
    }

    const verts = activeMesh.vertices;
    const tris = activeMesh.triangles;
    if (verts.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (const [x, y, z] of verts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const normScale = 2.0 / Math.max(1e-4, maxX - minX, maxY - minY, maxZ - minZ);

    const ry = (yaw * Math.PI) / 180;
    const rx = (pitch * Math.PI) / 180;
    const cosY = Math.cos(ry),
      sinY = Math.sin(ry);
    const cosX = Math.cos(rx),
      sinX = Math.sin(rx);

    const project = (vx: number, vy: number, vz: number): [number, number, number] => {
      const nx = (vx - cx) * normScale;
      const ny = (vy - cy) * normScale;
      const nz = (vz - cz) * normScale;
      const x1 = nx * cosY - nz * sinY;
      const z1 = nx * sinY + nz * cosY;
      const y2 = ny * cosX - z1 * sinX;
      const z2 = ny * sinX + z1 * cosX;
      const baseScale = Math.min(W, H) * 0.34 * zoom;
      const factor = isOrtho ? baseScale : baseScale * (3.2 / Math.max(0.5, 3.2 + z2));
      return [W * 0.5 + panX + x1 * factor, H * 0.5 + panY - y2 * factor, z2];
    };

    if (showGrid) {
      ctx.strokeStyle =
        renderMode === 'cad-blueprint' ? 'rgba(56, 189, 248, 0.14)' : 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      for (let g = -4; g <= 4; g++) {
        const a = project(cx + g / normScale / 2, minY, cz - 2 / normScale);
        const b = project(cx + g / normScale / 2, minY, cz + 2 / normScale);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }

    const projected = verts.map(([x, y, z]) => project(x, y, z));

    if (
      tris.length > 0 &&
      (renderMode === 'shaded' ||
        renderMode === 'shaded-wireframe' ||
        renderMode === 'cad-blueprint' ||
        renderMode === 'uv-checker')
    ) {
      const overhangSet = new Set(printReport?.overhangTriangles || []);
      const uvs = activeMesh.uvs || [];
      const uvTris = activeMesh.uvTriangles || [];
      const drawList = tris
        .slice(0, 6000)
        .map(([i0, i1, i2], triIdx) => {
          const p0 = projected[i0];
          const p1 = projected[i1];
          const p2 = projected[i2];
          if (!p0 || !p1 || !p2) return null;
          const v0 = verts[i0];
          const v1 = verts[i1];
          const v2 = verts[i2];
          const ux = v1[0] - v0[0],
            uy = v1[1] - v0[1],
            uz = v1[2] - v0[2];
          const wx = v2[0] - v0[0],
            wy = v2[1] - v0[1],
            wz = v2[2] - v0[2];
          let nxf = uy * wz - uz * wy;
          let nyf = uz * wx - ux * wz;
          let nzf = ux * wy - uy * wx;
          const nLen = Math.hypot(nxf, nyf, nzf) || 1;
          nxf /= nLen;
          nyf /= nLen;
          nzf /= nLen;

          const rnx = nxf * cosY - nzf * sinY;
          const rnz = nxf * sinY + nzf * cosY;
          const rny = nyf * cosX - rnz * sinX;
          const lum = Math.max(0.18, Math.min(1, 0.3 + Math.max(0, rnx * 0.45 + rny * 0.65 - rnz * 0.45)));

          let checkerParity = false;
          if (renderMode === 'uv-checker' && uvTris[triIdx] && uvs.length > 0) {
            const [ta, tb, tc] = uvTris[triIdx];
            const ua = uvs[ta],
              ub = uvs[tb],
              uc = uvs[tc];
            if (ua && ub && uc) {
              const avgU = (ua[0] + ub[0] + uc[0]) / 3;
              const avgV = (ua[1] + ub[1] + uc[1]) / 3;
              checkerParity = (Math.floor(avgU * 8) + Math.floor(avgV * 8)) % 2 === 0;
            }
          }

          return {
            p0,
            p1,
            p2,
            zDepth: (p0[2] + p1[2] + p2[2]) / 3,
            lum,
            rnx,
            rny,
            rnz,
            checkerParity,
            overhang: studioTab === 'print' && overhangSet.has(triIdx),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.zDepth - a.zDepth);

      for (const f of drawList) {
        if (f.overhang) {
          ctx.fillStyle = `rgba(244, 63, 94, 0.9)`;
        } else if (renderMode === 'uv-checker') {
          ctx.fillStyle = f.checkerParity
            ? `rgb(${Math.round(56 * f.lum)}, ${Math.round(189 * f.lum)}, ${Math.round(248 * f.lum)})`
            : `rgb(${Math.round(226 * f.lum)}, ${Math.round(232 * f.lum)}, ${Math.round(240 * f.lum)})`;
        } else if (renderMode === 'cad-blueprint' || matCap === 'blueprint') {
          ctx.fillStyle = `rgba(14, 165, 233, ${(0.18 * f.lum).toFixed(2)})`;
        } else if (matCap === 'red-wax') {
          ctx.fillStyle = `rgb(${Math.round(215 * f.lum)}, ${Math.round(62 * f.lum)}, ${Math.round(52 * f.lum)})`;
        } else if (matCap === 'chrome') {
          const spec = Math.pow(f.lum, 3);
          ctx.fillStyle = `rgb(${Math.round(140 + 115 * spec)}, ${Math.round(155 + 100 * spec)}, ${Math.round(180 + 75 * spec)})`;
        } else if (matCap === 'normal') {
          ctx.fillStyle = `rgb(${Math.round((f.rnx * 0.5 + 0.5) * 255)}, ${Math.round((f.rny * 0.5 + 0.5) * 255)}, ${Math.round((-f.rnz * 0.5 + 0.5) * 255)})`;
        } else {
          ctx.fillStyle = `rgb(${Math.round(170 * f.lum)}, ${Math.round(185 * f.lum)}, ${Math.round(205 * f.lum)})`;
        }

        ctx.beginPath();
        ctx.moveTo(f.p0[0], f.p0[1]);
        ctx.lineTo(f.p1[0], f.p1[1]);
        ctx.lineTo(f.p2[0], f.p2[1]);
        ctx.closePath();
        ctx.fill();

        if (renderMode === 'shaded-wireframe' || renderMode === 'cad-blueprint') {
          ctx.strokeStyle =
            renderMode === 'cad-blueprint'
              ? 'rgba(56, 189, 248, 0.45)'
              : 'rgba(15, 23, 42, 0.35)';
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    } else if (renderMode === 'wireframe') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [i0, i1, i2] of tris.slice(0, 6000)) {
        const p0 = projected[i0];
        const p1 = projected[i1];
        const p2 = projected[i2];
        if (!p0 || !p1 || !p2) continue;
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.closePath();
      }
      ctx.stroke();
    } else if (renderMode === 'points') {
      ctx.fillStyle = '#34d399';
      for (const p of projected.slice(0, 6000)) {
        ctx.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3);
      }
    }

    if (studioTab === 'print' && printReport && printReport.layers[previewSliceIdx]) {
      const layer = printReport.layers[previewSliceIdx];
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const seg of layer.segments) {
        const p0 = project(seg[0], layer.zMm, seg[1]);
        const p1 = project(seg[2], layer.zMm, seg[3]);
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
      }
      ctx.stroke();
    }

    if (showAxes) {
      const ox = 46;
      const oy = H - 46;
      const drawAxis = (ax: number, ay: number, az: number, color: string, label: string) => {
        const x1 = ax * cosY - az * sinY;
        const z1 = ax * sinY + az * cosY;
        const y2 = ay * cosX - z1 * sinX;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + x1 * 24, oy - y2 * 24);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(label, ox + x1 * 30 - 3, oy - y2 * 30 + 3);
      };
      drawAxis(1, 0, 0, '#f87171', 'X');
      drawAxis(0, 1, 0, '#4ade80', 'Y');
      drawAxis(0, 0, 1, '#60a5fa', 'Z');
    }
  }, [
    activeMesh,
    editedMesh,
    ext,
    parsedScene,
    renderMode,
    matCap,
    yaw,
    pitch,
    zoom,
    panX,
    panY,
    isOrtho,
    showGrid,
    showAxes,
    studioTab,
    printReport,
    previewSliceIdx,
  ]);

  const handleDownloadBlob = (bytes: BlobPart, suffix: string, mime: string) => {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.name.replace(/\.[^/.]+$/, '')}${suffix}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleSaveObjCopy = async (saveToDisk: boolean) => {
    if (!onSaveEditedAsset) return;
    const objText = exportMeshToObj(activeMesh, asset.name.replace(/\.[^/.]+$/, ''));
    await onSaveEditedAsset(asset, objText, saveToDisk);
    setStatusBanner(saveToDisk ? 'Saved non-destructive .OBJ copy to disk' : 'Saved 3D edits to Catalog');
  };

  return (
    <div
      className={`rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl ${
        compact ? 'w-[92vw] max-w-5xl max-h-[84vh]' : 'w-full min-h-[78vh]'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold truncate">{asset.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold uppercase font-mono">
            {ext} • 3D Edit, Repair &amp; UV Studio
          </span>
          {isSynthesized && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
              Parametric Preview
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              className="min-h-[44px] px-3 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-xs font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo ({undoStack.length})</span>
            </button>
          )}
          {onOpenPip && (
            <button
              type="button"
              onClick={() => onOpenPip(asset)}
              aria-pressed={isPipActive}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isPipActive ? 'bg-teal-600 text-white' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{isPipActive ? 'PiP Pinned' : 'Pin PiP'}</span>
            </button>
          )}
          {onSaveEditedAsset && (
            <>
              <button
                type="button"
                onClick={() => void handleSaveObjCopy(false)}
                className="min-h-[44px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSaveObjCopy(true)}
                className="min-h-[44px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] text-xs font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Save .OBJ Copy</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => handleDownloadBlob(exportMeshToBinaryStl(activeMesh) as BlobPart, '_edited.stl', 'model/stl')}
            className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.STL</span>
          </button>
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(asset)}
              className="min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Original
            </button>
          )}
          {onOpenFormatDb && (
            <button
              type="button"
              onClick={() => onOpenFormatDb(ext)}
              aria-label="Inspect format specification"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Database className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div
        role="tablist"
        aria-label="3D Editor modes"
        className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center gap-1.5 text-xs"
      >
        {(
          [
            ['basic-edit', 'Basic Edit', Sliders],
            ['repair', 'Repair', Wrench],
            ['uv-tools', 'UV Tools', LayoutGrid],
            ['print', '3D Print', Printer],
            ['create-sculpt', 'Create & Sculpt', Hammer],
            ['inspect', 'Inspect', Eye],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={studioTab === id}
            type="button"
            onClick={() => setStudioTab(id)}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              studioTab === id
                ? 'bg-[#1074B1] text-white shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {statusBanner && (
        <div className="px-4 py-2 bg-emerald-950/70 border-b border-emerald-700/50 text-emerald-300 text-xs font-semibold">
          {statusBanner}
        </div>
      )}

      {/* Workspace Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* 3D Viewport */}
        <div className="lg:col-span-7 relative bg-[#090f1d] flex flex-col min-h-[340px]">
          <canvas
            ref={canvasRef}
            width={760}
            height={480}
            onPointerDown={(e) => {
              draggingRef.current = {
                active: true,
                pan: e.shiftKey || e.button === 2,
                lastX: e.clientX,
                lastY: e.clientY,
              };
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current.active) return;
              const dx = e.clientX - draggingRef.current.lastX;
              const dy = e.clientY - draggingRef.current.lastY;
              draggingRef.current.lastX = e.clientX;
              draggingRef.current.lastY = e.clientY;
              if (draggingRef.current.pan) {
                setPanX((p) => p + dx);
                setPanY((p) => p + dy);
              } else {
                setAutoSpin(false);
                setYaw((y) => y + dx * 0.65);
                setPitch((p) => Math.max(-89, Math.min(89, p + dy * 0.65)));
              }
            }}
            onPointerUp={() => {
              draggingRef.current.active = false;
            }}
            onWheel={(e) => {
              e.preventDefault();
              setZoom((z) => Math.max(0.25, Math.min(5, z - e.deltaY * 0.001)));
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full min-h-[320px] max-h-[520px] cursor-grab active:cursor-grabbing block"
          />

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-1 pointer-events-auto bg-slate-950/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800">
              {(
                [
                  ['Iso', 35, 22],
                  ['Front', 0, 0],
                  ['Top', 0, 89],
                  ['Right', 90, 0],
                ] as const
              ).map(([label, yVal, pVal]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setAutoSpin(false);
                    setYaw(yVal);
                    setPitch(pVal);
                  }}
                  className="min-h-[36px] px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsOrtho((o) => !o)}
                className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-semibold ${
                  isOrtho ? 'bg-[#1074B1] text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {isOrtho ? 'Ortho' : 'Persp'}
              </button>
              <button
                type="button"
                onClick={() => setAutoSpin((s) => !s)}
                className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 ${
                  autoSpin ? 'bg-emerald-600 text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <RotateCw className="w-3 h-3" />
                <span>Spin</span>
              </button>
            </div>

            <div className="flex items-center gap-1 pointer-events-auto bg-slate-950/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, z * 0.85))}
                aria-label="Zoom out"
                className="min-w-[36px] min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(5, z * 1.15))}
                aria-label="Zoom in"
                className="min-w-[36px] min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setYaw(35);
                  setPitch(22);
                  setZoom(1.0);
                  setPanX(0);
                  setPanY(0);
                }}
                aria-label="Reset camera"
                className="min-w-[36px] min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs font-semibold text-sky-300">
              Parsing 3D / CAD Geometry...
            </div>
          )}
        </div>

        {/* Right Context Panel */}
        <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950 p-4 overflow-y-auto space-y-4 text-xs">
          {/* Telemetry */}
          <div className="grid grid-cols-4 gap-2 font-mono tabular-nums">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">VERTS</span>
              <span className="font-bold text-white">{activeMesh.vertices.length.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">TRIS</span>
              <span className="font-bold text-sky-300">{activeMesh.triangles.length.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">UVS</span>
              <span className={`font-bold ${uvHealth.hasUvs ? 'text-emerald-300' : 'text-slate-400'}`}>
                {uvHealth.hasUvs ? uvHealth.uvIslandCount : 'NONE'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">MESH</span>
              <span className={`font-bold ${meshHealth.isWatertight ? 'text-emerald-400' : 'text-amber-300'}`}>
                {meshHealth.isWatertight ? 'SOLID' : 'OPEN'}
              </span>
            </div>
          </div>

          {/* TAB 1: BASIC EDIT */}
          {studioTab === 'basic-edit' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block">
                  Scale &amp; Units ({activeMesh.unit})
                </span>
                <label className="flex items-center justify-between font-mono text-[11px]">
                  <span>Scale: {uniformScalePct}%</span>
                  <input
                    type="range"
                    min="25"
                    max="250"
                    step="5"
                    value={uniformScalePct}
                    onChange={(e) => setUniformScalePct(Number(e.target.value))}
                    className="w-28 accent-sky-400"
                  />
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const f = uniformScalePct / 100;
                      commitMeshEdit(
                        applyBasicTransform(activeMesh, { scaleX: f, scaleY: f, scaleZ: f }),
                        `Scaled mesh by ${uniformScalePct}%`
                      );
                      setUniformScalePct(100);
                    }}
                    className="min-h-[44px] rounded-xl bg-[#1074B1] hover:bg-[#0e6499] font-bold"
                  >
                    Apply Scale
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitMeshEdit(
                        convertMeshUnits(activeMesh, activeMesh.unit === 'mm' ? 'in' : 'mm'),
                        `Converted units to ${activeMesh.unit === 'mm' ? 'inches' : 'mm'}`
                      )
                    }
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    To {activeMesh.unit === 'mm' ? 'Inches' : 'mm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(centerMeshAtOrigin(activeMesh), 'Centered mesh at (0,0,0)')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Center
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  Rotate 90°, Mirror &amp; Normals
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(applyBasicTransform(activeMesh, { rotateXDeg: 90 }), 'Rotated X +90°')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Rot X 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(applyBasicTransform(activeMesh, { rotateYDeg: 90 }), 'Rotated Y +90°')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Rot Y 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(applyBasicTransform(activeMesh, { rotateZDeg: 90 }), 'Rotated Z +90°')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Rot Z 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(mirrorMeshAxis(activeMesh, 'x'), 'Mirrored along X axis')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Mirror X
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(mirrorMeshAxis(activeMesh, 'y'), 'Mirrored along Y axis')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Mirror Y
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(flipAllNormals(activeMesh), 'Flipped face winding & normals')}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Flip Normals
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => commitMeshEdit(layFlatOnBuildPlate(activeMesh), 'Placed flat on build plate (Y=0)')}
                  className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  Drop to Bed
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commitMeshEdit(decimateMeshQuadratic(activeMesh, 0.5), 'Decimated mesh by 50%')
                  }
                  className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                >
                  Decimate 50%
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: REPAIR */}
          {studioTab === 'repair' && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5 font-mono text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-400">Non-Manifold Edges</span>
                  <span className={meshHealth.nonManifoldEdges > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {meshHealth.nonManifoldEdges}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Open Boundary Edges</span>
                  <span className={meshHealth.openBoundaryEdges > 0 ? 'text-amber-300 font-bold' : 'text-emerald-400'}>
                    {meshHealth.openBoundaryEdges} ({meshHealth.openHoleLoops} loops)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Degenerate Faces</span>
                  <span className={meshHealth.degenerateFaces > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {meshHealth.degenerateFaces}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Isolated Vertices</span>
                  <span>{meshHealth.isolatedVertices}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Volume / Area</span>
                  <span>
                    {meshHealth.volumeCm3.toFixed(2)} cm³ / {Math.round(meshHealth.surfaceAreaMm2)} mm²
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  commitMeshEdit(
                    repairMeshAutomatically(activeMesh, 1e-4),
                    'Auto-Repaired Mesh (Welded, Degenerates Purged, Normals Unified, Holes Filled)'
                  )
                }
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                Auto-Repair Watertight Mesh
              </button>
            </div>
          )}

          {/* TAB 3: UV TOOLS */}
          {studioTab === 'uv-tools' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-2 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-sky-300">2D UV Layout [0..1]</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRenderMode((m) => (m === 'uv-checker' ? 'shaded-wireframe' : 'uv-checker'))
                    }
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      renderMode === 'uv-checker' ? 'bg-[#1074B1] text-white' : 'bg-slate-800'
                    }`}
                  >
                    {renderMode === 'uv-checker' ? '3D UV Checker: ON' : '3D UV Checker'}
                  </button>
                </div>
                <canvas
                  ref={uvCanvasRef}
                  width={260}
                  height={200}
                  className="w-full h-[180px] rounded-xl border border-slate-800 block"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['box-triplanar', 'Box Unwrap'],
                    ['planar-xy', 'Planar XY'],
                    ['cylindrical', 'Cylindrical'],
                    ['spherical', 'Spherical'],
                  ] as Array<[UvProjectionKind, string]>
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      const unwrapped = unwrapMeshUvs(activeMesh, kind);
                      setRenderMode('uv-checker');
                      commitMeshEdit(unwrapped, `Unwrapped UVs (${label})`);
                    }}
                    className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => commitMeshEdit(packUvIslandsNormalized(activeMesh, 0.02), 'Packed UV islands')}
                  className="min-h-[44px] rounded-xl bg-[#1074B1] hover:bg-[#0e6499] font-bold"
                >
                  Pack Islands
                </button>
                <button
                  type="button"
                  onClick={() => commitMeshEdit(transformUvs(activeMesh, { flipV: true }), 'Flipped UV V-axis')}
                  className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                >
                  Flip V
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadBlob(exportMeshToObj(activeMesh), '_uv.obj', 'model/obj')}
                  className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  Export .OBJ
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300 flex justify-between tabular-nums">
                <span>Islands: {uvHealth.uvIslandCount}</span>
                <span>Coverage: {uvHealth.uvCoveragePercent}%</span>
                <span>OOB: {uvHealth.outOfBoundsUvCount}</span>
              </div>
            </div>
          )}

          {/* TAB 4: 3D PRINT */}
          {studioTab === 'print' && printReport && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={printMaterial}
                  onChange={(e) => setPrintMaterial(e.target.value as 'PLA' | 'PETG' | 'ABS' | 'RESIN')}
                  aria-label="3D print material"
                  className="min-h-[44px] px-2 rounded-xl bg-slate-900 border border-slate-700 font-bold"
                >
                  <option value="PLA">PLA (1.24 g/cm³)</option>
                  <option value="PETG">PETG (1.27 g/cm³)</option>
                  <option value="ABS">ABS (1.04 g/cm³)</option>
                  <option value="RESIN">SLA Resin (1.12 g/cm³)</option>
                </select>
                <button
                  type="button"
                  onClick={() => commitMeshEdit(layFlatOnBuildPlate(activeMesh), 'Centered & Laid Flat on Build Plate')}
                  className="min-h-[44px] px-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                >
                  Lay Flat
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 font-mono text-[11px] tabular-nums">
                <label className="flex justify-between items-center">
                  <span>Layer: {layerHeight}mm</span>
                  <input
                    type="range"
                    min="0.1"
                    max="0.4"
                    step="0.05"
                    value={layerHeight}
                    onChange={(e) => setLayerHeight(Number(e.target.value))}
                    className="w-24 accent-sky-400"
                  />
                </label>
                <label className="flex justify-between items-center">
                  <span>Infill: {infillPct}%</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={infillPct}
                    onChange={(e) => setInfillPct(Number(e.target.value))}
                    className="w-24 accent-sky-400"
                  />
                </label>
                <label className="flex justify-between items-center">
                  <span>
                    Slice {previewSliceIdx + 1}/{printReport.layerCount}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(0, printReport.layerCount - 1)}
                    value={previewSliceIdx}
                    onChange={(e) => setPreviewSliceIdx(Number(e.target.value))}
                    className="w-24 accent-amber-400"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">WEIGHT / TIME</span>
                  <span className="font-bold text-emerald-300">
                    {printReport.estimatedWeightGrams}g • ~{printReport.estimatedPrintMinutes}m
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">OVERHANG (&gt;45°)</span>
                  <span className={`font-bold ${printReport.overhangPercent > 15 ? 'text-rose-400' : 'text-sky-300'}`}>
                    {printReport.overhangPercent}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDownloadBlob(exportMeshToBinaryStl(activeMesh) as BlobPart, '.stl', 'model/stl')}
                  className="min-h-[44px] rounded-xl bg-[#1074B1] hover:bg-[#0e6499] font-bold"
                >
                  .STL
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadBlob(exportMeshToObj(activeMesh), '.obj', 'model/obj')}
                  className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
                >
                  .OBJ
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadBlob(printReport.gcodePreview, '.gcode', 'text/x.gcode')}
                  className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  .GCODE
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadBlob(exportMeshToPly(activeMesh), '.ply', 'application/x-ply')}
                className="w-full min-h-[40px] rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 font-semibold"
              >
                Export .PLY Point/Mesh
              </button>
            </div>
          )}

          {/* TAB 5: CREATE & SCULPT (TinkerCad CSG/NURBS + Sculptris/ZBrush + Wings3D) */}
          {studioTab === 'create-sculpt' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase text-sky-300 block">
                  TinkerCad Primitives &amp; CSG / NURBS
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['box', 'cylinder', 'sphere', 'cone', 'torus', 'wedge'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => commitMeshEdit(generateParametricPrimitive(k, { sizeMm: 22 }), `Created ${k}`)}
                      className="min-h-[36px] rounded-xl bg-slate-800 hover:bg-slate-700 capitalize font-semibold"
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <select
                    value={csgPrimitiveKind}
                    onChange={(e) => setCsgPrimitiveKind(e.target.value as TinkerPrimitiveKind)}
                    className="flex-1 min-h-[36px] px-2 rounded-lg bg-slate-950 border border-slate-700"
                  >
                    <option value="cylinder">Hole: Cylinder</option>
                    <option value="box">Hole: Box</option>
                    <option value="sphere">Hole: Sphere</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const tool = transformEditableMesh(
                        generateParametricPrimitive(csgPrimitiveKind, { sizeMm: 16 }),
                        [4, 2, 0],
                        [0, 0, 0],
                        [1, 1, 1]
                      );
                      commitMeshEdit(applyCsgBoolean(activeMesh, tool, 'subtract'), `CSG Subtract (${csgPrimitiveKind})`);
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-[#1074B1] font-bold"
                  >
                    Subtract
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const h = nurbsCrown;
                      const g: Vec3[][] = [
                        [[-10, 0, -10], [0, h * 0.4, -10], [10, 0, -10]],
                        [[-10, h * 0.4, 0], [0, h, 0], [10, h * 0.4, 0]],
                        [[-10, 0, 10], [0, h * 0.4, 10], [10, 0, 10]],
                      ];
                      commitMeshEdit(evaluateNurbsSurface(g, undefined, 2, 2, 16, 16), 'Generated NURBS patch');
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-emerald-600 font-bold"
                  >
                    NURBS
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase text-amber-300 block">
                  ZBrush/Sculptris Octree + Wings3D
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {(['draw', 'clay', 'smooth', 'inflate'] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSculptBrush(b)}
                      className={`min-h-[34px] rounded-lg capitalize font-bold ${
                        sculptBrush === b ? 'bg-amber-600 text-white' : 'bg-slate-800'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDyntopoEnabled((v) => !v)}
                    className={`flex-1 min-h-[34px] rounded-lg font-bold ${
                      dyntopoEnabled ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                  >
                    Dyntopo {dyntopoEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMirrorX((v) => !v)}
                    className={`flex-1 min-h-[34px] rounded-lg font-bold ${
                      mirrorX ? 'bg-sky-600' : 'bg-slate-800'
                    }`}
                  >
                    Mirror X
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const c = activeMesh.vertices[Math.floor(activeMesh.vertices.length / 3)] ?? ([0, 10, 0] as Vec3);
                      const { nodesVisited } = octree.querySphere(c, sculptRadius);
                      const w = dyntopoEnabled
                        ? applySculptrisDynamicTessellation(activeMesh, c, sculptRadius, 2.2)
                        : activeMesh;
                      commitMeshEdit(
                        applySculptBrushStroke(w, {
                          brush: sculptBrush,
                          center: c,
                          radius: sculptRadius,
                          strength: sculptStrength,
                          mirrorX,
                        }),
                        `Sculpted (${sculptBrush}, Octree ${nodesVisited} nodes)`
                      );
                    }}
                    className="flex-1 min-h-[34px] rounded-lg bg-amber-600 font-bold"
                  >
                    Stroke
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(wingsExtrudeFaces(activeMesh, [0], 2.5), 'Wings3D Extrude')}
                    className="min-h-[34px] rounded-lg bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Extrude
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(wingsInsetFaces(activeMesh, [0], 0.25), 'Wings3D Inset')}
                    className="min-h-[34px] rounded-lg bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    Inset
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitMeshEdit(
                        wingsLoopCut(activeMesh, 'y', (meshHealth.boundsMin[1] + meshHealth.boundsMax[1]) * 0.5),
                        'Wings3D Loop Cut'
                      )
                    }
                    className="min-h-[34px] rounded-lg bg-slate-800 hover:bg-slate-700 font-bold"
                  >
                    LoopCut
                  </button>
                  <button
                    type="button"
                    onClick={() => commitMeshEdit(catmullClarkSubdivide(activeMesh, 1), 'Catmull-Clark Smooth')}
                    className="min-h-[34px] rounded-lg bg-[#1074B1] font-bold"
                  >
                    SubD
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: INSPECT */}
          {studioTab === 'inspect' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ['shaded-wireframe', 'Shaded + Wire'],
                    ['shaded', 'Shaded Solid'],
                    ['wireframe', 'Wireframe'],
                    ['uv-checker', 'UV Checker'],
                    ['points', 'Point Cloud'],
                    ['cad-blueprint', 'CAD Blueprint'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRenderMode(id)}
                    className={`min-h-[40px] px-2.5 rounded-xl font-semibold ${
                      renderMode === id ? 'bg-[#1074B1] text-white' : 'bg-slate-900 border border-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['clay', 'red-wax', 'chrome', 'normal', 'blueprint'] as const).map((mc) => (
                  <button
                    key={mc}
                    type="button"
                    onClick={() => setMatCap(mc)}
                    className={`min-h-[36px] px-2.5 rounded-xl capitalize font-semibold ${
                      matCap === mc ? 'bg-amber-600 text-white' : 'bg-slate-900 border border-slate-800'
                    }`}
                  >
                    {mc}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGrid((g) => !g)}
                  className={`flex-1 min-h-[40px] rounded-xl font-semibold flex items-center justify-center gap-1.5 ${
                    showGrid ? 'bg-slate-800 text-sky-300' : 'bg-slate-900 border border-slate-800'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAxes((a) => !a)}
                  className={`flex-1 min-h-[40px] rounded-xl font-semibold flex items-center justify-center gap-1.5 ${
                    showAxes ? 'bg-slate-800 text-emerald-300' : 'bg-slate-900 border border-slate-800'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Axes</span>
                </button>
              </div>
            </div>
          )}

          {/* Bounds Footer */}
          <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between tabular-nums">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-sky-400" /> Bounds ({activeMesh.unit})
            </span>
            <span>
              {meshHealth.boundsDim[0].toFixed(1)} × {meshHealth.boundsDim[1].toFixed(1)} ×{' '}
              {meshHealth.boundsDim[2].toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

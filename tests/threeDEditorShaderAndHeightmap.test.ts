import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MediaAsset } from '../src/types/index.ts';
import {
  SpatialOctree,
  analyzeMeshHealth,
  applyCsgBoolean,
  applySculptBrushStroke,
  applySculptrisDynamicTessellation,
  catmullClarkSubdivide,
  evaluateNurbsSurface,
  exportMeshToBinaryStl,
  exportMeshToObj,
  exportMeshToPly,
  generateParametricPrimitive,
  layFlatOnBuildPlate,
  repairMeshAutomatically,
  sliceMeshFor3dPrint,
  transformEditableMesh,
  wingsExtrudeFaces,
  wingsInsetFaces,
  wingsLoopCut,
  type Vec3,
} from '../src/services/meshModelingEngine.ts';
import {
  SHADER_PRESETS,
  extractShaderUniforms,
  parseWebGlCompilerLog,
  wrapFragmentShaderForWebGl,
} from '../src/services/shaderEngine.ts';
import {
  applyTerrainBrush,
  computeAnalyticalHillshade,
  exportHeightmapToWatertightStl,
  extractContourSegments,
  generateProceduralDemGrid,
  parseAsciiGridDem,
  parseSrtmHgtBytes,
  sampleElevationProfile,
} from '../src/services/heightmapTerrainEngine.ts';
import { getContextMenuSpecForAsset } from '../src/services/universalFileViewerEngine.ts';

function makeAsset(name: string): MediaAsset {
  return {
    id: `t_${name}`,
    name,
    source: 'local',
    category: 'data',
    mimeType: '',
    extension: (name.split('.').pop() || '').toUpperCase(),
    path: `/tmp/${name}`,
    sizeBytes: 2048,
    modifiedTime: '2026-11-17T13:00:00.000Z',
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

describe('Native 3D Editor (TinkerCad/NURBS, Sculptris/ZBrush, Wings3D, Repair, Print), Shader Studio & Heightmap/Map Suite', () => {
  test('TinkerCad parametric primitives, CSG booleans, and Rational NURBS surface generation', () => {
    const box = generateParametricPrimitive('box', { sizeMm: 20 });
    const cyl = transformEditableMesh(
      generateParametricPrimitive('cylinder', { sizeMm: 14, segments: 12 }),
      [6, 0, 0],
      [0, 0, 0],
      [1, 1, 1]
    );
    const boxHealth = analyzeMeshHealth(box);
    assert.equal(boxHealth.isWatertight, true);
    assert.ok(boxHealth.volumeCm3 > 7.5 && boxHealth.volumeCm3 < 8.5, `Expected ~8 cm3 box, got ${boxHealth.volumeCm3}`);

    const subtracted = applyCsgBoolean(box, cyl, 'subtract');
    assert.ok(subtracted.triangles.length > 0);

    const grid: Vec3[][] = [
      [[-10, 0, -10], [0, 4, -10], [10, 0, -10]],
      [[-10, 4, 0], [0, 12, 0], [10, 4, 0]],
      [[-10, 0, 10], [0, 4, 10], [10, 0, 10]],
    ];
    const nurbs = evaluateNurbsSurface(grid, undefined, 2, 2, 10, 10);
    assert.equal(nurbs.vertices.length, 121);
    assert.equal(nurbs.triangles.length, 200);
  });

  test('ZBrush & Sculptris SpatialOctree, symmetrical brush strokes, and Dyntopo dynamic tessellation', () => {
    const sphere = generateParametricPrimitive('sphere', { sizeMm: 24, segments: 16 });
    const octree = new SpatialOctree(sphere.vertices);
    const center = sphere.vertices[0];
    const query = octree.querySphere(center, 8);
    assert.ok(query.indices.length > 0);
    assert.ok(query.nodesVisited >= 1);

    const dyntopo = applySculptrisDynamicTessellation(sphere, center, 10, 1.5);
    assert.ok(
      dyntopo.triangles.length >= sphere.triangles.length,
      'Dyntopo split should refine triangles inside brush sphere'
    );

    const sculpted = applySculptBrushStroke(dyntopo, {
      brush: 'draw',
      center,
      radius: 8,
      strength: 0.7,
      mirrorX: true,
    });
    assert.equal(sculpted.vertices.length, dyntopo.vertices.length);
  });

  test('Wings3D poly operations, Automated Mesh Repair, and 3D Print slicer & .STL/.OBJ/.PLY/.GCODE export', () => {
    const box = generateParametricPrimitive('box', { sizeMm: 20 });
    const extruded = wingsExtrudeFaces(box, [0], 4);
    assert.ok(extruded.triangles.length > box.triangles.length);

    const inset = wingsInsetFaces(box, [0], 0.3);
    assert.ok(inset.triangles.length > box.triangles.length);

    const cut = wingsLoopCut(box, 'y', 10);
    assert.ok(cut.triangles.length > box.triangles.length);

    const sub = catmullClarkSubdivide(box, 1);
    assert.equal(sub.triangles.length, box.triangles.length * 4);

    // Create intentionally open mesh by removing one face and verify auto-repair closes it
    const broken = {
      ...box,
      triangles: box.triangles.slice(1),
    };
    const brokenHealth = analyzeMeshHealth(broken);
    assert.equal(brokenHealth.isWatertight, false);
    assert.ok(brokenHealth.openBoundaryEdges > 0);

    const repaired = repairMeshAutomatically(broken);
    const repairedHealth = analyzeMeshHealth(repaired);
    assert.equal(repairedHealth.isWatertight, true);
    assert.equal(repairedHealth.openBoundaryEdges, 0);

    const flat = layFlatOnBuildPlate(repaired);
    const slice = sliceMeshFor3dPrint(flat, { layerHeightMm: 0.25, infillPercent: 25, material: 'PLA' });
    assert.equal(slice.fitsBuildPlate, true);
    assert.ok(slice.layerCount > 10);
    assert.ok(slice.gcodePreview.includes('G21'));

    const stl = exportMeshToBinaryStl(flat);
    assert.equal(stl.byteLength, 84 + flat.triangles.length * 50);
    assert.ok(exportMeshToObj(flat).includes('v '));
    assert.ok(exportMeshToPly(flat).startsWith('ply'));
  });

  test('Shader Engine uniform extraction, Shadertoy wrapper, and line-mapped compiler diagnostics', () => {
    const preset = SHADER_PRESETS[0];
    const uniforms = extractShaderUniforms(preset.fragmentSource);
    assert.ok(uniforms.some((u) => u.name === 'iTime' && u.type === 'float'));
    assert.ok(uniforms.some((u) => u.name === 'u_color1' && u.type === 'vec3'));

    const wrapped = wrapFragmentShaderForWebGl(preset.fragmentSource);
    assert.ok(wrapped.fragmentSource.includes('void main()'));

    const diags = parseWebGlCompilerLog("ERROR: 0:15: 'badVar' : undeclared identifier", 3);
    assert.equal(diags.length, 1);
    assert.equal(diags[0].line, 12);
    assert.equal(diags[0].severity, 'error');
  });

  test('Heightmap & Map Engine: SRTM .HGT, ASCII .ASC/.DEM, Horn Hillshade, Contours, Transect & .STL Plinth', () => {
    // 4x4 big-endian SRTM .HGT buffer
    const bytes = new Uint8Array(32);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 16; i++) view.setInt16(i * 2, 100 + i * 25, false);
    const hgt = parseSrtmHgtBytes(bytes, 'N37W122.hgt');
    assert.equal(hgt.width, 4);
    assert.equal(hgt.minElevation, 100);
    assert.equal(hgt.maxElevation, 475);

    const asc = parseAsciiGridDem('ncols 3\nnrows 3\ncellsize 30\n10 20 30\n40 90 50\n20 30 15');
    assert.equal(asc.width, 3);
    assert.equal(asc.maxElevation, 90);

    const dem = generateProceduralDemGrid(32);
    const shade = computeAnalyticalHillshade(dem, 315, 45);
    assert.equal(shade.length, 32 * 32);

    const contours = extractContourSegments(dem, 200);
    assert.ok(contours.length > 0);

    const profile = sampleElevationProfile(dem, 0.1, 0.1, 0.9, 0.9, 20);
    assert.equal(profile.points.length, 20);
    assert.ok(profile.totalDistanceMeters > 100);

    const raised = applyTerrainBrush(dem, 0.5, 0.5, 0.2, 250, 'raise');
    assert.ok(raised.maxElevation >= dem.maxElevation);

    const stlBytes = exportHeightmapToWatertightStl(dem);
    assert.ok(stlBytes.byteLength > 84);
  });

  test('Format Registry & Context Menu routing for 3D Editor, Shader Studio & Heightmap/Map Viewer', () => {
    const stlSpec = getContextMenuSpecForAsset(makeAsset('bracket.stl'));
    assert.equal(stlSpec.format.viewer, '3d-preview');
    assert.equal(stlSpec.editorRoute, 'cad-3d-studio');

    const glslSpec = getContextMenuSpecForAsset(makeAsset('water.frag'));
    assert.equal(glslSpec.format.viewer, 'shader-viewer');
    assert.equal(glslSpec.editorRoute, 'shader-studio');

    const hgtSpec = getContextMenuSpecForAsset(makeAsset('N37W122.hgt'));
    assert.equal(hgtSpec.format.viewer, 'heightmap-viewer');
    assert.equal(hgtSpec.editorRoute, 'heightmap-studio');
  });
});

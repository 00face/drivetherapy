import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeMeshHealth,
  analyzeUvHealth,
  applyBasicTransform,
  centerMeshAtOrigin,
  convertMeshUnits,
  decimateMeshQuadratic,
  exportMeshToObj,
  flipAllNormals,
  generateParametricPrimitive,
  mirrorMeshAxis,
  packUvIslandsNormalized,
  transformUvs,
  unwrapMeshUvs,
} from '../src/services/meshModelingEngine.ts';
import { parseWavefrontObjMesh } from '../src/services/nativeFormatParsers.ts';

describe('Basic 3D File Edits, Repairs & Native UV Tools Suite', () => {
  test('Basic 3D edits: scale, rotate 90deg, center origin, mirror axis, flip normals, unit conversion & decimation', () => {
    const box = generateParametricPrimitive('box', { sizeMm: 20 });
    const scaled = applyBasicTransform(box, { scaleX: 2, scaleY: 0.5, scaleZ: 1, rotateYDeg: 90 });
    const scaledHealth = analyzeMeshHealth(scaled);
    assert.ok(scaledHealth.boundsDim[2] > 35, 'Rotated & scaled dimension should reflect 2x span');

    const centered = centerMeshAtOrigin(box);
    const ch = analyzeMeshHealth(centered);
    assert.ok(Math.abs(ch.boundsMin[1] + ch.boundsMax[1]) < 0.01, 'Y bounds should center around 0');

    const mirrored = mirrorMeshAxis(box, 'x');
    assert.equal(analyzeMeshHealth(mirrored).isWatertight, true);

    const flipped = flipAllNormals(box);
    assert.equal(flipped.triangles[0][1], box.triangles[0][2]);

    const inches = convertMeshUnits(box, 'in');
    assert.equal(inches.unit, 'in');
    assert.ok(analyzeMeshHealth(inches).boundsDim[0] < 1.0, '20mm should be ~0.787in');

    const sphere = generateParametricPrimitive('sphere', { sizeMm: 20, segments: 24 });
    const decimated = decimateMeshQuadratic(sphere, 0.35);
    assert.ok(decimated.triangles.length < sphere.triangles.length, 'Decimation should reduce triangle count');
  });

  test('Native UV unwrapping, island packing, transforms, health analysis, and .OBJ v/vt/vn/f round-trip', () => {
    const box = generateParametricPrimitive('box', { sizeMm: 20 });
    assert.equal(analyzeUvHealth(box).hasUvs, false);

    const unwrapped = unwrapMeshUvs(box, 'box-triplanar');
    const health = analyzeUvHealth(unwrapped);
    assert.equal(health.hasUvs, true);
    assert.equal(health.uvTriangleCount, box.triangles.length);
    assert.equal(health.outOfBoundsUvCount, 0);
    assert.ok(health.uvIslandCount >= 1);

    const packed = packUvIslandsNormalized(unwrapped, 0.02);
    const packedHealth = analyzeUvHealth(packed);
    assert.equal(packedHealth.outOfBoundsUvCount, 0);

    const flippedV = transformUvs(packed, { flipV: true, scaleU: 1, scaleV: 1 });
    assert.ok(Math.abs((flippedV.uvs?.[0][1] ?? 0) - (1 - (packed.uvs?.[0][1] ?? 0))) < 1e-4);

    // Export to .OBJ with vt + vn and parse back with parseWavefrontObjMesh
    const objText = exportMeshToObj(packed, 'TestBoxUV');
    assert.ok(objText.includes('\nvt '), 'Exported OBJ must contain vt texture coordinates');
    assert.ok(objText.includes('\nvn '), 'Exported OBJ must contain vn vertex normals');

    const reparsed = parseWavefrontObjMesh(objText);
    assert.equal(reparsed.triangleCount, packed.triangles.length);
    assert.ok((reparsed.uvs?.length || 0) > 0, 'Parsed OBJ must retain vt coordinates');
    assert.equal(reparsed.uvTriangles?.length, packed.triangles.length);

    // Verify cylindrical and spherical projections work cleanly without NaN
    const cyl = unwrapMeshUvs(box, 'cylindrical');
    assert.equal(analyzeUvHealth(cyl).hasUvs, true);
    const sph = unwrapMeshUvs(box, 'spherical');
    assert.equal(analyzeUvHealth(sph).hasUvs, true);
  });
});

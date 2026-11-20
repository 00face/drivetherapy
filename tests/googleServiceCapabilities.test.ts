import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePostOAuthCapabilities,
  classifyAccountPlanLabel,
} from '../src/services/googleServiceCapabilities';
import { CPU_MINI_MODEL_CATALOG } from '../src/services/localMiniModelEngine';

describe('Google Service Capabilities & Local CPU Model Catalog', () => {
  it('resolvePostOAuthCapabilities auto-activates granted Drive/Photos scopes and marks ungranted free scopes as ready-incremental', () => {
    const caps = resolvePostOAuthCapabilities([
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/photoslibrary.readonly',
    ]);

    const drive = caps.find((c) => c.id === 'drive-api');
    const picker = caps.find((c) => c.id === 'google-picker');
    const tasks = caps.find((c) => c.id === 'google-tasks');
    const localCpu = caps.find((c) => c.id === 'local-cpu-models');
    const maps = caps.find((c) => c.id === 'google-maps-platform');

    assert.equal(drive?.status, 'active');
    assert.equal(picker?.status, 'active');
    assert.equal(tasks?.status, 'ready-incremental');
    assert.equal(localCpu?.status, 'active');
    assert.equal(maps?.status, 'billing-optional');
  });

  it('classifyAccountPlanLabel classifies Free, Google One, and Workspace/Pro quotas', () => {
    assert.equal(classifyAccountPlanLabel(15 * 1024 ** 3), 'Google Account Free (15 GB)');
    assert.equal(classifyAccountPlanLabel(100 * 1024 ** 3), 'Google One Basic (100 GB)');
    assert.equal(classifyAccountPlanLabel(2048 * 1024 ** 3), 'Google One / Workspace Standard (2 TB)');
    assert.equal(classifyAccountPlanLabel(5120 * 1024 ** 3), 'Google AI Pro / Workspace Plus (5 TB)');
  });

  it('CPU_MINI_MODEL_CATALOG provides sizes and with/without capability explanations for all models', () => {
    assert.ok(CPU_MINI_MODEL_CATALOG.length >= 6);
    for (const model of CPU_MINI_MODEL_CATALOG) {
      assert.ok(model.approxSizeMb > 0, `Expected positive size for ${model.id}`);
      assert.ok(model.withModelBenefit.length > 10, `Expected withModelBenefit for ${model.id}`);
      assert.ok(model.withoutModelFallback.length > 10, `Expected withoutModelFallback for ${model.id}`);
      assert.equal(typeof model.defaultIncluded, 'boolean');
    }
  });
});

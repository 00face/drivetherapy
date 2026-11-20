/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Intrinsic Clean-Port Discovery & Runtime Server State Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import {
  DEFAULT_CLEAN_PORT,
  SYSTEM_EXCLUDED_PORTS,
  clearRuntimeServerState,
  isPortAvailable,
  readRuntimeServerState,
  resolveCleanServerPort,
  writeRuntimeServerState,
} from '../src/services/serverPortManager';

async function occupyPort(host: string): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Expected TCP AddressInfo'));
        return;
      }
      resolve({ server, port: addr.port });
    });
  });
}

async function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

describe('Server Clean-Port Discovery & Runtime Lifecycle Suite', () => {
  it('defines default clean port 3010 clear of GlassBoy (port 3009) and legacy 3000-3008 ports', () => {
    assert.equal(DEFAULT_CLEAN_PORT, 3010);
    assert.ok(SYSTEM_EXCLUDED_PORTS.has(3009), 'Port 3009 must be in SYSTEM_EXCLUDED_PORTS for GlassBoy');
    assert.ok(SYSTEM_EXCLUDED_PORTS.has(3008), 'Port 3008 must be in SYSTEM_EXCLUDED_PORTS');
  });

  it('strictly excludes port 3009 (GlassBoy) from automatic clean-port resolution even if 3009 is free', async () => {
    const resolved = await resolveCleanServerPort({
      preferredPort: 3009,
      maxAttempts: 20,
    });
    assert.notEqual(resolved, 3009, 'Port 3009 must never be chosen automatically');
    assert.ok(resolved >= 3010, `Expected resolved port >= 3010, got ${resolved}`);
  });

  it('detects port unavailability on 127.0.0.1 and 0.0.0.0 and recovers after close', async () => {
    const boundLoopback = await occupyPort('127.0.0.1');
    try {
      assert.equal(await isPortAvailable(boundLoopback.port), false);
    } finally {
      await closeServer(boundLoopback.server);
    }
    assert.equal(await isPortAvailable(boundLoopback.port), true);

    const boundWildcard = await occupyPort('0.0.0.0');
    try {
      assert.equal(await isPortAvailable(boundWildcard.port), false);
    } finally {
      await closeServer(boundWildcard.server);
    }
    assert.equal(await isPortAvailable(boundWildcard.port), true);
  });

  it('skips occupied preferred port and resolves the next clean TCP port', async () => {
    const blocker = await occupyPort('127.0.0.1');
    try {
      const resolved = await resolveCleanServerPort({
        preferredPort: blocker.port,
        maxAttempts: 20,
      });
      assert.ok(resolved > blocker.port, `expected resolved port (${resolved}) > blocker (${blocker.port})`);
      assert.equal(await isPortAvailable(resolved), true);
    } finally {
      await closeServer(blocker.server);
    }
  });

  it('advances past recorded runtime primaryPort when forceFreshPort is enabled', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-port-test-'));
    const stateFile = path.join(tmpDir, '.runtime-server.json');

    try {
      writeRuntimeServerState(
        {
          pid: 999999,
          primaryPort: 45120,
          aliasPorts: [],
          mode: 'production',
          startedAt: '2026-11-16T12:00:00.000Z',
          url: 'http://localhost:45120',
        },
        stateFile
      );

      const loaded = readRuntimeServerState(stateFile);
      assert.ok(loaded);
      assert.equal(loaded?.primaryPort, 45120);

      const freshPort = await resolveCleanServerPort({
        preferredPort: 45120,
        forceFreshPort: true,
        maxAttempts: 20,
        stateFilePath: stateFile,
      });
      assert.ok(freshPort >= 45121, `expected fresh port >= 45121, got ${freshPort}`);

      clearRuntimeServerState(stateFile, 999999);
      assert.equal(readRuntimeServerState(stateFile), null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

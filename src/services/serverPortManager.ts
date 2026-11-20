/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Intrinsic Clean-Port Discovery, Stale Instance Reclamation & Runtime State Manager
 */

import fs from 'fs';
import net from 'net';
import path from 'path';

export const DEFAULT_CLEAN_PORT = 3010;
export const DEFAULT_RUNTIME_STATE_FILE = path.resolve(process.cwd(), '.runtime-server.json');

/**
 * System-reserved ports to strictly avoid during automatic port resolution:
 * - 3009: Dedicated/hosted by GlassBoy
 * - 3000-3008: Legacy developer and auxiliary test services
 */
export const SYSTEM_EXCLUDED_PORTS = new Set<number>([
  3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009,
]);

export interface RuntimeServerState {
  pid: number;
  primaryPort: number;
  aliasPorts: number[];
  mode: string;
  startedAt: string;
  url: string;
}

export interface ResolveCleanPortOptions {
  preferredPort?: number;
  previousPort?: number;
  forceFreshPort?: boolean;
  maxAttempts?: number;
  stateFilePath?: string;
  excludePorts?: Set<number> | number[];
  allowReservedPorts?: boolean;
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === 'EPERM';
  }
}

export function readRuntimeServerState(
  stateFilePath: string = DEFAULT_RUNTIME_STATE_FILE
): RuntimeServerState | null {
  try {
    if (!fs.existsSync(stateFilePath)) return null;
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<RuntimeServerState>;
    if (
      typeof parsed.pid !== 'number' ||
      typeof parsed.primaryPort !== 'number' ||
      !Number.isFinite(parsed.primaryPort)
    ) {
      return null;
    }
    return {
      pid: parsed.pid,
      primaryPort: parsed.primaryPort,
      aliasPorts: Array.isArray(parsed.aliasPorts)
        ? parsed.aliasPorts.filter((p): p is number => typeof p === 'number' && Number.isInteger(p))
        : [],
      mode: typeof parsed.mode === 'string' ? parsed.mode : 'development',
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
      url: typeof parsed.url === 'string' ? parsed.url : `http://127.0.0.1:${parsed.primaryPort}`,
    };
  } catch {
    return null;
  }
}

export function writeRuntimeServerState(
  state: RuntimeServerState,
  stateFilePath: string = DEFAULT_RUNTIME_STATE_FILE
): void {
  const dir = path.dirname(stateFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function clearRuntimeServerState(
  stateFilePath: string = DEFAULT_RUNTIME_STATE_FILE,
  ownerPid?: number
): void {
  try {
    if (!fs.existsSync(stateFilePath)) return;
    if (typeof ownerPid === 'number') {
      const current = readRuntimeServerState(stateFilePath);
      if (current && current.pid !== ownerPid) {
        return;
      }
    }
    fs.unlinkSync(stateFilePath);
  } catch {
    // Ignore cleanup race when multiple processes exit simultaneously
  }
}

/**
 * Reclaim any previous Drive Therapy server instance tracked in `.runtime-server.json`
 * so repeated launches never accumulate orphaned background listeners.
 */
export async function reclaimPreviousServerInstances(
  stateFilePath: string = DEFAULT_RUNTIME_STATE_FILE
): Promise<number[]> {
  const state = readRuntimeServerState(stateFilePath);
  if (!state) return [];

  const reclaimed: number[] = [];
  if (isProcessAlive(state.pid)) {
    try {
      process.kill(state.pid, 'SIGTERM');
      reclaimed.push(state.pid);
    } catch {
      return reclaimed;
    }

    const deadline = Date.now() + 600;
    while (Date.now() < deadline && isProcessAlive(state.pid)) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    if (isProcessAlive(state.pid)) {
      try {
        process.kill(state.pid, 'SIGKILL');
        await new Promise((resolve) => setTimeout(resolve, 40));
      } catch {
        // Process already exited
      }
    }
  }

  clearRuntimeServerState(stateFilePath, state.pid);
  return reclaimed;
}

function probeHostPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.unref();

    const finish = (available: boolean) => {
      try {
        tester.close(() => resolve(available));
      } catch {
        resolve(available);
      }
    };

    tester.once('error', () => {
      resolve(false);
    });

    tester.once('listening', () => {
      finish(true);
    });

    try {
      tester.listen({ port, host, exclusive: true });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Probe both wildcard (`0.0.0.0`) and loopback (`127.0.0.1`) addresses so
 * dual-stack or IPv4-only listeners cannot create partial bind collisions.
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return false;
  }
  const wildcardFree = await probeHostPort(port, '0.0.0.0');
  if (!wildcardFree) return false;
  const loopbackFree = await probeHostPort(port, '127.0.0.1');
  return loopbackFree;
}

/**
 * Resolve a guaranteed clean TCP port starting from `preferredPort` (default `3010`).
 * Skips system-excluded ports (specifically port 3009 reserved for GlassBoy, and 3000-3008).
 * When `forceFreshPort` is enabled, advances past the previously recorded runtime port.
 */
export async function resolveCleanServerPort(
  options: ResolveCleanPortOptions = {}
): Promise<number> {
  const {
    preferredPort = DEFAULT_CLEAN_PORT,
    previousPort,
    forceFreshPort = false,
    maxAttempts = 100,
    stateFilePath = DEFAULT_RUNTIME_STATE_FILE,
    excludePorts,
    allowReservedPorts = false,
  } = options;

  const excluded = new Set<number>(
    Array.isArray(excludePorts)
      ? excludePorts
      : excludePorts instanceof Set
        ? Array.from(excludePorts)
        : []
  );

  let startPort =
    Number.isInteger(preferredPort) && preferredPort > 0 && preferredPort <= 65535
      ? preferredPort
      : DEFAULT_CLEAN_PORT;

  if (forceFreshPort) {
    const recordedPort = previousPort ?? readRuntimeServerState(stateFilePath)?.primaryPort;
    if (typeof recordedPort === 'number' && Number.isInteger(recordedPort)) {
      startPort = Math.max(startPort, recordedPort + 1);
    }
  }

  for (let offset = 0; offset < maxAttempts; offset++) {
    const candidate = startPort + offset;
    if (candidate > 65535) break;

    // Respect system-reserved exclusions (port 3009 for GlassBoy, 3000-3008 for dev services)
    if (!allowReservedPorts && SYSTEM_EXCLUDED_PORTS.has(candidate)) {
      continue;
    }
    if (excluded.has(candidate)) {
      continue;
    }

    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to resolve a clean TCP port after ${maxAttempts} attempts starting at ${startPort}.`
  );
}

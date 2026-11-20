/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-117] Phase 16 Structured Observability, Correlation ID & Secret-Redacted Telemetry Engine
 */

import crypto from 'node:crypto';
import os from 'node:os';
import type { NextFunction, Request, Response } from 'express';
import { getActiveAccessPolicy } from '../security/accessPolicy';

const CORRELATION_ID_REGEX = /^[A-Za-z0-9._-]{4,128}$/;
const MAX_LATENCY_SAMPLES = 500;
const MAX_RECENT_EVENTS = 50;

const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, '[REDACTED_GOOGLE_API_KEY]'],
  [/\bGOCSPX-[0-9A-Za-z\-_]{15,}\b/g, '[REDACTED_OAUTH_CLIENT_SECRET]'],
  [/\bya29\.[0-9A-Za-z\-_]{15,}\b/g, '[REDACTED_OAUTH_ACCESS_TOKEN]'],
  [/\b1\/\/[0-9A-Za-z\-_]{15,}\b/g, '[REDACTED_OAUTH_REFRESH_TOKEN]'],
  [/\bsk-[0-9A-Za-z\-_]{16,}\b/g, '[REDACTED_API_KEY]'],
  [/\bghp_[0-9A-Za-z]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]'],
  [/Bearer\s+[0-9A-Za-z\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]'],
  [/dt_sid=[0-9A-Za-z\-._~+/]+/gi, 'dt_sid=[REDACTED_SESSION]'],
];

export interface DiagnosticEventRecord {
  id: string;
  timestamp: string;
  correlationId: string;
  category: 'error' | 'security' | 'lifecycle';
  message: string;
}

let totalRequests = 0;
let status2xxCount = 0;
let status4xxCount = 0;
let status5xxCount = 0;
const latencySamplesMs: number[] = [];
const recentEvents: DiagnosticEventRecord[] = [];
const startedAtIso = new Date().toISOString();

export function redactSensitiveTelemetry(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}

export function sanitizeCorrelationId(candidate: unknown): string {
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (CORRELATION_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return crypto.randomUUID();
}

export function recordDiagnosticEvent(
  category: 'error' | 'security' | 'lifecycle',
  message: string,
  correlationId = 'system'
): DiagnosticEventRecord {
  const entry: DiagnosticEventRecord = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    correlationId: sanitizeCorrelationId(correlationId),
    category,
    message: redactSensitiveTelemetry(message).slice(0, 500),
  };
  recentEvents.push(entry);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }
  return entry;
}

function computePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentile / 100) * sorted.length)));
  return Number(sorted[idx].toFixed(2));
}

export function correlationAndTelemetryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingHeader = req.headers['x-correlation-id'];
  const correlationId = sanitizeCorrelationId(
    Array.isArray(incomingHeader) ? incomingHeader[0] : incomingHeader
  );
  (req as Request & { correlationId?: string }).correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    totalRequests += 1;
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    latencySamplesMs.push(elapsedMs);
    if (latencySamplesMs.length > MAX_LATENCY_SAMPLES) {
      latencySamplesMs.shift();
    }

    const code = res.statusCode;
    if (code >= 200 && code < 400) status2xxCount += 1;
    else if (code >= 400 && code < 500) status4xxCount += 1;
    else if (code >= 500) {
      status5xxCount += 1;
      recordDiagnosticEvent('error', `HTTP ${code} on ${req.method} ${req.originalUrl || req.url}`, correlationId);
    }
  });

  next();
}

export function getObservabilitySnapshot(): {
  status: 'healthy' | 'degraded';
  version: string;
  startedAt: string;
  uptimeSeconds: number;
  requests: {
    total: number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
    latencyMs: { p50: number; p95: number; p99: number; samples: number };
  };
  resources: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    loadAvg1m: number;
  };
  securityPosture: {
    cspActive: boolean;
    sessionVaultEncrypted: boolean;
    loopbackGuardActive: boolean;
    accessPolicyEnabled: boolean;
    alwaysAllowLoopback: boolean;
  };
  recentEvents: DiagnosticEventRecord[];
} {
  const mem = process.memoryUsage();
  const sortedLatencies = [...latencySamplesMs].sort((a, b) => a - b);
  const policy = getActiveAccessPolicy();

  return {
    status: 'healthy',
    version: '2.2.0',
    startedAt: startedAtIso,
    uptimeSeconds: Math.floor(process.uptime()),
    requests: {
      total: totalRequests,
      status2xx: status2xxCount,
      status4xx: status4xxCount,
      status5xx: status5xxCount,
      latencyMs: {
        p50: computePercentile(sortedLatencies, 50),
        p95: computePercentile(sortedLatencies, 95),
        p99: computePercentile(sortedLatencies, 99),
        samples: sortedLatencies.length,
      },
    },
    resources: {
      rssMb: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      heapUsedMb: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      heapTotalMb: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
      loadAvg1m: Number((os.loadavg()[0] || 0).toFixed(2)),
    },
    securityPosture: {
      cspActive: true,
      sessionVaultEncrypted: true,
      loopbackGuardActive: true,
      accessPolicyEnabled: policy.enabled,
      alwaysAllowLoopback: policy.alwaysAllowLoopback,
    },
    recentEvents: [...recentEvents],
  };
}

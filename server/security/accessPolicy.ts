/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-116 / WO-117] Enterprise IP & Country Allowlisting Access Policy Engine
 * Provides Atlassian-style country-based and IP/CIDR allowlisting governance
 * with active runtime enforcement middleware and prototype-pollution guards.
 */

import express, { type NextFunction, type Request, type Response } from 'express';

export interface EnterpriseAccessPolicy {
  enabled: boolean;
  allowedIps: string[];
  allowedCountries: string[]; // ISO-3166-1 alpha-2 codes, e.g. ["US", "CA", "DE"]
  alwaysAllowLoopback: boolean;
}

let activeAccessPolicy: EnterpriseAccessPolicy = {
  enabled: false,
  allowedIps: [],
  allowedCountries: [],
  alwaysAllowLoopback: true,
};

export function getActiveAccessPolicy(): EnterpriseAccessPolicy {
  return {
    enabled: activeAccessPolicy.enabled,
    allowedIps: [...activeAccessPolicy.allowedIps],
    allowedCountries: [...activeAccessPolicy.allowedCountries],
    alwaysAllowLoopback: activeAccessPolicy.alwaysAllowLoopback,
  };
}

export function setActiveAccessPolicy(policy: EnterpriseAccessPolicy): void {
  activeAccessPolicy = {
    enabled: Boolean(policy.enabled),
    allowedIps: Array.isArray(policy.allowedIps)
      ? policy.allowedIps.map((s) => String(s).trim()).filter(Boolean)
      : [],
    allowedCountries: Array.isArray(policy.allowedCountries)
      ? policy.allowedCountries.map((s) => String(s).trim().toUpperCase()).filter(Boolean)
      : [],
    alwaysAllowLoopback: policy.alwaysAllowLoopback !== false,
  };
}

export function hasPrototypePollutionKeys(value: unknown, depth = 0): boolean {
  if (depth > 8 || !value || typeof value !== 'object') return false;
  const ownKeys = Object.getOwnPropertyNames(value);
  for (const key of ownKeys) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    const child = (value as Record<string, unknown>)[key];
    if (child && typeof child === 'object' && hasPrototypePollutionKeys(child, depth + 1)) {
      return true;
    }
  }
  return false;
}

function isLoopbackIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, '').trim();
  return clean === '127.0.0.1' || clean === '::1' || clean === 'localhost';
}

export function evaluateAccessPolicy(
  clientIp: string,
  countryCode: string | null | undefined,
  policy: EnterpriseAccessPolicy = activeAccessPolicy
): { allowed: boolean; reason?: string } {
  if (!policy || !policy.enabled) return { allowed: true };
  const safeIp = typeof clientIp === 'string' ? clientIp : '';
  if (policy.alwaysAllowLoopback && isLoopbackIp(safeIp)) return { allowed: true };

  const cleanIp = safeIp.replace(/^::ffff:/, '').trim();
  const normCountry = (typeof countryCode === 'string' ? countryCode : '').trim().toUpperCase();

  if (Array.isArray(policy.allowedIps) && policy.allowedIps.length > 0 && !policy.allowedIps.includes(cleanIp)) {
    return { allowed: false, reason: `IP ${cleanIp || 'UNKNOWN'} is not in the Enterprise IP allowlist.` };
  }

  if (Array.isArray(policy.allowedCountries) && policy.allowedCountries.length > 0) {
    const allowedSet = new Set(policy.allowedCountries.map((c) => String(c).trim().toUpperCase()));
    if (!normCountry || !allowedSet.has(normCountry)) {
      return {
        allowed: false,
        reason: `Country "${normCountry || 'UNKNOWN'}" is not permitted by Enterprise Country Allowlist.`,
      };
    }
  }

  return { allowed: true };
}

export function createAccessPolicyMiddleware(
  isLoopbackRequest: (req: Request) => boolean
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!activeAccessPolicy.enabled) {
      next();
      return;
    }
    if (activeAccessPolicy.alwaysAllowLoopback && isLoopbackRequest(req)) {
      next();
      return;
    }
    const rawIp =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]
        : '') ||
      req.ip ||
      req.socket?.remoteAddress ||
      '';
    const rawCountry =
      (typeof req.headers['cf-ipcountry'] === 'string' ? req.headers['cf-ipcountry'] : '') ||
      (typeof req.headers['x-country-code'] === 'string' ? req.headers['x-country-code'] : '');
    const verdict = evaluateAccessPolicy(rawIp, rawCountry, activeAccessPolicy);
    if (!verdict.allowed) {
      res.status(403).json({
        error: verdict.reason || 'Access denied by Enterprise Access Policy.',
        policyEnforced: true,
      });
      return;
    }
    next();
  };
}

export function createAccessPolicyRouter(
  isLoopbackRequest: (req: Request) => boolean
): express.Router {
  const router = express.Router();

  router.get('/access-policy', (_req: Request, res: Response) => {
    res.json({ policy: getActiveAccessPolicy() });
  });

  router.post('/access-policy', (req: Request, res: Response) => {
    if (!isLoopbackRequest(req)) {
      res.status(403).json({ error: 'Enterprise access policy updates are restricted to loopback requests.' });
      return;
    }
    if (hasPrototypePollutionKeys(req.body)) {
      res.status(400).json({ error: 'Invalid policy payload: prototype pollution keys are prohibited.' });
      return;
    }
    setActiveAccessPolicy({
      enabled: Boolean(req.body?.enabled),
      allowedIps: Array.isArray(req.body?.allowedIps)
        ? req.body.allowedIps.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 256)
        : activeAccessPolicy.allowedIps,
      allowedCountries: Array.isArray(req.body?.allowedCountries)
        ? req.body.allowedCountries
            .map((s: unknown) => String(s).trim().toUpperCase())
            .filter((code: string) => /^[A-Z]{2}$/.test(code))
            .slice(0, 256)
        : activeAccessPolicy.allowedCountries,
      alwaysAllowLoopback: req.body?.alwaysAllowLoopback !== false,
    });
    res.json({ success: true, policy: getActiveAccessPolicy() });
  });

  return router;
}

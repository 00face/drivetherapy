/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-116] Linux Foundation OpenSharing / Delta Sharing v1 Protocol Router
 * Vendor-neutral REST API for securely sharing AI Agent Skills, datasets, and
 * unstructured media manifests across AWS, GCP, and Azure.
 */

import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';

export interface OpenSharingShare {
  id: string;
  name: string;
  schemas: Array<{
    name: string;
    tables: Array<{
      name: string;
      kind: 'agent-skill' | 'media-manifest' | 'ai-model-card';
      description: string;
      format: string;
    }>;
  }>;
}

export interface OpenSharingProfileFile {
  shareCredentialsVersion: 1;
  endpoint: string;
  bearerToken: string;
  expirationTime: string;
}

const DEFAULT_OPENSHARING_CATALOG: OpenSharingShare[] = [
  {
    id: 'share_drivetherapy_studio',
    name: 'drivetherapy_studio',
    schemas: [
      {
        name: 'ai_assets',
        tables: [
          {
            name: 'agent_skills_registry',
            kind: 'agent-skill',
            description: 'Curated Drive Therapy AI Agent Skills & workflow definitions',
            format: 'application/json',
          },
          {
            name: 'unstructured_media_catalog',
            kind: 'media-manifest',
            description: 'Non-destructive EXIF, dHash, and multi-cloud media manifest',
            format: 'application/x-ndjson',
          },
        ],
      },
    ],
  },
];

export function buildOpenSharingProfile(baseUrl: string, ttlDays = 30): OpenSharingProfileFile {
  const token = `dt_os_${crypto.randomBytes(18).toString('hex')}`;
  return {
    shareCredentialsVersion: 1,
    endpoint: `${baseUrl.replace(/\/+$/, '')}/api/opensharing`,
    bearerToken: token,
    expirationTime: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function createOpenSharingRouter(): express.Router {
  const router = express.Router();

  router.get('/shares', (_req: Request, res: Response) => {
    res.json({
      items: DEFAULT_OPENSHARING_CATALOG.map((s) => ({ id: s.id, name: s.name })),
    });
  });

  router.get('/shares/:share/schemas', (req: Request, res: Response) => {
    const shareName = String(req.params.share || '');
    const found = DEFAULT_OPENSHARING_CATALOG.find((s) => s.name === shareName);
    if (!found) {
      res.status(404).json({ error: `OpenSharing share not found: ${shareName}` });
      return;
    }
    res.json({
      items: found.schemas.map((sc) => ({ name: sc.name, share: found.name })),
    });
  });

  router.get('/shares/:share/schemas/:schema/tables', (req: Request, res: Response) => {
    const shareName = String(req.params.share || '');
    const schemaName = String(req.params.schema || '');
    const share = DEFAULT_OPENSHARING_CATALOG.find((s) => s.name === shareName);
    const schema = share?.schemas.find((sc) => sc.name === schemaName);
    if (!share || !schema) {
      res.status(404).json({ error: 'OpenSharing schema not found.' });
      return;
    }
    res.json({
      items: schema.tables.map((tb) => ({
        name: tb.name,
        schema: schema.name,
        share: share.name,
        kind: tb.kind,
        description: tb.description,
        format: tb.format,
      })),
    });
  });

  router.post('/profile', (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const ttlDays = Math.min(365, Math.max(1, Number(req.body?.ttlDays) || 30));
    res.status(201).json({
      profile: buildOpenSharingProfile(baseUrl, ttlDays),
    });
  });

  return router;
}

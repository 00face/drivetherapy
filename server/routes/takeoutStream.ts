/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-105] Loopback-Only Streaming Google Takeout Archive Inspector
 * Inspects multi-GB local Takeout .zip archives via central directory metadata
 * without loading entire archives into browser JS heap memory.
 */

import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

export interface TakeoutArchiveEntrySummary {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  isSidecarJson: boolean;
}

/**
 * Reads the End-of-Central-Directory (EOCD) & Central Directory headers from a ZIP Buffer
 * (or tail slice) to list entries without decompressing multi-GB payloads.
 */
export function parseZipCentralDirectoryEntries(buf: Buffer, maxEntries = 500): TakeoutArchiveEntrySummary[] {
  // Locate EOCD signature 0x06054b50 scanning backwards
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return [];

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset >= buf.length) return [];

  const entries: TakeoutArchiveEntrySummary[] = [];
  let cursor = cdOffset;
  const limit = Math.min(totalEntries, maxEntries);

  for (let i = 0; i < limit && cursor + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) break;
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    if (nameStart + nameLen > buf.length) break;
    const fileName = buf.subarray(nameStart, nameStart + nameLen).toString('utf8');
    if (!fileName.endsWith('/')) {
      entries.push({
        fileName,
        compressedSize,
        uncompressedSize,
        isSidecarJson: /\.json$/i.test(fileName),
      });
    }
    cursor = nameStart + nameLen + extraLen + commentLen;
  }

  return entries;
}

export function createTakeoutStreamRouter(
  isLoopbackRequest: (req: Request) => boolean
): express.Router {
  const router = express.Router();

  router.post('/inspect-archive', (req: Request, res: Response) => {
    if (!isLoopbackRequest(req)) {
      res.status(403).json({ error: 'Takeout local archive inspection is restricted to loopback requests.' });
      return;
    }

    const archivePath = typeof req.body?.archivePath === 'string' ? req.body.archivePath.trim() : '';
    if (!archivePath || !/\.zip$/i.test(archivePath)) {
      res.status(400).json({ error: 'Provide a valid local .zip archive path.' });
      return;
    }

    const resolved = path.resolve(archivePath);
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Archive file not found on disk.' });
      return;
    }

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      res.status(400).json({ error: 'Target path is not a regular file.' });
      return;
    }

    // Read only up to the last 4 MB for Central Directory inspection (safe for multi-GB archives!)
    const maxReadBytes = Math.min(stat.size, 4 * 1024 * 1024);
    const startPos = Math.max(0, stat.size - maxReadBytes);
    const fd = fs.openSync(resolved, 'r');
    try {
      const slice = Buffer.alloc(maxReadBytes);
      fs.readSync(fd, slice, 0, maxReadBytes, startPos);
      const entries = parseZipCentralDirectoryEntries(slice, 500);
      res.json({
        success: true,
        archivePath: resolved,
        archiveSizeBytes: stat.size,
        inspectedEntries: entries.length,
        sidecarJsonCount: entries.filter((e) => e.isSidecarJson).length,
        entries,
      });
    } finally {
      fs.closeSync(fd);
    }
  });

  return router;
}

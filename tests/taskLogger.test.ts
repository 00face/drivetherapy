/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * System Diagnostics & Task Logger Unit Verification Suite
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { taskLogger, TaskLoggerService } from '../src/services/taskLogger';

describe('Diagnostic Task Logger & QA Audit Trail Suite', () => {
  beforeEach(() => {
    taskLogger.clear(true);
  });

  test('taskLogger logs entries across all standard log levels with correct schema', () => {
    taskLogger.info('indexer', 'Info message test', { key: 'val' });
    taskLogger.warn('network', 'Warning message test');
    taskLogger.error('auth', 'Error message test', { code: 401 }, new Error('Token expired'));
    taskLogger.task('task_123', 'Task starting', { step: 1 });
    taskLogger.success('indexer', 'Indexing completed successfully', { total: 370760 });
    taskLogger.debug('system', 'Debug trace');

    const logs = taskLogger.getLogs();
    assert.strictEqual(logs.length, 6);

    // Verify first entry
    assert.strictEqual(logs[0].level, 'INFO');
    assert.strictEqual(logs[0].category, 'indexer');
    assert.strictEqual(logs[0].message, 'Info message test');
    assert.deepStrictEqual(logs[0].details, { key: 'val' });

    // Verify error entry has error stack details
    assert.strictEqual(logs[2].level, 'ERROR');
    assert.strictEqual(logs[2].category, 'auth');
    assert.ok(logs[2].errorStack?.includes('Token expired'));

    // Verify task entry
    assert.strictEqual(logs[3].level, 'TASK');
    assert.strictEqual(logs[3].taskId, 'task_123');
  });

  test('Ring buffer respects capacity limits and prunes oldest entries', () => {
    // Create isolated service instance with default 2000 capacity
    const smallLogger = new TaskLoggerService();
    smallLogger.clear(true);
    for (let i = 0; i < 2050; i++) {
      smallLogger.info('system', `Message ${i}`);
    }

    const logs = smallLogger.getLogs();
    assert.strictEqual(logs.length, 2000);
    // Should have pruned first 50 entries
    assert.strictEqual(logs[0].message, 'Message 50');
    assert.strictEqual(logs[1999].message, 'Message 2049');
  });

  test('Live subscription callback receives newly appended entries in real-time', () => {
    const received: string[] = [];
    const unsubscribe = taskLogger.subscribe((entry) => {
      received.push(entry.message);
    });

    taskLogger.info('indexer', 'First streamed message');
    taskLogger.warn('network', 'Second streamed message');
    unsubscribe();

    taskLogger.info('indexer', 'Third message after unsubscribe');

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0], 'First streamed message');
    assert.strictEqual(received[1], 'Second streamed message');
  });

  test('exportJson generates valid JSON object containing exported logs array', () => {
    taskLogger.info('storage', 'Cache flushed', { items: 50 });
    taskLogger.task('sync_01', 'Sync started');

    const json = taskLogger.exportJson();
    const parsed = JSON.parse(json);

    assert.ok(Array.isArray(parsed.logs));
    assert.strictEqual(parsed.logs.length, 2);
    assert.strictEqual(parsed.logs[0].category, 'storage');
    assert.strictEqual(parsed.logs[1].taskId, 'sync_01');
    assert.strictEqual(parsed.totalEntries, 2);
  });

  test('exportText produces a structured Markdown QA report with headers', () => {
    taskLogger.info('indexer', 'Phase 1 folders cataloged: 240 folders');
    taskLogger.error('network', 'Timeout on Drive API request', { timeoutMs: 30000 });

    const report = taskLogger.exportText();

    assert.ok(report.includes('Drive Therapy Diagnostic Log Report'));
    assert.ok(report.includes('Total Log Entries: 2'));
    assert.ok(report.includes('[INFO   ] [indexer ]'));
    assert.ok(report.includes('[ERROR  ] [network ]'));
    assert.ok(report.includes('Timeout on Drive API request'));
  });

  test('getSystemSummary returns valid environment runtime properties', () => {
    const summary = taskLogger.getSystemSummary();

    assert.ok(typeof summary.timestamp === 'string');
    assert.strictEqual(summary.environment, 'node');
    assert.ok(typeof summary.nodeVersion === 'string');
  });

  test('Network abort controller aborts hung requests after timeoutMs', async () => {
    const controller = new AbortController();
    let aborted = false;
    controller.signal.addEventListener('abort', () => {
      aborted = true;
    });

    // Simulate timeout abort mechanism used in authorizedDriveFetch
    const timeoutMs = 50;
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Network request timed out'));
    }, timeoutMs);

    await new Promise((r) => setTimeout(r, 70));
    clearTimeout(timeoutId);

    assert.strictEqual(aborted, true);
    assert.strictEqual(controller.signal.aborted, true);
  });
});

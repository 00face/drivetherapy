/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Flag Notification Engine Unit Verification Suite
 * Tests the 4-status Flag Notification System:
 * - 🟣 Attention (Purple)
 * - 🟢 Complete (Green)
 * - 🟡 Busy (Yellow)
 * - 🔴 Failure (Red)
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { notificationEngine } from '../src/services/notificationEngine';

describe('Flag Notification Engine & 4-State Flag System', () => {
  beforeEach(() => {
    notificationEngine.clearAll();
  });

  test('adds notifications across all 4 flag states with valid schema', () => {
    const item1 = notificationEngine.add({
      title: 'OAuth Session Expiring',
      description: 'Please reconnect your Google Drive',
      flag: 'attention',
      category: 'auth',
    });

    const item2 = notificationEngine.add({
      title: 'Batch RAW Export',
      description: '12 images exported to 2048px sRGB',
      flag: 'complete',
      category: 'export',
    });

    const item3 = notificationEngine.add({
      title: 'Drive Deep Scan',
      description: 'Indexing recursive file trees...',
      flag: 'busy',
      category: 'sync',
    });

    const item4 = notificationEngine.add({
      title: 'R2 Network Timeout',
      description: 'Failed to upload preview',
      flag: 'failure',
      category: 'storage',
    });

    const all = notificationEngine.getAll();
    assert.strictEqual(all.length, 4);

    // Verify ordering: newest first
    assert.strictEqual(all[0].id, item4.id);
    assert.strictEqual(all[0].flag, 'failure');
    assert.strictEqual(all[1].flag, 'busy');
    assert.strictEqual(all[2].flag, 'complete');
    assert.strictEqual(all[3].flag, 'attention');

    // Verify schema
    assert.strictEqual(item1.read, false);
    assert.ok(item1.timeString.match(/^\d{2}:\d{2}$/));
    assert.ok(item1.timestamp > 0);
  });

  test('tracks unread counts and marks individual or all notifications as read', () => {
    const n1 = notificationEngine.add({ title: 'Task A', flag: 'complete' });
    const n2 = notificationEngine.add({ title: 'Task B', flag: 'busy' });
    const n3 = notificationEngine.add({ title: 'Task C', flag: 'attention' });

    assert.strictEqual(notificationEngine.getUnreadCount(), 3);

    // Mark individual as read
    notificationEngine.markAsRead(n2.id);
    assert.strictEqual(notificationEngine.getUnreadCount(), 2);
    assert.strictEqual(notificationEngine.getAll().find((n) => n.id === n2.id)?.read, true);

    // Mark all as read
    notificationEngine.markAllAsRead();
    assert.strictEqual(notificationEngine.getUnreadCount(), 0);
    assert.ok(notificationEngine.getAll().every((n) => n.read));
  });

  test('calculates highest priority flag according to status severity', () => {
    // 1. Initially empty
    assert.strictEqual(notificationEngine.getHighestPriorityFlag(), null);

    // 2. Add complete -> priority is complete
    notificationEngine.add({ title: 'Success', flag: 'complete' });
    assert.strictEqual(notificationEngine.getHighestPriorityFlag(), 'complete');

    // 3. Add busy -> priority escalates to busy
    notificationEngine.add({ title: 'Active Scan', flag: 'busy' });
    assert.strictEqual(notificationEngine.getHighestPriorityFlag(), 'busy');

    // 4. Add attention -> priority escalates to attention
    notificationEngine.add({ title: 'Review Needed', flag: 'attention' });
    assert.strictEqual(notificationEngine.getHighestPriorityFlag(), 'attention');

    // 5. Add failure -> priority escalates to failure
    notificationEngine.add({ title: 'Drive Error', flag: 'failure' });
    assert.strictEqual(notificationEngine.getHighestPriorityFlag(), 'failure');
  });

  test('updates flag and status dynamically (e.g. busy -> complete/failure)', () => {
    const activeJob = notificationEngine.add({
      title: 'Folder Indexing',
      description: 'Reading files...',
      flag: 'busy',
    });

    assert.strictEqual(notificationEngine.getActiveBusyCount(), 1);

    // Transition to complete
    notificationEngine.updateFlag(
      activeJob.id,
      'complete',
      'Folder Indexing Complete',
      '142 items indexed'
    );

    const updated = notificationEngine.getAll().find((n) => n.id === activeJob.id);
    assert.strictEqual(updated?.flag, 'complete');
    assert.strictEqual(updated?.title, 'Folder Indexing Complete');
    assert.strictEqual(updated?.description, '142 items indexed');
    assert.strictEqual(notificationEngine.getActiveBusyCount(), 0);
  });

  test('clears completed items while retaining pending or active items', () => {
    notificationEngine.add({ title: 'T1', flag: 'complete' });
    notificationEngine.add({ title: 'T2', flag: 'busy' });
    notificationEngine.add({ title: 'T3', flag: 'complete' });
    notificationEngine.add({ title: 'T4', flag: 'failure' });

    assert.strictEqual(notificationEngine.getAll().length, 4);

    notificationEngine.clearCompleted();
    const remaining = notificationEngine.getAll();
    assert.strictEqual(remaining.length, 2);
    assert.ok(!remaining.some((n) => n.flag === 'complete'));
    assert.ok(remaining.some((n) => n.flag === 'busy'));
    assert.ok(remaining.some((n) => n.flag === 'failure'));
  });

  test('publishes change notifications to registered subscribers', () => {
    let callCount = 0;
    const unsubscribe = notificationEngine.subscribe(() => {
      callCount++;
    });

    notificationEngine.add({ title: 'Event 1', flag: 'attention' });
    notificationEngine.add({ title: 'Event 2', flag: 'complete' });
    notificationEngine.markAllAsRead();

    assert.ok(callCount >= 3);
    unsubscribe();

    notificationEngine.add({ title: 'Event 3', flag: 'busy' });
    assert.strictEqual(callCount, 3); // No more calls after unsubscribe
  });
});

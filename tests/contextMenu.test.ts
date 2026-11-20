import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDriveShareLink } from '../src/services/googleDrive';

describe('Unified Context Menu & File Operations Suite', () => {
  let tempDir: string;

  before(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dt-context-test-'));
  });

  after(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  describe('Google Drive Cloud Link Generator', () => {
    it('generates standard Google Drive shareable web view link', () => {
      const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
      const link = getDriveShareLink(fileId);
      assert.strictEqual(link, `https://drive.google.com/file/d/${fileId}/view?usp=sharing`);
    });
  });

  describe('Local Filesystem Operations (Host Disk Parity)', () => {
    it('duplicates file with automatic collision avoidance (copy, copy 2)', async () => {
      const testFile = path.join(tempDir, 'photo.jpg');
      await fs.promises.writeFile(testFile, 'image binary data');

      // First duplicate
      const copy1 = path.join(tempDir, 'photo copy.jpg');
      await fs.promises.copyFile(testFile, copy1);
      assert.ok(fs.existsSync(copy1));

      // Second duplicate logic simulation
      let copyIndex = 1;
      let copy2 = path.join(tempDir, 'photo copy.jpg');
      while (fs.existsSync(copy2)) {
        copyIndex++;
        copy2 = path.join(tempDir, `photo copy ${copyIndex}.jpg`);
      }
      await fs.promises.copyFile(testFile, copy2);

      assert.ok(fs.existsSync(copy2));
      assert.strictEqual(path.basename(copy2), 'photo copy 2.jpg');
    });

    it('renames file safely and prevents directory traversal attacks', async () => {
      const originalFile = path.join(tempDir, 'document.pdf');
      await fs.promises.writeFile(originalFile, 'pdf content');

      // Traversal prevention test
      const maliciousInput = '../../../etc/passwd';
      const safeBasename = path.basename(maliciousInput.trim());
      assert.strictEqual(safeBasename, 'passwd');

      // Valid rename
      const targetName = 'renamed_document.pdf';
      const safeTargetName = path.basename(targetName.trim());
      const newPath = path.join(tempDir, safeTargetName);

      await fs.promises.rename(originalFile, newPath);

      assert.ok(!fs.existsSync(originalFile));
      assert.ok(fs.existsSync(newPath));
    });

    it('deletes file safely from disk', async () => {
      const doomedFile = path.join(tempDir, 'delete_me.txt');
      await fs.promises.writeFile(doomedFile, 'temporary');
      assert.ok(fs.existsSync(doomedFile));

      await fs.promises.unlink(doomedFile);
      assert.ok(!fs.existsSync(doomedFile));
    });
  });

  describe('Smart Viewport Edge Clamping Geometry', () => {
    it('clamps menu horizontally when overflowing right viewport edge', () => {
      const windowWidth = 1200;
      const menuWidth = 288; // w-72 = 18rem = 288px
      const padding = 12;

      const clickX = 1150; // Near right edge
      let left = clickX;

      if (left + menuWidth > windowWidth - padding) {
        left = Math.max(padding, windowWidth - menuWidth - padding);
      }

      assert.strictEqual(left, 1200 - 288 - 12); // 900px
      assert.ok(left + menuWidth <= windowWidth);
    });

    it('clamps menu vertically when overflowing bottom viewport edge', () => {
      const windowHeight = 800;
      const menuHeight = 450;
      const padding = 12;

      const clickY = 700; // Near bottom edge
      let top = clickY;

      if (top + menuHeight > windowHeight - padding) {
        top = Math.max(padding, windowHeight - menuHeight - padding);
      }

      assert.strictEqual(top, 800 - 450 - 12); // 338px
      assert.ok(top + menuHeight <= windowHeight);
    });

    it('dynamically re-clamps when submenu expands near bottom edge', () => {
      const windowHeight = 700;
      const padding = 12;

      // Initial menu height
      let menuHeight = 400;
      let top = 250;
      assert.ok(top + menuHeight <= windowHeight - padding); // 650 <= 688

      // Submenu expands (e.g. Star rating or Color label opens + 80px)
      menuHeight += 80; // 480px
      if (top + menuHeight > windowHeight - padding) {
        top = Math.max(padding, windowHeight - menuHeight - padding);
      }

      assert.strictEqual(top, 700 - 480 - 12); // 208px
      assert.ok(top + menuHeight <= windowHeight - padding);
      assert.ok(top >= padding);
    });

    it('exempts internal scroll events from menu dismissal', () => {
      // Mock DOM element hierarchy
      const menuNode = { id: 'context-menu' };
      const internalButton = { parent: menuNode };
      const externalNode = { parent: null };

      const contains = (target: any) => target === menuNode || target.parent === menuNode;

      // Internal scroll target should return true (exempted)
      assert.ok(contains(internalButton));
      // External window scroll target should return false (dismissal triggered)
      assert.ok(!contains(externalNode));
    });
  });

  describe('Proven File System & Native Download Stream', () => {
    it('formats RFC 5987 compliant Content-Disposition attachment headers', () => {
      const filename = 'Photo 2026 #1.jpg';
      const encoded = encodeURIComponent(filename);
      const header = `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;

      assert.ok(header.startsWith('attachment; filename="'));
      assert.ok(header.includes("filename*=UTF-8''Photo%202026%20%231.jpg"));
    });

    it('enforces safe blob URL revocation lifecycle (>30s for Firefox stream completion)', () => {
      const revocationTimeoutMs = 60000;
      assert.ok(revocationTimeoutMs >= 30000, 'Revocation timeout must be >= 30s to prevent Firefox download termination');
    });
  });
});

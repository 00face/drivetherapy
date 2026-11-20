import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  cleanDriveFileId,
  getDriveShareLink,
} from '../src/services/googleDrive';

describe('Google Drive ID Sanitization & Command Resolution Suite', () => {
  const sampleRawId = '1SwKrUvj_RfldM_kr9jvSxL8oPzMtblwFZK9UFNWTy1U';
  const samplePrefixedId = `drive_${sampleRawId}`;

  describe('cleanDriveFileId Normalizer', () => {
    it('strips drive_ prefix from catalog asset IDs', () => {
      const result = cleanDriveFileId(samplePrefixedId);
      assert.strictEqual(result, sampleRawId);
    });

    it('retains valid raw Google Drive IDs without modification', () => {
      const result = cleanDriveFileId(sampleRawId);
      assert.strictEqual(result, sampleRawId);
    });

    it('trims extraneous surrounding whitespace while removing prefix', () => {
      const result = cleanDriveFileId(`   ${samplePrefixedId}   `);
      assert.strictEqual(result, sampleRawId);
    });

    it('returns empty string for null, undefined, or empty ID', () => {
      assert.strictEqual(cleanDriveFileId(''), '');
      assert.strictEqual(cleanDriveFileId(undefined as any), '');
      assert.strictEqual(cleanDriveFileId(null as any), '');
    });
  });

  describe('getDriveShareLink', () => {
    it('generates standard Google Drive shareable link from prefixed asset ID without drive_ prefix', () => {
      const link = getDriveShareLink(samplePrefixedId);
      assert.strictEqual(link, `https://drive.google.com/file/d/${sampleRawId}/view?usp=sharing`);
      assert.ok(!link.includes('drive_'), 'Link must not contain client-side "drive_" prefix');
    });

    it('generates standard Google Drive shareable link from raw file ID', () => {
      const link = getDriveShareLink(sampleRawId);
      assert.strictEqual(link, `https://drive.google.com/file/d/${sampleRawId}/view?usp=sharing`);
    });
  });

  describe('Google Drive REST API Endpoint Construction', () => {
    it('constructs download binary endpoint with clean ID', () => {
      const cleanId = cleanDriveFileId(samplePrefixedId);
      const url = `https://www.googleapis.com/drive/v3/files/${cleanId}?alt=media`;
      assert.strictEqual(url, `https://www.googleapis.com/drive/v3/files/${sampleRawId}?alt=media`);
    });

    it('constructs document export fallback endpoint with clean ID', () => {
      const cleanId = cleanDriveFileId(samplePrefixedId);
      const url = `https://www.googleapis.com/drive/v3/files/${cleanId}/export?mimeType=application/pdf`;
      assert.strictEqual(url, `https://www.googleapis.com/drive/v3/files/${sampleRawId}/export?mimeType=application/pdf`);
    });

    it('constructs star update endpoint with clean ID', () => {
      const cleanId = cleanDriveFileId(samplePrefixedId);
      const url = `https://www.googleapis.com/drive/v3/files/${cleanId}`;
      assert.strictEqual(url, `https://www.googleapis.com/drive/v3/files/${sampleRawId}`);
    });

    it('constructs copy endpoint with clean ID', () => {
      const cleanId = cleanDriveFileId(samplePrefixedId);
      const url = `https://www.googleapis.com/drive/v3/files/${cleanId}/copy`;
      assert.strictEqual(url, `https://www.googleapis.com/drive/v3/files/${sampleRawId}/copy`);
    });

    it('constructs move endpoint with clean source and parent IDs', () => {
      const cleanFileId = cleanDriveFileId(samplePrefixedId);
      const targetFolderId = 'drive_folder_target_123';
      const cleanTargetId = cleanDriveFileId(targetFolderId);
      const prevFolderId = 'drive_folder_prev_456';
      const cleanPrevId = cleanDriveFileId(prevFolderId);

      const url = `https://www.googleapis.com/drive/v3/files/${cleanFileId}?addParents=${encodeURIComponent(cleanTargetId)}&removeParents=${encodeURIComponent(cleanPrevId)}`;

      assert.strictEqual(
        url,
        `https://www.googleapis.com/drive/v3/files/${sampleRawId}?addParents=folder_target_123&removeParents=folder_prev_456`
      );
    });

    it('constructs trash endpoint with clean ID', () => {
      const cleanId = cleanDriveFileId(samplePrefixedId);
      const url = `https://www.googleapis.com/drive/v3/files/${cleanId}`;
      assert.strictEqual(url, `https://www.googleapis.com/drive/v3/files/${sampleRawId}`);
    });
  });

  describe('Changes API Dual-Key Deletion Resolution', () => {
    it('emits both raw ID and prefixed ID so IndexedDB properly eliminates deleted assets', () => {
      const change = { fileId: sampleRawId, removed: true };
      const removedIds: string[] = [];

      const rawId = cleanDriveFileId(change.fileId);
      if (rawId) {
        removedIds.push(rawId);
        removedIds.push(`drive_${rawId}`);
      }

      assert.deepStrictEqual(removedIds, [sampleRawId, samplePrefixedId]);
    });
  });
});

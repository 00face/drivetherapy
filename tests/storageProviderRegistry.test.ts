/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pluggable Storage Provider Registry Unit Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STORAGE_BACKENDS,
  loadStorageBackends,
  getActiveStorageBackend,
  setActiveStorageBackend,
  configureS3Backend,
  configureWebDavBackend,
  buildS3CanonicalHeader,
} from '../src/services/storageProviderRegistry';

describe('Pluggable Cloud & Multi-Storage Provider Registry Suite', () => {
  it('provides default configurations for Google Drive, Local OS, R2, B2, Nextcloud, and Dropbox', () => {
    assert.equal(DEFAULT_STORAGE_BACKENDS.length, 6);
    const gdrive = DEFAULT_STORAGE_BACKENDS.find((b) => b.type === 'google-drive');
    const local = DEFAULT_STORAGE_BACKENDS.find((b) => b.type === 'local-os');
    const r2 = DEFAULT_STORAGE_BACKENDS.find((b) => b.id === 'backend_cloudflare_r2');
    const nextcloud = DEFAULT_STORAGE_BACKENDS.find((b) => b.id === 'backend_nextcloud');

    assert.ok(gdrive);
    assert.ok(local);
    assert.ok(r2);
    assert.ok(nextcloud);
  });

  it('switches active storage backend dynamically', () => {
    const switched = setActiveStorageBackend('backend_local');
    assert.ok(switched);
    assert.equal(switched?.id, 'backend_local');
    assert.equal(switched?.type, 'local-os');

    const active = getActiveStorageBackend();
    assert.equal(active.id, 'backend_local');
  });

  it('configures S3/R2 compatible backend with credentials and region', () => {
    const configured = configureS3Backend('backend_cloudflare_r2', {
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      bucket: 'production-wedding-photos',
      accessKeyId: 'R2_ACCESS_KEY_123',
      secretAccessKey: 'R2_SECRET_KEY_XYZ',
      region: 'auto',
    });

    assert.equal(configured.bucket, 'production-wedding-photos');
    assert.equal(configured.accessKeyId, 'R2_ACCESS_KEY_123');
    assert.equal(configured.enabled, true);
  });

  it('configures Nextcloud WebDAV credentials', () => {
    const webdav = configureWebDavBackend('backend_nextcloud', {
      endpoint: 'https://nextcloud.mysite.com/remote.php/dav/files/user/',
      username: 'studio_photographer',
      password: 'app-password-xyz',
    });

    assert.equal(webdav.username, 'studio_photographer');
    assert.equal(webdav.type, 'webdav');
  });

  it('builds canonical SigV4 headers for S3 authorization', () => {
    const sig = buildS3CanonicalHeader(
      'GET',
      'test.r2.cloudflarestorage.com',
      '/',
      '20261109T220000Z'
    );
    assert.equal(sig.signedHeaders, 'host;x-amz-date');
    assert.ok(sig.canonicalHeaders.includes('host:test.r2.cloudflarestorage.com'));
    assert.ok(sig.canonicalHeaders.includes('x-amz-date:20261109T220000Z'));
  });
});

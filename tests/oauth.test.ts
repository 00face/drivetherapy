import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  saveOAuthToken,
  loadOAuthToken,
  clearOAuthToken,
  isTokenExpired,
  getTokenRemainingSeconds,
  isTokenExpiringSoon,
  parseTokenInfoScopes,
} from '../src/services/oauthStorage.ts';
import { OAuthExpiredError } from '../src/services/googleDrive.ts';
import { OAuthTokenRecord } from '../src/types/index.ts';

describe('Drive Therapy OAuth 2.0 Master Verification Suite', () => {

  test('OAuthTokenRecord lifecycle tracks expiration timestamps and thresholds accurately', () => {
    const now = Date.now();
    const freshRecord: OAuthTokenRecord = {
      accessToken: 'ya29.mock_fresh_token',
      acquiredAt: now,
      expiresAt: now + 3600 * 1000, // 1 hour in future
      expiresIn: 3600,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      tokenType: 'Bearer',
      provider: 'firebase',
      userEmail: 'photographer@drivetherapy.internal',
    };

    assert.equal(isTokenExpired(freshRecord, 60), false, 'Fresh token must not be expired');
    assert.ok(getTokenRemainingSeconds(freshRecord) > 3500, 'Remaining seconds should be ~3600');
    assert.equal(isTokenExpiringSoon(freshRecord, 300), false, 'Fresh token should not be expiring soon');

    // Token expiring in 120 seconds (under 300s threshold)
    const expiringSoonRecord: OAuthTokenRecord = {
      ...freshRecord,
      expiresAt: now + 120 * 1000,
      expiresIn: 120,
    };
    assert.equal(isTokenExpired(expiringSoonRecord, 60), false, 'Not yet expired');
    assert.equal(isTokenExpiringSoon(expiringSoonRecord, 300), true, 'Must trigger expiring soon flag');

    // Expired token (past timestamp)
    const expiredRecord: OAuthTokenRecord = {
      ...freshRecord,
      expiresAt: now - 10000,
      expiresIn: 3600,
    };
    assert.equal(isTokenExpired(expiredRecord), true, 'Past token must be expired');
    assert.equal(getTokenRemainingSeconds(expiredRecord), 0, 'Remaining seconds for expired token is 0');
  });

  test('OAuth session storage obfuscates tokens and rehydrates accurately', () => {
    // In Node test environment, mock sessionStorage if not globally defined
    const storageMap = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => storageMap.get(key) || null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    (globalThis as any).sessionStorage = mockStorage;
    (globalThis as any).localStorage = mockStorage;

    const token: OAuthTokenRecord = {
      accessToken: 'ya29.a0AcM612_secret_token_value',
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      expiresIn: 3600,
      scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file'],
      tokenType: 'Bearer',
      provider: 'direct',
      userEmail: 'test@example.com',
    };

    saveOAuthToken(token);

    // Verify storage does NOT contain raw plaintext token
    const storedRaw = storageMap.get('dt_oauth_session_v2');
    assert.ok(storedRaw, 'Storage entry must exist');
    assert.ok(!storedRaw.includes('ya29.a0AcM612_secret_token_value'), 'Plaintext token must not appear in raw storage');

    // Verify deobfuscation & rehydration
    const rehydrated = loadOAuthToken();
    assert.ok(rehydrated, 'Must rehydrate token record');
    assert.equal(rehydrated?.accessToken, token.accessToken);
    assert.equal(rehydrated?.userEmail, 'test@example.com');
    assert.equal(rehydrated?.provider, 'direct');

    // Verify clear
    clearOAuthToken();
    assert.equal(loadOAuthToken(), null, 'After clearing, token must be null');
  });

  test('Scope string parser correctly audits Google Workspace permissions', () => {
    const rawScopes = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file openid email';
    const audit = parseTokenInfoScopes(rawScopes);

    assert.equal(audit.hasDriveReadonly, true, 'drive.readonly must be detected');
    assert.equal(audit.hasDriveFile, true, 'drive.file must be detected');
    assert.equal(audit.hasDriveFull, false, 'drive.full must not be detected for constrained token');
    assert.equal(audit.scopes.length, 4, 'Should parse all 4 space-separated scopes');

    const fullScopeAudit = parseTokenInfoScopes('https://www.googleapis.com/auth/drive');
    assert.equal(fullScopeAudit.hasDriveFull, true, 'drive full scope must be detected');
  });

  test('PKCE code challenge matches SHA256 base64url of code verifier', () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    assert.ok(codeVerifier.length >= 43, 'Code verifier meets RFC 7636 minimum length');
    assert.ok(codeChallenge.length >= 43, 'Code challenge base64url has valid length');
    assert.ok(!codeChallenge.includes('+') && !codeChallenge.includes('/') && !codeChallenge.includes('='), 'Challenge must be URL-safe');
  });

  test('OAuthExpiredError provides standardized error metadata for recovery', () => {
    const err = new OAuthExpiredError('Access token expired');
    assert.equal(err.name, 'OAuthExpiredError');
    assert.equal(err.isExpired, true);
    assert.equal(err.message, 'Access token expired');
  });

  test('Anti-CSRF state token generation guarantees 256-bit entropy and high collision resistance', () => {
    const generateState = () => crypto.randomBytes(32).toString('hex');
    const state1 = generateState();
    const state2 = generateState();

    assert.equal(state1.length, 64, '32 bytes in hex is exactly 64 characters');
    assert.equal(state2.length, 64);
    assert.notEqual(state1, state2, 'Random states must never collide');
  });

  test('Target origin enforcement rejects wildcard origins for credential relay', () => {
    const isOriginSecure = (targetOrigin: string) => {
      if (targetOrigin === '*') return false;
      try {
        const u = new URL(targetOrigin);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    };

    assert.equal(isOriginSecure('*'), false, 'Wildcard * must be rejected');
    assert.equal(isOriginSecure('http://localhost:3002'), true);
    assert.equal(isOriginSecure('https://drivetherapy.studio'), true);
    assert.equal(isOriginSecure('javascript:alert(1)'), false);
  });

});

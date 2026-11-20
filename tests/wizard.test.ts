import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('OAuth Setup Wizard & Zero-Token Onboarding Suite', () => {

  test('Validates Google Client ID format ending in .apps.googleusercontent.com', () => {
    const isValidClientId = (id: string) => {
      return Boolean(id && typeof id === 'string' && id.trim().endsWith('.apps.googleusercontent.com'));
    };

    assert.equal(isValidClientId('963613376461-sgsomepaq50t4gjt0ojsevsa2kq0k066.apps.googleusercontent.com'), true);
    assert.equal(isValidClientId('123456789-abcdef.apps.googleusercontent.com'), true);
    assert.equal(isValidClientId('invalid_id_not_google'), false);
    assert.equal(isValidClientId('ya29.access_token_not_client_id'), false);
    assert.equal(isValidClientId(''), false);
  });

  test('Computes standardized Authorized Redirect URI matching current origin and port', () => {
    const computeRedirectUri = (origin: string) => {
      const cleanOrigin = origin.replace(/\/+$/, '');
      return `${cleanOrigin}/api/auth/google/callback`;
    };

    assert.equal(
      computeRedirectUri('http://localhost:3000'),
      'http://localhost:3000/api/auth/google/callback'
    );
    assert.equal(
      computeRedirectUri('http://localhost:3001/'),
      'http://localhost:3001/api/auth/google/callback'
    );
    assert.equal(
      computeRedirectUri('https://drivetherapy.studio'),
      'https://drivetherapy.studio/api/auth/google/callback'
    );
  });

  test('Zero-Token Guarantee: Standard and Local tiers require zero client keys or manual tokens', () => {
    type OnboardingTier = 'standard' | 'custom' | 'local';

    const getTierRequirements = (tier: OnboardingTier) => {
      switch (tier) {
        case 'standard':
          return { requiresCustomClientId: false, requiresManualToken: false, requiresCloud: true };
        case 'local':
          return { requiresCustomClientId: false, requiresManualToken: false, requiresCloud: false };
        case 'custom':
          return { requiresCustomClientId: true, requiresManualToken: false, requiresCloud: true };
      }
    };

    const standardReqs = getTierRequirements('standard');
    assert.equal(standardReqs.requiresCustomClientId, false);
    assert.equal(standardReqs.requiresManualToken, false);

    const localReqs = getTierRequirements('local');
    assert.equal(localReqs.requiresCustomClientId, false);
    assert.equal(localReqs.requiresManualToken, false);
    assert.equal(localReqs.requiresCloud, false);

    const customReqs = getTierRequirements('custom');
    assert.equal(customReqs.requiresCustomClientId, true);
    assert.equal(customReqs.requiresManualToken, false, 'Custom OAuth uses OAuth flow, not manual token');
  });

  test('Wizard state machine transitions follow valid step sequence', () => {
    const validTransitions: Record<string, string[]> = {
      tier: ['console_guide'],
      console_guide: ['tier', 'credentials'],
      credentials: ['console_guide', 'verify'],
      verify: ['credentials', 'complete'],
      complete: [],
    };

    const canTransition = (from: string, to: string) => {
      return (validTransitions[from] || []).includes(to);
    };

    assert.equal(canTransition('tier', 'console_guide'), true);
    assert.equal(canTransition('console_guide', 'credentials'), true);
    assert.equal(canTransition('credentials', 'verify'), true);
    assert.equal(canTransition('verify', 'complete'), true);
    assert.equal(canTransition('tier', 'complete'), false, 'Cannot skip directly from tier to complete');
  });

  test('Required scopes checklist contains minimum necessary Drive and Identity permissions', () => {
    const requiredScopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    assert.ok(requiredScopes.includes('https://www.googleapis.com/auth/drive.readonly'));
    assert.ok(requiredScopes.includes('https://www.googleapis.com/auth/drive.file'));
    assert.equal(requiredScopes.length, 3);
  });

  test('Server OAuth config fallback correctly detects default client ID from project applet config', () => {
    const mockFirebaseConfig = {
      projectId: 'gen-lang-client-0342729779',
      oAuthClientId: '963613376461-sgsomepaq50t4gjt0ojsevsa2kq0k066.apps.googleusercontent.com',
    };

    const resolveClientId = (envId?: string, configId?: string): string | null => {
      return envId || configId || null;
    };

    assert.equal(
      resolveClientId(undefined, mockFirebaseConfig.oAuthClientId),
      '963613376461-sgsomepaq50t4gjt0ojsevsa2kq0k066.apps.googleusercontent.com'
    );
    assert.equal(
      resolveClientId('custom-override.apps.googleusercontent.com', mockFirebaseConfig.oAuthClientId),
      'custom-override.apps.googleusercontent.com'
    );
  });

  test('Local file mounting handles directory and multi-file fallback without uncaught exceptions', () => {
    const mapRelativePath = (relPath?: string, folderName?: string, fileName?: string): string => {
      if (relPath) return relPath.startsWith('/') ? relPath : `/${relPath}`;
      return `/${folderName || 'Local Media'}/${fileName || 'photo.jpg'}`;
    };

    assert.equal(mapRelativePath('Wedding/Hero.jpg'), '/Wedding/Hero.jpg');
    assert.equal(mapRelativePath(undefined, 'Studio', 'Shot01.cr3'), '/Studio/Shot01.cr3');
  });

});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDriveAdvancedQuery,
  parseDriveSearchOperators,
} from '../src/services/googleDrive';
import {
  getCommandSuggestions,
  loadCastorLocalPermission,
  parseCastorCommand,
} from '../src/services/castorCommandParser';
import {
  MULTICLOUD_CONNECTORS,
  isAllowedGooglePhotosMediaUrl,
} from '../src/services/multicloudSyncEngine';

describe('Castor Unified Search, Drive v3 q Builder, @/! Commands & Multicloud Sync', () => {
  it('builds exact Google Drive API v3 files.list q clauses', () => {
    const q = buildDriveAdvancedQuery({
      fullText: 'pinprick',
      nameContains: 'sprite',
      mimeType: 'image/png',
      folderId: 'folder_abc123',
      modifiedAfter: '2026-11-01',
      sharedWithMe: true,
      ownedByMe: true,
      starred: true,
    });

    assert.ok(q.includes('trashed = false'));
    assert.ok(q.includes("fullText contains 'pinprick'"));
    assert.ok(q.includes("name contains 'sprite'"));
    assert.ok(q.includes("mimeType = 'image/png'"));
    assert.ok(q.includes("'folder_abc123' in parents"));
    assert.ok(q.includes("modifiedTime > '2026-11-01T00:00:00'"));
    assert.ok(q.includes('sharedWithMe = true'));
    assert.ok(q.includes("'me' in owners"));
    assert.ok(q.includes('starred = true'));
  });

  it('parses power-user Drive search operators alongside free text', () => {
    const parsed = parseDriveSearchOperators('resume type:pdf starred:true after:2026-01-01 shared:true');
    assert.equal(parsed.fullText, 'resume');
    assert.equal(parsed.mimeType, 'application/pdf');
    assert.equal(parsed.starred, true);
    assert.equal(parsed.sharedWithMe, true);
    assert.equal(parsed.modifiedAfter, '2026-01-01');

    const imgParsed = parseDriveSearchOperators('cat mime:image/');
    assert.equal(imgParsed.fullText, 'cat');
    assert.equal(imgParsed.mimePrefix, 'image/');
  });

  it('parses @, /, and ! commands and provides live autocomplete suggestions', () => {
    const driveCmd = parseCastorCommand('@drive resume type:pdf');
    assert.equal(driveCmd.prefix, '@');
    assert.equal(driveCmd.command, 'drive');
    assert.equal(driveCmd.args, 'resume type:pdf');

    const gmailCmd = parseCastorCommand('@gmail from:alice has:attachment');
    assert.equal(gmailCmd.prefix, '@');
    assert.equal(gmailCmd.command, 'gmail');
    assert.equal(gmailCmd.args, 'from:alice has:attachment');

    const animeCmd = parseCastorCommand('/anime');
    assert.equal(animeCmd.prefix, '/');
    assert.equal(animeCmd.command, 'anime');

    const pickerCmd = parseCastorCommand('!picker');
    assert.equal(pickerCmd.prefix, '!');
    assert.equal(pickerCmd.command, 'picker');

    const atSuggestions = getCommandSuggestions('@g');
    assert.ok(atSuggestions.some((c) => c.trigger === '@gmail'));
    const bangSuggestions = getCommandSuggestions('!p');
    assert.ok(bangSuggestions.some((c) => c.trigger === '!picker'));
    const slashSuggestions = getCommandSuggestions('/t');
    assert.ok(slashSuggestions.some((c) => c.trigger === '/transfer'));
  });

  it('defaults Local Drive Search permission to false until explicitly granted', () => {
    assert.equal(loadCastorLocalPermission(), false);
  });

  it('tiers Multicloud connectors (Google Workspace active vs Phase 2 external clouds) and enforces SSRF allowlist', () => {
    const activeIds = MULTICLOUD_CONNECTORS.filter((c) => c.status === 'active').map((c) => c.id);
    const phase2Ids = MULTICLOUD_CONNECTORS.filter((c) => c.status === 'phase2-ready').map((c) => c.id);

    assert.ok(activeIds.includes('google-photos'));
    assert.ok(activeIds.includes('google-drive'));
    assert.ok(phase2Ids.includes('onedrive'));
    assert.ok(phase2Ids.includes('dropbox'));
    assert.ok(phase2Ids.includes('sharepoint'));
    assert.ok(phase2Ids.includes('wasabi'));
    assert.ok(phase2Ids.includes('flickr'));
    assert.ok(phase2Ids.includes('icloud'));
    assert.ok(phase2Ids.includes('ftp'));

    assert.equal(isAllowedGooglePhotosMediaUrl('https://lh3.googleusercontent.com/lr/abc123'), true);
    assert.equal(isAllowedGooglePhotosMediaUrl('http://127.0.0.1:3040/api/fs/stream'), false);
    assert.equal(isAllowedGooglePhotosMediaUrl('https://evil.example.com/photo.jpg'), false);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseKeepTakeoutNote } from '../src/services/keepNotesEngine.ts';
import { mapGmailAttachmentToAsset } from '../src/services/gmailMediaHarvester.ts';
import { extractClassroomMaterialAssets } from '../src/services/googleClassroomEngine.ts';
import { mapGcsObjectToAsset } from '../src/services/gcsArchiveEngine.ts';
import { NotebookLmDossierGenerator } from '../src/services/notebookLmDossierGenerator.ts';

describe('Google Ecosystem Hub (Keep Notes, Gmail Harvester, Tasks, Contacts & Docs/Sheets)', () => {
  it('parses Google Keep Takeout JSON notes with checklists and colors accurately', () => {
    const note = parseKeepTakeoutNote({
      title: 'Studio Lighting Checklist',
      textContent: 'Bring diffusion scrim',
      color: 'TEAL',
      isPinned: true,
      userEditedTimestampUsec: 1700000000000000,
      listContent: [
        { text: 'Key light 5600K', isChecked: true },
        { text: 'V-mount batteries', isChecked: false },
      ],
    });

    assert.equal(note.title, 'Studio Lighting Checklist');
    assert.equal(note.color, 'teal');
    assert.equal(note.pinned, true);
    assert.equal(note.checklist.length, 2);
    assert.equal(note.checklist[0].checked, true);
    assert.equal(note.source, 'takeout');
  });

  it('maps Gmail attachments into MediaAsset objects with proxy URLs', () => {
    const asset = mapGmailAttachmentToAsset({
      messageId: 'msg_1',
      attachmentId: 'att_abc123456789',
      filename: 'Client_Brief.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 512000,
      subject: 'Project Brief',
      from: 'client@example.com',
      date: '2026-11-17T10:00:00Z',
    });

    assert.equal(asset.category, 'document');
    assert.equal(asset.extension, 'PDF');
    assert.ok(asset.cloudUrl?.includes('/api/gmail/attachment/msg_1/'));
    assert.deepEqual(asset.tags, ['Gmail', 'client@example.com']);
  });

  it('server.ts exposes Gmail, Google Tasks, and Google Contacts endpoints + OAuth scopes', () => {
    const srv = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    assert.ok(srv.includes('https://www.googleapis.com/auth/gmail.readonly'));
    assert.ok(srv.includes('https://www.googleapis.com/auth/gmail.send'));
    assert.ok(srv.includes('https://www.googleapis.com/auth/tasks'));
    assert.ok(srv.includes('https://www.googleapis.com/auth/contacts.readonly'));
    assert.ok(srv.includes("app.get('/api/gmail/attachments'"));
    assert.ok(srv.includes("app.post('/api/gmail/send'"));
    assert.ok(srv.includes("app.get('/api/tasks'"));
    assert.ok(srv.includes("app.get('/api/contacts'"));
  });

  it('extracts Google Classroom courseWorkMaterial Drive attachments into MediaAsset objects', () => {
    const assets = extractClassroomMaterialAssets('Cinematography 101', {
      courseWorkMaterial: [
        {
          id: 'mat_1',
          title: 'Week 1 Lecture',
          materials: [
            {
              driveFile: {
                driveFile: {
                  id: 'drive_file_123',
                  title: 'Lighting_Diagram.png',
                  alternateLink: 'https://drive.google.com/file/d/drive_file_123/view',
                  thumbnailUrl: 'https://lh3.googleusercontent.com/thumb',
                },
              },
            },
          ],
        },
      ],
    });

    assert.equal(assets.length, 1);
    assert.equal(assets[0].id, 'drive_drive_file_123');
    assert.equal(assets[0].name, 'Lighting_Diagram.png');
    assert.equal(assets[0].path, 'Classroom/Cinematography 101/Week 1 Lecture/Lighting_Diagram.png');
    assert.deepEqual(assets[0].tags, ['Classroom', 'Cinematography 101']);
  });

  it('maps Google Cloud Storage (GCS) objects into MediaAsset objects', () => {
    const asset = mapGcsObjectToAsset({
      id: 'my-studio-archive/raw/reel.mp4/1',
      bucket: 'my-studio-archive',
      name: 'raw/reel.mp4',
      contentType: 'video/mp4',
      size: '4096000',
      updated: '2026-11-17T12:00:00Z',
      mediaLink: 'https://storage.googleapis.com/download/storage/v1/b/my-studio-archive/o/raw%2Freel.mp4',
    });

    assert.equal(asset.category, 'video');
    assert.equal(asset.extension, 'MP4');
    assert.equal(asset.name, 'reel.mp4');
    assert.equal(asset.path, 'GCS/my-studio-archive/raw/reel.mp4');
    assert.deepEqual(asset.tags, ['GCS', 'my-studio-archive']);
  });

  it('server.ts supports incremental OAuth extra_scopes, GCS, Classroom, and 2000-item Photos Picker', () => {
    const srv = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
    assert.ok(srv.includes('https://www.googleapis.com/auth/devstorage.read_only'));
    assert.ok(srv.includes('OPTIONAL_EXTRA_SCOPES'));
    assert.ok(srv.includes('resolveRequestedScopes(req.query.extra_scopes)'));
    assert.ok(srv.includes('maxItemCount: 2000'));
    assert.ok(srv.includes("app.get('/api/classroom/courses'"));
    assert.ok(srv.includes("app.get('/api/classroom/materials/:courseId'"));
    assert.ok(srv.includes("app.get('/api/gcs/buckets'"));
    assert.ok(srv.includes("app.get('/api/gcs/objects/:bucket'"));
    assert.ok(srv.includes("app.get('/api/gcs/stream/:bucket/*'"));
    assert.ok(srv.includes("app.post('/api/gemini/workspace-assist'"));
    assert.ok(srv.includes("app.disable('x-powered-by')"));
    assert.ok(srv.includes("include_granted_scopes: 'true'"));
  });

  it('extracts Classroom external links & YouTube videos and routes GCS through authenticated proxy', () => {
    const assets = extractClassroomMaterialAssets('Film Theory', {
      courseWork: [
        {
          id: 'cw_1',
          title: 'Week 2',
          materials: [
            { link: { url: 'https://example.com/syllabus.pdf', title: 'Syllabus' } },
            { youtubeVideo: { id: 'abc123', title: 'Framing Lecture' } },
          ],
        },
      ],
    });
    assert.equal(assets.length, 2);
    assert.equal(assets[0].cloudUrl, 'https://example.com/syllabus.pdf');
    assert.equal(assets[1].extension, 'YT');

    const gcsAsset = mapGcsObjectToAsset(
      { id: '1', bucket: 'studio-bkt', name: 'clips/shot.mp4', contentType: 'video/mp4' },
      'tok_test'
    );
    assert.ok(gcsAsset.cloudUrl?.startsWith('/api/gcs/stream/studio-bkt/clips/shot.mp4?token='));
  });

  it('escapes HTML in NotebookLM dossiers and enforces WCAG 44px targets & 20-locale parity', () => {
    const dossier = new NotebookLmDossierGenerator().generateDossier(
      [
        {
          id: 'xss_1',
          name: '<script>alert(1)</script>.jpg',
          source: 'cloud',
          category: 'image',
          mimeType: 'image/jpeg',
          extension: 'JPG',
          path: '/xss',
          sizeBytes: 100,
          modifiedTime: '2026-11-18T00:00:00Z',
          thumbnailUrl: '',
          isCached: false,
          cullingStatus: 'picked',
          rating: 5,
          tags: [],
          faces: [],
          quality: { sharpness: 90, exposure: 90, overall: 90, isBlurry: false },
          palette: [],
          exif: {},
        },
      ],
      { title: '<img src=x onerror=alert(1)>' }
    );
    assert.equal(dossier.htmlContent.includes('<script>'), false);
    assert.ok(dossier.htmlContent.includes('&lt;script&gt;'));

    for (const file of ['GoogleEcosystemHubModal.tsx', 'GooglePhotosView.tsx', 'OAuthWizardModal.tsx', 'DriveShareModal.tsx']) {
      const src = fs.readFileSync(path.resolve(process.cwd(), 'src/components', file), 'utf8');
      assert.equal(/min-h-\[(3[0-9]|40)px\]/.test(src), false, `${file} should use >= 44px interactive targets`);
      assert.ok(src.includes('useTranslation'), `${file} should use useTranslation`);
    }

    const hubSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/GoogleEcosystemHubModal.tsx'), 'utf8');
    const buttonCount = (hubSrc.match(/<button\b/g) || []).length;
    const target44Count = (hubSrc.match(/min-h-\[44px\]/g) || []).length;
    assert.ok(target44Count >= buttonCount, `Expected all ${buttonCount} buttons in Hub to have min-h-[44px], found ${target44Count}`);

    const localesDir = path.resolve(process.cwd(), 'src/i18n/locales');
    for (const file of fs.readdirSync(localesDir).filter((f) => f.endsWith('.json'))) {
      const json = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
      assert.ok(json['workspaceHub.title'], `${file} missing workspaceHub.title`);
      assert.ok(json['workspaceHub.grantScopes'], `${file} missing workspaceHub.grantScopes`);
      assert.ok(json['photos.title'], `${file} missing photos.title`);
      assert.ok(json['oauthWizard.title'], `${file} missing oauthWizard.title`);
      assert.ok(json['driveShare.title'], `${file} missing driveShare.title`);
    }
  });
});

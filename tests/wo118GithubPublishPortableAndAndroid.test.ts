/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * [WO-118] GitHub Publication Hygiene, Prebuilt Native Executables (.exe / ELF / Mach-O),
 * Universal Portable Archive & Android Project Verification Suite
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const ROOT = process.cwd();

describe('[WO-118] GitHub Publication Hygiene, Native Binaries & Android Scaffold', () => {
  it('excludes all internal agent files, task rites, work orders, sitreps, and vaults from Git index', () => {
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    const requiredRules = [
      'AGENTS.md',
      '**/AGENTS.override.md',
      '.agents/',
      '.codex/',
      '.aistudio/',
      'workordermanager.md',
      'sitreps/',
      'battleplans/',
      'projectdoctrine.md',
      'farm/',
      'library/',
      'MEMORY.md',
      '.session-vault.enc',
      '.session-vault.key',
      '.hero-links-store.json*',
    ];
    for (const rule of requiredRules) {
      assert.ok(gitignore.includes(rule), `.gitignore must contain ${rule}`);
    }

    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);

    const forbiddenTracked = tracked.filter((f) =>
      /^(AGENTS\.md|.*AGENTS\.override\.md|\.agents\/|\.codex\/|\.aistudio\/|workordermanager\.md|sitreps\/|battleplans\/|projectdoctrine\.md|testcase\.md|versioncontrol\.md|history\.md|walkthrough\.md|farm\/|library\/|MEMORY\.md|IDENTITY\.md|soul\.md|weather\.md|RUNBOOK\.md|.*\.graphml|bun\.lock)$/.test(
        f
      )
    );
    assert.deepEqual(
      forbiddenTracked,
      [],
      `Git index must not contain internal development files: ${forbiddenTracked.join(', ')}`
    );
  });

  it('verifies prebuilt native Windows .exe (PE32+), Linux (ELF), macOS (Mach-O), and Android ARM64 binaries', () => {
    const portableDir = path.join(ROOT, 'dist-portable');
    const winExe = path.join(portableDir, 'DriveTherapy.exe');
    const linuxBin = path.join(portableDir, 'DriveTherapy-linux-x64');
    const macArmBin = path.join(portableDir, 'DriveTherapy-macos-arm64');
    const macIntelBin = path.join(portableDir, 'DriveTherapy-macos-x64');
    const androidArmBin = path.join(portableDir, 'DriveTherapy-android-arm64');

    assert.ok(fs.existsSync(winExe), 'DriveTherapy.exe must exist');
    assert.ok(fs.existsSync(linuxBin), 'DriveTherapy-linux-x64 must exist');
    assert.ok(fs.existsSync(macArmBin), 'DriveTherapy-macos-arm64 must exist');
    assert.ok(fs.existsSync(macIntelBin), 'DriveTherapy-macos-x64 must exist');
    assert.ok(fs.existsSync(androidArmBin), 'DriveTherapy-android-arm64 must exist');

    // Verify authentic OS executable magic headers
    const winHeader = fs.readFileSync(winExe).subarray(0, 2);
    assert.equal(winHeader[0], 0x4d, 'Windows .exe must start with M (0x4D)');
    assert.equal(winHeader[1], 0x5a, 'Windows .exe must start with Z (0x5A)');

    const linuxHeader = fs.readFileSync(linuxBin).subarray(0, 4);
    assert.deepEqual([...linuxHeader], [0x7f, 0x45, 0x4c, 0x46], 'Linux binary must have ELF magic header');

    const macHeader = fs.readFileSync(macArmBin).subarray(0, 4);
    assert.deepEqual([...macHeader], [0xcf, 0xfa, 0xed, 0xfe], 'macOS arm64 binary must have Mach-O 64-bit magic header');

    const androidHeader = fs.readFileSync(androidArmBin).subarray(0, 4);
    assert.deepEqual([...androidHeader], [0x7f, 0x45, 0x4c, 0x46], 'Android arm64 binary must have ELF magic header');
  });

  it('verifies Universal Portable release archives and Android Studio Gradle scaffold', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'release', 'DriveTherapy-v2.2.0-universal-portable.zip')),
      'Universal portable .zip must exist in release/'
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, 'release', 'DriveTherapy-v2.2.0-universal-portable.tar.gz')),
      'Universal portable .tar.gz must exist in release/'
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, 'release', 'SHA256SUMS.txt')),
      'SHA256SUMS.txt must exist in release/'
    );

    assert.ok(
      fs.existsSync(path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')),
      'AndroidManifest.xml must exist'
    );
    assert.ok(
      fs.existsSync(
        path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'com', 'drivetherapy', 'studio', 'MainActivity.java')
      ),
      'MainActivity.java must exist'
    );

    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    assert.ok(readme.includes('DriveTherapy.exe'), 'README.md must document Windows DriveTherapy.exe');
    assert.ok(readme.includes('DriveTherapy-linux-x64'), 'README.md must document Linux native binary');
    assert.ok(readme.includes('DriveTherapy-macos-arm64'), 'README.md must document macOS native binary');
    assert.ok(readme.includes('npm run build:android'), 'README.md must document Android build instructions');
    assert.ok(readme.includes('public/drive-therapy-logo.png'), 'README.md must embed the Drive Therapy logo');
  });

  it('verifies Drive Therapy logo, FAQ, GitHub Wiki suite, and standard governance docs contain zero internal work-order jargon', () => {
    const logoPng = path.join(ROOT, 'public', 'drive-therapy-logo.png');
    const logo120Png = path.join(ROOT, 'public', 'drive-therapy-logo-120.png');
    const lockupDarkPng = path.join(ROOT, 'public', 'brand', 'drive-therapy-lockup-dark.png');
    const masterBrandSvg = path.join(ROOT, 'public', 'brand', 'drive-therapy-brand-stylesheet.svg');
    const logoSvg = path.join(ROOT, 'public', 'logo.svg');
    assert.ok(fs.existsSync(logoPng), 'public/drive-therapy-logo.png must exist');
    assert.ok(fs.existsSync(logo120Png), 'public/drive-therapy-logo-120.png (120x120 Google OAuth icon) must exist');
    assert.ok(fs.existsSync(lockupDarkPng), 'public/brand/drive-therapy-lockup-dark.png must exist');
    assert.ok(fs.existsSync(masterBrandSvg), 'public/brand/drive-therapy-brand-stylesheet.svg must exist');
    assert.ok(fs.existsSync(logoSvg), 'public/logo.svg must exist');
    const pngMagic = fs.readFileSync(logoPng).subarray(0, 4);
    assert.deepEqual([...pngMagic], [0x89, 0x50, 0x4e, 0x47], 'drive-therapy-logo.png must have valid PNG magic header');

    const licenseText = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
    assert.ok(licenseText.includes('AGPL-3.0-or-later'), 'LICENSE must specify AGPL-3.0-or-later');

    const privacyHtml = fs.readFileSync(path.join(ROOT, 'public', 'privacy.html'), 'utf8');
    assert.ok(
      privacyHtml.includes('Google API Services User Data Policy') && privacyHtml.includes('Limited Use'),
      'public/privacy.html must contain the mandatory Google API Limited Use disclosure'
    );

    const publicDocPaths = [
      'README.md',
      'LICENSE',
      'NOTICE',
      'SECURITY.md',
      'CONTRIBUTING.md',
      'CHANGELOG.md',
      'docs/FAQ.md',
      'docs/PRIVACY_POLICY.md',
      'docs/TERMS_OF_SERVICE.md',
      'docs/PRODUCTION_OAUTH_GUIDE.md',
      'docs/wiki/Home.md',
      'docs/wiki/_Sidebar.md',
      'docs/wiki/01-Installation-and-OS-Builds.md',
      'docs/wiki/02-Studios-and-Keyboard-Shortcuts.md',
      'docs/wiki/03-Cloud-Power-Suite-and-Multicloud.md',
      'docs/wiki/04-Enterprise-Sharing-DLP-and-Malware-Scanning.md',
      'docs/wiki/05-FAQ-and-Troubleshooting.md',
    ];

    for (const rel of publicDocPaths) {
      const full = path.join(ROOT, rel);
      assert.ok(fs.existsSync(full), `Public GitHub document must exist: ${rel}`);
      const content = fs.readFileSync(full, 'utf8');
      assert.ok(content.length > 200, `${rel} must be substantive`);
      assert.ok(!content.includes('[WO-'), `${rel} must not contain internal work-order tags ([WO-...)`);
      assert.ok(!content.includes('AGENTS.md'), `${rel} must not reference internal AGENTS.md`);
      assert.ok(!content.includes('sitreps/'), `${rel} must not reference internal sitreps/`);
    }
  });
});

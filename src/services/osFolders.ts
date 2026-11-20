/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Multi-OS Common Folder Resolution Service
 * Dynamically resolves authentic user directories across Linux (XDG user dirs / localized folders),
 * Windows (Known Folders + OneDrive Redirection), and macOS (iCloud Drive + system folders).
 */

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export interface OsCommonLocation {
  id: string;
  name: string;
  path: string;
  icon: string;
}

/**
 * Resolve standard OS Common Folders based on the host platform
 */
export function resolveOsCommonFolders(
  homeDir: string = os.homedir(),
  platform: NodeJS.Platform = os.platform()
): OsCommonLocation[] {
  const candidateRoots: OsCommonLocation[] = [
    { id: 'home', name: 'Home', path: homeDir, icon: 'Home' },
  ];

  if (platform === 'linux') {
    // 1. Linux XDG User Dirs resolution
    const xdgConfigDir =
      homeDir === os.homedir() && process.env.XDG_CONFIG_HOME
        ? process.env.XDG_CONFIG_HOME
        : path.join(homeDir, '.config');
    const xdgConfigFile = path.join(xdgConfigDir, 'user-dirs.dirs');
    const xdgMap: Record<string, { id: string; name: string; icon: string }> = {
      XDG_PICTURES_DIR: { id: 'pictures', name: 'Pictures', icon: 'Image' },
      XDG_DOWNLOAD_DIR: { id: 'downloads', name: 'Downloads', icon: 'Download' },
      XDG_DOCUMENTS_DIR: { id: 'documents', name: 'Documents', icon: 'FileText' },
      XDG_DESKTOP_DIR: { id: 'desktop', name: 'Desktop', icon: 'Monitor' },
      XDG_VIDEOS_DIR: { id: 'videos', name: 'Videos', icon: 'Video' },
      XDG_MUSIC_DIR: { id: 'music', name: 'Music', icon: 'Music' },
    };

    const foundXdgKeys = new Set<string>();
    if (fs.existsSync(xdgConfigFile)) {
      try {
        const content = fs.readFileSync(xdgConfigFile, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const match = trimmed.match(/^([A-Z_]+)="?([^"]+)"?$/);
          if (match) {
            const [, key, rawVal] = match;
            if (xdgMap[key]) {
              const resolved = rawVal.replace(/\$HOME|\$\{HOME\}/g, homeDir);
              candidateRoots.push({
                id: xdgMap[key].id,
                name: xdgMap[key].name,
                path: path.resolve(resolved),
                icon: xdgMap[key].icon,
              });
              foundXdgKeys.add(key);
            }
          }
        }
      } catch (err) {
        console.warn('Failed parsing user-dirs.dirs:', err);
      }
    }

    if (!foundXdgKeys.has('XDG_PICTURES_DIR')) {
      candidateRoots.push({ id: 'pictures', name: 'Pictures', path: path.join(homeDir, 'Pictures'), icon: 'Image' });
    }
    if (!foundXdgKeys.has('XDG_DOWNLOAD_DIR')) {
      candidateRoots.push({ id: 'downloads', name: 'Downloads', path: path.join(homeDir, 'Downloads'), icon: 'Download' });
    }
    if (!foundXdgKeys.has('XDG_DOCUMENTS_DIR')) {
      candidateRoots.push({ id: 'documents', name: 'Documents', path: path.join(homeDir, 'Documents'), icon: 'FileText' });
    }
    if (!foundXdgKeys.has('XDG_DESKTOP_DIR')) {
      candidateRoots.push({ id: 'desktop', name: 'Desktop', path: path.join(homeDir, 'Desktop'), icon: 'Monitor' });
    }
    if (!foundXdgKeys.has('XDG_VIDEOS_DIR')) {
      candidateRoots.push({ id: 'videos', name: 'Videos', path: path.join(homeDir, 'Videos'), icon: 'Video' });
    }
    if (!foundXdgKeys.has('XDG_MUSIC_DIR')) {
      candidateRoots.push({ id: 'music', name: 'Music', path: path.join(homeDir, 'Music'), icon: 'Music' });
    }
    candidateRoots.push({ id: 'root', name: '/', path: '/', icon: 'HardDrive' });
  } else if (platform === 'win32') {
    // 2. Windows Known Folders + OneDrive Redirection
    const oneDrive = process.env.OneDrive || process.env.ONEDRIVECOMMERCIAL || path.join(homeDir, 'OneDrive');
    if (oneDrive) {
      candidateRoots.push(
        { id: 'onedrive-pictures', name: 'OneDrive Pictures', path: path.join(oneDrive, 'Pictures'), icon: 'Image' },
        { id: 'onedrive-docs', name: 'OneDrive Documents', path: path.join(oneDrive, 'Documents'), icon: 'FileText' },
        { id: 'onedrive-desktop', name: 'OneDrive Desktop', path: path.join(oneDrive, 'Desktop'), icon: 'Monitor' }
      );
    }
    candidateRoots.push(
      { id: 'pictures', name: 'Pictures', path: path.join(homeDir, 'Pictures'), icon: 'Image' },
      { id: 'downloads', name: 'Downloads', path: path.join(homeDir, 'Downloads'), icon: 'Download' },
      { id: 'documents', name: 'Documents', path: path.join(homeDir, 'Documents'), icon: 'FileText' },
      { id: 'desktop', name: 'Desktop', path: path.join(homeDir, 'Desktop'), icon: 'Monitor' },
      { id: 'videos', name: 'Videos', path: path.join(homeDir, 'Videos'), icon: 'Video' },
      { id: 'music', name: 'Music', path: path.join(homeDir, 'Music'), icon: 'Music' },
      { id: 'root', name: 'C:\\', path: 'C:\\', icon: 'HardDrive' }
    );
  } else if (platform === 'darwin') {
    // 3. macOS Standard + iCloud Drive
    const icloudDocs = path.join(homeDir, 'Library/Mobile Documents/com~apple~CloudDocs');
    candidateRoots.push(
      { id: 'icloud', name: 'iCloud Drive', path: icloudDocs, icon: 'Cloud' },
      { id: 'pictures', name: 'Pictures', path: path.join(homeDir, 'Pictures'), icon: 'Image' },
      { id: 'downloads', name: 'Downloads', path: path.join(homeDir, 'Downloads'), icon: 'Download' },
      { id: 'documents', name: 'Documents', path: path.join(homeDir, 'Documents'), icon: 'FileText' },
      { id: 'desktop', name: 'Desktop', path: path.join(homeDir, 'Desktop'), icon: 'Monitor' },
      { id: 'movies', name: 'Movies', path: path.join(homeDir, 'Movies'), icon: 'Video' },
      { id: 'music', name: 'Music', path: path.join(homeDir, 'Music'), icon: 'Music' },
      { id: 'root', name: '/', path: '/', icon: 'HardDrive' }
    );
  } else {
    // 4. General fallback
    candidateRoots.push(
      { id: 'pictures', name: 'Pictures', path: path.join(homeDir, 'Pictures'), icon: 'Image' },
      { id: 'downloads', name: 'Downloads', path: path.join(homeDir, 'Downloads'), icon: 'Download' },
      { id: 'documents', name: 'Documents', path: path.join(homeDir, 'Documents'), icon: 'FileText' },
      { id: 'desktop', name: 'Desktop', path: path.join(homeDir, 'Desktop'), icon: 'Monitor' },
      { id: 'root', name: '/', path: '/', icon: 'HardDrive' }
    );
  }

  const seenPaths = new Set<string>();
  const accessible: OsCommonLocation[] = [];

  for (const item of candidateRoots) {
    try {
      const normalized = path.resolve(item.path);
      if (seenPaths.has(normalized)) continue;
      if (fs.existsSync(normalized) && fs.statSync(normalized).isDirectory()) {
        seenPaths.add(normalized);
        accessible.push({ ...item, path: normalized });
      }
    } catch {
      // Ignore unresolvable paths
    }
  }

  return accessible;
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Classroom Coursework & Materials Service
 */

import { MediaAsset } from '../types';
import { loadOAuthToken, mapDriveFileToAsset } from './googleDrive';

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  alternateLink?: string;
}

export function extractClassroomMaterialAssets(
  courseName: string,
  materialsPayload: { courseWorkMaterial?: any[]; courseWork?: any[] }
): MediaAsset[] {
  const entries = [
    ...(materialsPayload.courseWorkMaterial || []),
    ...(materialsPayload.courseWork || []),
  ];
  const out: MediaAsset[] = [];

  for (const entry of entries) {
    const entryTitle = entry.title || 'Course Material';
    const mats: any[] = Array.isArray(entry.materials) ? entry.materials : [];
    for (const m of mats) {
      if (m.driveFile?.driveFile) {
        const df = m.driveFile.driveFile;
        const mapped = mapDriveFileToAsset({
          id: df.id,
          name: df.title || `${entryTitle}.pdf`,
          mimeType: 'application/octet-stream',
          thumbnailLink: df.thumbnailUrl,
          webViewLink: df.alternateLink,
        });
        out.push({
          ...mapped,
          path: `Classroom/${courseName}/${entryTitle}/${mapped.name}`,
          tags: ['Classroom', courseName],
        });
      } else if (m.link?.url) {
        const title = m.link.title || entryTitle;
        out.push({
          id: `classroom_link_${entry.id || title}_${out.length}`,
          name: title,
          source: 'cloud',
          category: 'document',
          mimeType: 'text/html',
          extension: 'URL',
          path: `Classroom/${courseName}/${entryTitle}/${title}`,
          sizeBytes: 0,
          modifiedTime: entry.updateTime || new Date().toISOString(),
          cloudUrl: m.link.url,
          thumbnailUrl: m.link.thumbnailUrl || '',
          isCached: false,
          cullingStatus: 'unrated',
          rating: 0,
          tags: ['Classroom', courseName, 'Link'],
          faces: [],
          quality: { sharpness: 85, exposure: 85, overall: 85, isBlurry: false },
          palette: [],
          exif: {},
        });
      } else if (m.youtubeVideo?.id) {
        const yt = m.youtubeVideo;
        const title = yt.title || entryTitle;
        out.push({
          id: `classroom_yt_${yt.id}`,
          name: title,
          source: 'cloud',
          category: 'video',
          mimeType: 'video/mp4',
          extension: 'YT',
          path: `Classroom/${courseName}/${entryTitle}/${title}`,
          sizeBytes: 0,
          modifiedTime: entry.updateTime || new Date().toISOString(),
          cloudUrl: yt.alternateLink || `https://www.youtube.com/watch?v=${yt.id}`,
          thumbnailUrl: yt.thumbnailUrl || '',
          isCached: false,
          cullingStatus: 'unrated',
          rating: 0,
          tags: ['Classroom', courseName, 'YouTube'],
          faces: [],
          quality: { sharpness: 85, exposure: 85, overall: 85, isBlurry: false },
          palette: [],
          exif: {},
        });
      }
    }
  }
  return out;
}

export async function fetchClassroomCourses(): Promise<ClassroomCourse[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetch('/api/classroom/courses', { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Classroom fetch failed (${res.status})`);
  return Array.isArray(data.courses) ? data.courses : [];
}

export async function fetchClassroomCourseAssets(course: ClassroomCourse): Promise<MediaAsset[]> {
  const token = loadOAuthToken()?.accessToken;
  if (!token) throw new Error('Connect Google account first.');
  const res = await fetch(`/api/classroom/materials/${encodeURIComponent(course.id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Classroom materials failed (${res.status})`);
  return extractClassroomMaterialAssets(course.name, data);
}

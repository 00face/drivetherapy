/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Map Data Loader Engine
 * Parses GeoJSON, GPX, KML, and geotagged CSV files from Local OS Storage,
 * Google Drive, or remote URLs into unified GeoJSON FeatureCollections.
 */

export type SpatialFormat = 'geojson' | 'gpx' | 'kml' | 'csv';
export type MapLayerSourceKind = 'local' | 'drive' | 'url';

export interface GeoJsonGeometry {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: any;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: Record<string, any>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface LoadedMapLayer {
  id: string;
  name: string;
  sourceKind: MapLayerSourceKind;
  format: SpatialFormat;
  visible: boolean;
  color: string;
  geojson: GeoJsonFeatureCollection;
  featureCount: number;
  bounds?: [[number, number], [number, number]];
}

const LAYER_COLORS = ['#1074B1', '#52B197', '#A61B7A', '#F59E0B', '#8B5CF6', '#EC4899'];

export function pickLayerColor(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}

export function detectSpatialFormat(filenameOrUrl: string, content?: string): SpatialFormat {
  const lower = filenameOrUrl.toLowerCase().split('?')[0];
  if (lower.endsWith('.gpx')) return 'gpx';
  if (lower.endsWith('.kml')) return 'kml';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv')) return 'csv';
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'geojson';

  if (content) {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'geojson';
    if (trimmed.includes('<gpx')) return 'gpx';
    if (trimmed.includes('<kml')) return 'kml';
    if (trimmed.includes(',') && /\b(lat|latitude)\b/i.test(trimmed.split(/\r?\n/)[0] || '')) return 'csv';
  }
  return 'geojson';
}

function normalizeGeoJson(raw: any): GeoJsonFeatureCollection {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON/GeoJSON payload');
  }
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
    const valid = raw.features.filter((f: any) => f && f.type === 'Feature' && f.geometry);
    return { type: 'FeatureCollection', features: valid };
  }
  if (raw.type === 'Feature' && raw.geometry) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: raw.geometry, properties: raw.properties || {} }],
    };
  }
  if (raw.type && raw.coordinates) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: raw as GeoJsonGeometry, properties: {} }],
    };
  }
  throw new Error('Unsupported GeoJSON structure');
}

function parseCoordPairText(text: string): number[][] {
  return text
    .trim()
    .split(/\s+/)
    .map((tuple) => {
      const parts = tuple.split(',').map(Number);
      if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        return parts.length >= 3 && !Number.isNaN(parts[2])
          ? [parts[0], parts[1], parts[2]]
          : [parts[0], parts[1]];
      }
      return null;
    })
    .filter((c): c is number[] => c !== null);
}

export function parseGpxToGeoJson(xmlText: string): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = [];

  // Waypoints (<wpt lat="..." lon="...">)
  const wptRegex = /<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi;
  let match: RegExpExecArray | null;
  while ((match = wptRegex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const latMatch = /\blat=["']([^"']+)["']/i.exec(attrs);
    const lonMatch = /\blon=["']([^"']+)["']/i.exec(attrs);
    if (latMatch && lonMatch) {
      const lat = Number(latMatch[1]);
      const lng = Number(lonMatch[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(body);
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { name: nameMatch ? nameMatch[1].trim() : 'Waypoint', kind: 'waypoint' },
        });
      }
    }
  }

  // Tracks (<trk> ... <trkpt lat="..." lon="...">)
  const trkRegex = /<trk\b[^>]*>([\s\S]*?)<\/trk>/gi;
  while ((match = trkRegex.exec(xmlText)) !== null) {
    const trkBody = match[1];
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(trkBody);
    const coords: number[][] = [];
    const ptRegex = /<trkpt\b([^>]*)/gi;
    let ptMatch: RegExpExecArray | null;
    while ((ptMatch = ptRegex.exec(trkBody)) !== null) {
      const latMatch = /\blat=["']([^"']+)["']/i.exec(ptMatch[1]);
      const lonMatch = /\blon=["']([^"']+)["']/i.exec(ptMatch[1]);
      if (latMatch && lonMatch) {
        const lat = Number(latMatch[1]);
        const lng = Number(lonMatch[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) coords.push([lng, lat]);
      }
    }
    if (coords.length > 0) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { name: nameMatch ? nameMatch[1].trim() : 'GPX Track', kind: 'track' },
      });
    }
  }

  // Routes (<rte> ... <rtept lat="..." lon="...">)
  const rteRegex = /<rte\b[^>]*>([\s\S]*?)<\/rte>/gi;
  while ((match = rteRegex.exec(xmlText)) !== null) {
    const rteBody = match[1];
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(rteBody);
    const coords: number[][] = [];
    const ptRegex = /<rtept\b([^>]*)/gi;
    let ptMatch: RegExpExecArray | null;
    while ((ptMatch = ptRegex.exec(rteBody)) !== null) {
      const latMatch = /\blat=["']([^"']+)["']/i.exec(ptMatch[1]);
      const lonMatch = /\blon=["']([^"']+)["']/i.exec(ptMatch[1]);
      if (latMatch && lonMatch) {
        const lat = Number(latMatch[1]);
        const lng = Number(lonMatch[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) coords.push([lng, lat]);
      }
    }
    if (coords.length > 0) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { name: nameMatch ? nameMatch[1].trim() : 'GPX Route', kind: 'route' },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

export function parseKmlToGeoJson(xmlText: string): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = [];
  const placemarkRegex = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let match: RegExpExecArray | null;

  while ((match = placemarkRegex.exec(xmlText)) !== null) {
    const body = match[1];
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(body);
    const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(body);
    const props = {
      name: nameMatch ? nameMatch[1].trim() : 'Placemark',
      description: descMatch ? descMatch[1].trim() : '',
    };

    const pointMatch = /<Point\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i.exec(body);
    if (pointMatch) {
      const coords = parseCoordPairText(pointMatch[1]);
      if (coords.length > 0) {
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: props });
      }
    }

    const lineMatch = /<LineString\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i.exec(body);
    if (lineMatch) {
      const coords = parseCoordPairText(lineMatch[1]);
      if (coords.length > 0) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props });
      }
    }

    const polyMatch = /<Polygon\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/i.exec(body);
    if (polyMatch) {
      const coords = parseCoordPairText(polyMatch[1]);
      if (coords.length >= 3) {
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: props });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

export function parseCsvToGeoJson(csvText: string): GeoJsonFeatureCollection {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { type: 'FeatureCollection', features: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const splitRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitRow(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const latIdx = lowerHeaders.findIndex((h) => h === 'lat' || h === 'latitude' || h === 'y');
  const lngIdx = lowerHeaders.findIndex((h) => h === 'lng' || h === 'lon' || h === 'longitude' || h === 'x');
  if (latIdx === -1 || lngIdx === -1) {
    throw new Error('CSV must contain latitude (lat) and longitude (lng/lon) columns');
  }

  const features: GeoJsonFeature[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const lat = Number(cols[latIdx]);
    const lng = Number(cols[lngIdx]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    const props: Record<string, any> = {};
    headers.forEach((h, idx) => {
      if (idx !== latIdx && idx !== lngIdx && cols[idx] !== undefined) {
        props[h] = cols[idx].replace(/^"|"$/g, '');
      }
    });
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
    });
  }
  return { type: 'FeatureCollection', features };
}

export function computeGeoJsonBounds(
  geojson: GeoJsonFeatureCollection
): [[number, number], [number, number]] | undefined {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  const visitCoord = (coord: any) => {
    if (!Array.isArray(coord) || coord.length === 0) return;
    if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      const lng = coord[0];
      const lat = coord[1];
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      return;
    }
    for (const child of coord) visitCoord(child);
  };

  for (const f of geojson.features) {
    if (f.geometry?.coordinates) visitCoord(f.geometry.coordinates);
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return undefined;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export function parseSpatialTextToGeoJson(
  text: string,
  filenameOrUrl: string
): { format: SpatialFormat; geojson: GeoJsonFeatureCollection; featureCount: number; bounds?: [[number, number], [number, number]] } {
  const format = detectSpatialFormat(filenameOrUrl, text);
  let geojson: GeoJsonFeatureCollection;

  switch (format) {
    case 'gpx':
      geojson = parseGpxToGeoJson(text);
      break;
    case 'kml':
      geojson = parseKmlToGeoJson(text);
      break;
    case 'csv':
      geojson = parseCsvToGeoJson(text);
      break;
    case 'geojson':
    default:
      geojson = normalizeGeoJson(JSON.parse(text));
      break;
  }

  return {
    format,
    geojson,
    featureCount: geojson.features.length,
    bounds: computeGeoJsonBounds(geojson),
  };
}

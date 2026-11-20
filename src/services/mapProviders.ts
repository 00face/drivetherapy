/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Switchable Map Provider Registry
 * Supports Google Maps JS API (when configured) and zero-key FOSS/CC tile providers.
 */

export type MapProviderId =
  | 'google-maps'
  | 'osm'
  | 'carto-light'
  | 'carto-dark'
  | 'opentopomap'
  | 'offline-vector';

export interface MapProviderSpec {
  id: MapProviderId;
  label: string;
  shortLabel: string;
  license: string;
  attribution: string;
  tileUrl?: string;
  maxZoom: number;
  requiresKey: boolean;
  isFoss: boolean;
}

export const MAP_PROVIDERS: MapProviderSpec[] = [
  {
    id: 'google-maps',
    label: 'Google Maps',
    shortLabel: 'Google',
    license: 'Google Maps Platform',
    attribution: 'Map data © Google',
    maxZoom: 20,
    requiresKey: true,
    isFoss: false,
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    shortLabel: 'OSM',
    license: 'ODbL (FOSS)',
    attribution: '© OpenStreetMap contributors',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    requiresKey: false,
    isFoss: true,
  },
  {
    id: 'carto-light',
    label: 'Carto Positron',
    shortLabel: 'Carto Light',
    license: 'CC-BY 4.0',
    attribution: '© OpenStreetMap contributors © CARTO',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
    requiresKey: false,
    isFoss: true,
  },
  {
    id: 'carto-dark',
    label: 'Carto Dark Matter',
    shortLabel: 'Carto Dark',
    license: 'CC-BY 4.0',
    attribution: '© OpenStreetMap contributors © CARTO',
    tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
    requiresKey: false,
    isFoss: true,
  },
  {
    id: 'opentopomap',
    label: 'OpenTopoMap',
    shortLabel: 'Topo',
    license: 'CC-BY-SA 3.0',
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
    tileUrl: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
    requiresKey: false,
    isFoss: true,
  },
  {
    id: 'offline-vector',
    label: 'Offline Vector Grid',
    shortLabel: 'Offline',
    license: 'Built-in Zero-Network',
    attribution: 'Drive Therapy Built-in Vector Grid',
    maxZoom: 6,
    requiresKey: false,
    isFoss: true,
  },
];

export function resolveDefaultMapProvider(params: {
  hasGoogleMapsKey: boolean;
  isDarkMode?: boolean;
  isOffline?: boolean;
}): MapProviderId {
  if (params.isOffline) return 'offline-vector';
  if (params.hasGoogleMapsKey) return 'google-maps';
  return params.isDarkMode ? 'carto-dark' : 'osm';
}

export function getMapProviderSpec(id: MapProviderId): MapProviderSpec {
  return MAP_PROVIDERS.find((p) => p.id === id) || MAP_PROVIDERS[1];
}

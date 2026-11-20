/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive Multi-Provider World Map & Spatial Data Studio
 * - Auto-loads Google Maps JS API when GOOGLE_MAPS_API_KEY is configured,
 *   or automatically falls back to FOSS/CC Leaflet providers (OpenStreetMap, Carto, OpenTopoMap).
 * - Switchable map providers + built-in Offline Vector Grid fallback.
 * - Expanded Map Data Loader for GeoJSON, GPX, KML, and geotagged CSV from Local OS, Google Drive, or URLs.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Camera,
  Star,
  ExternalLink,
  Upload,
  Globe,
  HardDrive,
  Cloud,
  Eye,
  EyeOff,
  Trash2,
  KeyRound,
  Maximize2,
  X,
} from 'lucide-react';
import { MediaAsset } from '../types';
import { CodexHelpBadge } from './CodexHelpBadge';
import {
  MAP_PROVIDERS,
  MapProviderId,
  getMapProviderSpec,
  resolveDefaultMapProvider,
} from '../services/mapProviders';
import {
  LoadedMapLayer,
  MapLayerSourceKind,
  pickLayerColor,
  parseSpatialTextToGeoJson,
} from '../services/mapDataLoaderEngine';

interface WorldMapViewProps {
  assets: MediaAsset[];
  onSelectAsset: (asset: MediaAsset) => void;
  onOpenLightbox?: (asset: MediaAsset) => void;
}

interface GeoPoint {
  asset: MediaAsset;
  lat: number;
  lng: number;
}

interface MapCluster {
  id: string;
  lat: number;
  lng: number;
  items: GeoPoint[];
}

const GMAPS_KEY_STORAGE = 'dt_google_maps_api_key_v1';

declare global {
  interface Window {
    google?: any;
  }
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  assets,
  onSelectAsset,
  onOpenLightbox,
}) => {
  const [zoomLevel, setZoomLevel] = useState(2);
  const [activeCluster, setActiveCluster] = useState<MapCluster | null>(null);
  const [minRatingFilter, setMinRatingFilter] = useState(0);

  // Provider & Google Maps API Key state
  const [providerId, setProviderId] = useState<MapProviderId>('osm');
  const [googleMapsKey, setGoogleMapsKey] = useState<string>(() => {
    try {
      return localStorage.getItem(GMAPS_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [googleMapType, setGoogleMapType] = useState<'roadmap' | 'satellite' | 'terrain' | 'hybrid'>('roadmap');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [mapNotice, setMapNotice] = useState<string | null>(null);

  // Spatial Data Loader state
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingLayer, setIsLoadingLayer] = useState(false);
  const [layers, setLayers] = useState<LoadedMapLayer[]>([]);

  const leafletContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileRef = useRef<L.TileLayer | null>(null);
  const leafletClusterGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletDataGroupRef = useRef<L.LayerGroup | null>(null);

  const gmapContainerRef = useRef<HTMLDivElement | null>(null);
  const gmapInstanceRef = useRef<any>(null);
  const gmapMarkersRef = useRef<any[]>([]);
  const gmapDataLayersRef = useRef<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Probe server /api/maps/config on mount for GOOGLE_MAPS_API_KEY
  useEffect(() => {
    let active = true;
    const isDark = document.documentElement.classList.contains('dark');
    fetch('/api/maps/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (!active) return;
        const resolvedKey = cfg?.googleMapsApiKey || googleMapsKey;
        if (cfg?.googleMapsApiKey && !googleMapsKey) {
          setGoogleMapsKey(cfg.googleMapsApiKey);
        }
        const defaultProv = resolveDefaultMapProvider({
          hasGoogleMapsKey: Boolean(resolvedKey),
          isDarkMode: isDark,
          isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
        });
        setProviderId(defaultProv);
      })
      .catch(() => {
        if (!active) return;
        setProviderId(
          resolveDefaultMapProvider({
            hasGoogleMapsKey: Boolean(googleMapsKey),
            isDarkMode: isDark,
          })
        );
      });
    return () => {
      active = false;
    };
  }, []);

  // 1. Extract valid geotagged assets
  const geotaggedPoints: GeoPoint[] = useMemo(() => {
    const points: GeoPoint[] = [];
    for (const a of assets) {
      const lat = (a.exif as any)?.latitude ?? (a as any).latitude;
      const lng = (a.exif as any)?.longitude ?? (a as any).longitude;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        if (minRatingFilter > 0 && (a.rating || 0) < minRatingFilter) continue;
        points.push({ asset: a, lat, lng });
      }
    }
    return points;
  }, [assets, minRatingFilter]);

  // 2. Spatial Grid Clustering
  const clusters: MapCluster[] = useMemo(() => {
    const clusterMap = new Map<string, GeoPoint[]>();
    const gridSize = Math.max(0.25, 30 / Math.pow(1.5, zoomLevel));

    for (const pt of geotaggedPoints) {
      const gridX = Math.floor((pt.lng + 180) / gridSize);
      const gridY = Math.floor((pt.lat + 90) / gridSize);
      const key = `${gridX}_${gridY}`;
      const existing = clusterMap.get(key) || [];
      existing.push(pt);
      clusterMap.set(key, existing);
    }

    const result: MapCluster[] = [];
    let clusterIdx = 0;
    for (const [key, pts] of clusterMap.entries()) {
      let sumLat = 0;
      let sumLng = 0;
      for (const p of pts) {
        sumLat += p.lat;
        sumLng += p.lng;
      }
      result.push({
        id: `cluster_${key}_${clusterIdx++}`,
        lat: sumLat / pts.length,
        lng: sumLng / pts.length,
        items: pts,
      });
    }
    return result;
  }, [geotaggedPoints, zoomLevel]);

  // Spatial files available in Drive / Local catalog
  const catalogSpatialAssets = useMemo(() => {
    return assets.filter((a) => /\.(geojson|json|gpx|kml|csv|tsv)$/i.test(a.name));
  }, [assets]);

  // Initialize / tear down Leaflet for FOSS/CC tile providers
  useEffect(() => {
    const spec = getMapProviderSpec(providerId);
    if (providerId === 'offline-vector' || providerId === 'google-maps') {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletTileRef.current = null;
        leafletClusterGroupRef.current = null;
        leafletDataGroupRef.current = null;
      }
      return;
    }

    const container = leafletContainerRef.current;
    if (!container) return;

    if (!leafletMapRef.current) {
      const map = L.map(container, {
        center: [25, 0],
        zoom: Math.max(2, zoomLevel),
        zoomControl: false,
      });
      map.on('zoomend', () => {
        setZoomLevel(map.getZoom());
      });
      leafletMapRef.current = map;
      leafletClusterGroupRef.current = L.layerGroup().addTo(map);
      leafletDataGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = leafletMapRef.current;
    if (leafletTileRef.current) {
      map.removeLayer(leafletTileRef.current);
    }
    if (spec.tileUrl) {
      leafletTileRef.current = L.tileLayer(spec.tileUrl, {
        attribution: spec.attribution,
        maxZoom: spec.maxZoom,
      }).addTo(map);
    }
  }, [providerId]);

  // Sync clusters & spatial layers onto Leaflet
  useEffect(() => {
    const map = leafletMapRef.current;
    const clusterGroup = leafletClusterGroupRef.current;
    const dataGroup = leafletDataGroupRef.current;
    if (!map || !clusterGroup || !dataGroup || providerId === 'offline-vector' || providerId === 'google-maps') {
      return;
    }

    clusterGroup.clearLayers();
    for (const c of clusters) {
      const isSingle = c.items.length === 1;
      const icon = L.divIcon({
        className: 'dt-leaflet-pin',
        html: isSingle
          ? `<div style="width:28px;height:28px;border-radius:9999px;border:2px solid #fff;background:#1074B1;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,0.35);">1</div>`
          : `<div style="min-width:32px;height:28px;padding:0 8px;border-radius:9999px;border:2px solid #fff;background:linear-gradient(90deg,#1074B1,#52B197);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 4px 10px rgba(0,0,0,0.35);">${c.items.length}</div>`,
        iconSize: [32, 28],
        iconAnchor: [16, 14],
      });
      const marker = L.marker([c.lat, c.lng], { icon });
      marker.on('click', () => setActiveCluster(c));
      clusterGroup.addLayer(marker);
    }

    dataGroup.clearLayers();
    for (const layer of layers) {
      if (!layer.visible) continue;
      const geoLayer = L.geoJSON(layer.geojson as any, {
        style: () => ({
          color: layer.color,
          weight: 3,
          opacity: 0.9,
          fillOpacity: 0.25,
        }),
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            color: '#ffffff',
            weight: 2,
            fillColor: layer.color,
            fillOpacity: 0.9,
          }),
        onEachFeature: (feature, leafletLayer) => {
          const props = feature?.properties || {};
          const title = props.name || props.title || layer.name;
          const entries = Object.entries(props)
            .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
            .slice(0, 6)
            .map(([k, v]) => `<div><strong>${k}:</strong> ${String(v)}</div>`)
            .join('');
          leafletLayer.bindPopup(`<div style="font-size:12px;"><strong>${title}</strong>${entries}</div>`);
        },
      });
      dataGroup.addLayer(geoLayer);
    }
  }, [clusters, layers, providerId]);

  // Initialize / sync Google Maps JS API when providerId === 'google-maps'
  useEffect(() => {
    if (providerId !== 'google-maps') return;
    if (!googleMapsKey) {
      setShowKeyModal(true);
      setProviderId('osm');
      return;
    }

    let cancelled = false;
    const initGoogleMap = () => {
      if (cancelled || !gmapContainerRef.current || !window.google?.maps) return;
      if (!gmapInstanceRef.current) {
        gmapInstanceRef.current = new window.google.maps.Map(gmapContainerRef.current, {
          center: { lat: 25, lng: 0 },
          zoom: Math.max(2, zoomLevel),
          mapTypeId: googleMapType,
        });
      } else {
        gmapInstanceRef.current.setMapTypeId(googleMapType);
      }

      const gmap = gmapInstanceRef.current;

      // Clear old markers
      gmapMarkersRef.current.forEach((m) => m.setMap(null));
      gmapMarkersRef.current = [];
      for (const c of clusters) {
        const marker = new window.google.maps.Marker({
          position: { lat: c.lat, lng: c.lng },
          map: gmap,
          label: String(c.items.length),
          title: `${c.items.length} photo(s)`,
        });
        marker.addListener('click', () => setActiveCluster(c));
        gmapMarkersRef.current.push(marker);
      }

      // Clear old GeoJSON data layers
      gmapDataLayersRef.current.forEach((dl) => dl.setMap(null));
      gmapDataLayersRef.current = [];
      for (const layer of layers) {
        if (!layer.visible) continue;
        const dataLayer = new window.google.maps.Data({ map: gmap });
        dataLayer.addGeoJson(layer.geojson);
        dataLayer.setStyle({
          strokeColor: layer.color,
          fillColor: layer.color,
          strokeWeight: 3,
          fillOpacity: 0.25,
        });
        gmapDataLayersRef.current.push(dataLayer);
      }
    };

    if (window.google?.maps) {
      initGoogleMap();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-dt-gmaps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', initGoogleMap, { once: true });
      } else {
        const script = document.createElement('script');
        script.dataset.dtGmaps = 'true';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = initGoogleMap;
        script.onerror = () => {
          if (cancelled) return;
          setMapNotice('Google Maps failed to load (check API key or network). Switched to OpenStreetMap.');
          setProviderId('osm');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [providerId, googleMapsKey, googleMapType, clusters, layers]);

  const addParsedLayer = (text: string, name: string, sourceKind: MapLayerSourceKind) => {
    const parsed = parseSpatialTextToGeoJson(text, name);
    const layer: LoadedMapLayer = {
      id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      sourceKind,
      format: parsed.format,
      visible: true,
      color: pickLayerColor(layers.length),
      geojson: parsed.geojson,
      featureCount: parsed.featureCount,
      bounds: parsed.bounds,
    };
    setLayers((prev) => [...prev, layer]);
    setMapNotice(`Loaded ${layer.name} (${layer.featureCount} features · ${layer.format.toUpperCase()})`);

    if (layer.bounds && leafletMapRef.current) {
      leafletMapRef.current.fitBounds(layer.bounds, { padding: [32, 32] });
    }
  };

  const handleLoadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = urlInput.trim();
    if (!target) return;
    setIsLoadingLayer(true);
    setMapNotice(null);
    try {
      let text = '';
      const proxyRes = await fetch('/api/maps/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        text = data.content || '';
      } else {
        const err = await proxyRes.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${proxyRes.status}`);
      }
      const shortName = target.split('/').pop()?.split('?')[0] || 'remote-layer.geojson';
      addParsedLayer(text, shortName, 'url');
      setUrlInput('');
    } catch (err: any) {
      setMapNotice(`URL Load Error: ${err?.message || 'Unable to load spatial data'}`);
    } finally {
      setIsLoadingLayer(false);
    }
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoadingLayer(true);
    setMapNotice(null);
    try {
      const text = await file.text();
      addParsedLayer(text, file.name, 'local');
    } catch (err: any) {
      setMapNotice(`File Parse Error: ${err?.message || 'Invalid spatial file'}`);
    } finally {
      setIsLoadingLayer(false);
      e.target.value = '';
    }
  };

  const handleLoadCatalogAsset = async (asset: MediaAsset) => {
    setIsLoadingLayer(true);
    setMapNotice(null);
    try {
      let text = '';
      if (asset.localPath) {
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(asset.localPath)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } else if ((asset as any).driveFileId || asset.id.startsWith('drive_')) {
        const id = (asset as any).driveFileId || asset.id.replace(/^drive_/, '');
        const res = await fetch(`/api/drive/stream/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } else if (asset.cloudUrl || (asset as any).streamUrl || (asset as any).downloadUrl) {
        const url = asset.cloudUrl || (asset as any).streamUrl || (asset as any).downloadUrl;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } else {
        throw new Error('No readable path or Drive ID for this spatial file');
      }
      addParsedLayer(text, asset.name, asset.localPath ? 'local' : 'drive');
    } catch (err: any) {
      setMapNotice(`Asset Load Error: ${err?.message || 'Failed to read spatial file'}`);
    } finally {
      setIsLoadingLayer(false);
    }
  };

  const handleZoom = (delta: number) => {
    if (leafletMapRef.current && providerId !== 'offline-vector' && providerId !== 'google-maps') {
      if (delta > 0) leafletMapRef.current.zoomIn();
      else leafletMapRef.current.zoomOut();
      return;
    }
    if (gmapInstanceRef.current && providerId === 'google-maps') {
      const cur = gmapInstanceRef.current.getZoom() || 2;
      gmapInstanceRef.current.setZoom(Math.max(1, Math.min(20, cur + delta)));
      return;
    }
    setZoomLevel((z) => Math.max(1, Math.min(18, z + delta)));
  };

  const handleSaveGoogleKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = keyDraft.trim();
    setGoogleMapsKey(cleaned);
    try {
      if (cleaned) localStorage.setItem(GMAPS_KEY_STORAGE, cleaned);
      else localStorage.removeItem(GMAPS_KEY_STORAGE);
    } catch {}
    setShowKeyModal(false);
    if (cleaned) setProviderId('google-maps');
  };

  // Project lat/lng to 0..100% canvas coordinates for Offline Vector fallback
  const projectToPercent = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
  };

  const activeSpec = getMapProviderSpec(providerId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-6 gap-3">
      {/* Top Map Header Controls */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-3xl border shadow-sm theme-card"
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#1074B1]/10 text-[#1074B1]">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Interactive World Map</h1>
              <CodexHelpBadge topicId="map-studio" />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#52B197]/15 text-[#52B197]">
                {activeSpec.label} · {activeSpec.license}
              </span>
            </div>
            <p className="text-xs text-hint-inline">
              {geotaggedPoints.length} of {assets.length} photos geotagged · {layers.length} spatial layer(s)
            </p>
          </div>
        </div>

        {/* Provider Switcher + Data Loader + Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switchable Map Providers */}
          <div
            className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 text-xs font-semibold overflow-x-auto"
            role="group"
            aria-label="Map API Provider Switcher"
          >
            {MAP_PROVIDERS.map((prov) => (
              <button
                key={prov.id}
                type="button"
                onClick={() => {
                  if (prov.id === 'google-maps' && !googleMapsKey) {
                    setKeyDraft(googleMapsKey);
                    setShowKeyModal(true);
                    return;
                  }
                  setProviderId(prov.id);
                }}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  providerId === prov.id
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title={`${prov.label} (${prov.license})`}
              >
                {prov.shortLabel}
              </button>
            ))}
          </div>

          {providerId === 'google-maps' && (
            <select
              value={googleMapType}
              onChange={(e) => setGoogleMapType(e.target.value as any)}
              className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs font-semibold"
              aria-label="Google Maps Style"
            >
              <option value="roadmap">Roadmap</option>
              <option value="satellite">Satellite</option>
              <option value="terrain">Terrain</option>
              <option value="hybrid">Hybrid</option>
            </select>
          )}

          {/* Google Maps Key Button */}
          <button
            type="button"
            onClick={() => {
              setKeyDraft(googleMapsKey);
              setShowKeyModal(true);
            }}
            className="min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#1074B1] text-xs font-semibold flex items-center gap-1.5"
            title="Configure Google Maps API Key"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#1074B1]" />
            <span>{googleMapsKey ? 'GMaps Key Set' : 'GMaps Key'}</span>
          </button>

          {/* Load Map Data Toggle */}
          <button
            type="button"
            onClick={() => setShowDataPanel((v) => !v)}
            className={`min-h-[38px] px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              showDataPanel
                ? 'bg-[#52B197] text-white border-[#52B197]'
                : 'border-slate-200 dark:border-slate-700 hover:border-[#52B197]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Load Map Data ({layers.length})</span>
          </button>

          {/* Star Filter */}
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 text-xs font-semibold">
            {[0, 3, 4, 5].map((stars) => (
              <button
                key={stars}
                type="button"
                onClick={() => setMinRatingFilter(stars)}
                className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  minRatingFilter === stars
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {stars === 0 ? 'All' : <><Star className="w-3 h-3 fill-current" /> {stars}+</>}
              </button>
            ))}
          </div>

          {/* Zoom In/Out */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => handleZoom(-1)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold px-1.5 tabular-nums">{zoomLevel}x</span>
            <button
              type="button"
              onClick={() => handleZoom(1)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {mapNotice && (
        <div className="px-4 py-2 rounded-2xl bg-[#1074B1]/10 border border-[#1074B1]/30 text-xs font-medium flex items-center justify-between">
          <span>{mapNotice}</span>
          <button type="button" onClick={() => setMapNotice(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Map Canvas Area */}
      <div className="flex-1 min-h-[440px] rounded-3xl border border-slate-200/80 dark:border-slate-800 relative overflow-hidden bg-[#1E293B] shadow-inner select-none">
        {/* Leaflet Container (OSM / Carto / OpenTopoMap) */}
        <div
          ref={leafletContainerRef}
          className={`absolute inset-0 w-full h-full ${
            providerId !== 'offline-vector' && providerId !== 'google-maps' ? 'block' : 'hidden'
          }`}
        />

        {/* Google Maps Container */}
        <div
          ref={gmapContainerRef}
          className={`absolute inset-0 w-full h-full ${providerId === 'google-maps' ? 'block' : 'hidden'}`}
        />

        {/* Offline Vector Fallback */}
        {providerId === 'offline-vector' && (
          <>
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:24px_24px]" />
            <svg
              viewBox="0 0 1000 500"
              className="absolute inset-0 w-full h-full opacity-35 pointer-events-none preserve-3d"
              fill="none"
              stroke="#64748B"
              strokeWidth="1.5"
            >
              <path d="M150,80 Q220,90 240,150 Q280,210 240,280 Q290,380 250,450 Q210,400 200,310 Q160,240 120,180 Z" fill="#334155" />
              <path d="M480,80 Q620,60 780,120 Q840,180 820,260 Q720,280 620,220 Q540,260 490,200 Z" fill="#334155" />
              <path d="M480,220 Q580,240 560,360 Q520,440 460,380 Q440,300 480,220 Z" fill="#334155" />
              <path d="M780,320 Q860,330 850,410 Q790,430 760,380 Z" fill="#334155" />
            </svg>
            {clusters.map((cluster) => {
              const { x, y } = projectToPercent(cluster.lat, cluster.lng);
              const isSingle = cluster.items.length === 1;
              const heroAsset = cluster.items[0].asset;
              return (
                <div
                  key={cluster.id}
                  onClick={() => setActiveCluster(cluster)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 z-20"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={`${cluster.items.length} photo(s) at ${cluster.lat.toFixed(2)}, ${cluster.lng.toFixed(2)}`}
                >
                  {isSingle ? (
                    <div className="w-8 h-8 rounded-full border-2 border-white shadow-lg overflow-hidden bg-slate-900 ring-2 ring-[#1074B1]">
                      {heroAsset.thumbnailUrl ? (
                        <img src={heroAsset.thumbnailUrl} alt={heroAsset.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white">
                          <MapPin className="w-4 h-4 text-[#1074B1]" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center min-w-[32px] h-8 px-2 rounded-full bg-gradient-to-r from-[#1074B1] to-[#52B197] text-white text-xs font-bold font-mono border-2 border-white shadow-xl">
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      <span>{cluster.items.length}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Map Data Loader & Layer Manager Drawer */}
        {showDataPanel && (
          <div
            className="absolute top-4 left-4 w-88 max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] rounded-3xl border shadow-2xl p-4 flex flex-col gap-3 z-[450] backdrop-blur-md theme-card overflow-y-auto"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4 text-[#52B197]" />
                <span>Spatial Data &amp; Layers</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDataPanel(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Load from URL */}
            <form onSubmit={handleLoadUrl} className="space-y-1.5">
              <label className="text-[11px] font-bold flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>Load from HTTPS URL (GeoJSON / GPX / KML / CSV)</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/trails.geojson"
                  className="flex-1 min-h-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                />
                <button
                  type="submit"
                  disabled={isLoadingLayer || !urlInput.trim()}
                  className="min-h-[38px] px-3 rounded-xl bg-[#1074B1] text-white text-xs font-bold disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </form>

            {/* Load from Local Storage */}
            <div className="space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json,.gpx,.kml,.csv,.tsv"
                onChange={handleLocalFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingLayer}
                className="w-full min-h-[40px] px-3 rounded-xl border border-dashed border-[#52B197]/60 hover:bg-[#52B197]/10 text-xs font-bold flex items-center justify-center gap-2"
              >
                <HardDrive className="w-4 h-4 text-[#52B197]" />
                <span>Import from Local Storage (.geojson, .gpx, .kml, .csv)</span>
              </button>
            </div>

            {/* Load from Google Drive / Catalog */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-[#1074B1]" />
                <span>Catalog / Google Drive Spatial Files ({catalogSpatialAssets.length})</span>
              </div>
              {catalogSpatialAssets.length === 0 ? (
                <p className="text-[11px] text-hint-inline">
                  No .geojson, .gpx, .kml, or .csv files indexed yet.
                </p>
              ) : (
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {catalogSpatialAssets.slice(0, 12).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleLoadCatalogAsset(a)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70 hover:border-[#1074B1] flex items-center justify-between text-xs text-left"
                    >
                      <span className="truncate font-medium">{a.name}</span>
                      <Upload className="w-3.5 h-3.5 text-[#1074B1] shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Layers */}
            {layers.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="text-[11px] font-bold">Active Map Layers</div>
                {layers.map((layer) => (
                  <div
                    key={layer.id}
                    className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{layer.name}</div>
                        <div className="text-[10px] text-hint-inline">
                          {layer.featureCount} features · {layer.format.toUpperCase()} · {layer.sourceKind}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {layer.bounds && (
                        <button
                          type="button"
                          onClick={() => leafletMapRef.current?.fitBounds(layer.bounds!, { padding: [32, 32] })}
                          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                          title="Zoom to layer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setLayers((prev) =>
                            prev.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l))
                          )
                        }
                        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                        title={layer.visible ? 'Hide layer' : 'Show layer'}
                      >
                        {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-50" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLayers((prev) => prev.filter((l) => l.id !== layer.id))}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-rose-500"
                        title="Remove layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Google Maps Key Modal */}
        {showKeyModal && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-[500] p-4">
            <form
              onSubmit={handleSaveGoogleKey}
              className="w-full max-w-md rounded-3xl border p-5 shadow-2xl space-y-3 theme-card"
              style={{
                backgroundColor: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#1074B1]" />
                  <span>Google Maps API Key</span>
                </h2>
                <button type="button" onClick={() => setShowKeyModal(false)} className="p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-hint-inline">
                Enter your Google Maps JavaScript API key (or set <code>GOOGLE_MAPS_API_KEY</code> in <code>.env</code>). Without a key, Drive Therapy uses FOSS OpenStreetMap / Carto / OpenTopoMap automatically.
              </p>
              <input
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="AIza..."
                className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[38px] px-4 rounded-xl bg-[#1074B1] text-white text-xs font-bold"
                >
                  Save &amp; Use Google Maps
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cluster Inspector Drawer Popover */}
        {activeCluster && (
          <div
            className="absolute bottom-6 right-6 w-96 max-h-96 rounded-3xl border shadow-2xl p-4 flex flex-col z-[450] animate-fade-in backdrop-blur-md theme-card"
            style={{
              backgroundColor: 'var(--theme-surface)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text)',
            }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1074B1]" />
                <span className="text-xs font-bold">
                  {activeCluster.items.length} Photos at {activeCluster.lat.toFixed(2)}°, {activeCluster.lng.toFixed(2)}°
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCluster(null)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2.5 space-y-2">
              {activeCluster.items.map((pt) => (
                <div
                  key={pt.asset.id}
                  onClick={() => onSelectAsset(pt.asset)}
                  className="p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60 hover:border-[#1074B1] flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
                    {pt.asset.thumbnailUrl ? (
                      <img src={pt.asset.thumbnailUrl} alt={pt.asset.name} className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 m-auto text-slate-400 h-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{pt.asset.name}</div>
                    <div className="text-[10px] text-hint-inline">
                      {pt.asset.cameraModel || 'Camera'} • {pt.asset.rating ? `${pt.asset.rating}★` : 'Unrated'}
                    </div>
                  </div>
                  {onOpenLightbox && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLightbox(pt.asset);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1074B1]"
                      title="Open full view"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

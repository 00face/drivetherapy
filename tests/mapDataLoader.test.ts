import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_PROVIDERS,
  resolveDefaultMapProvider,
} from '../src/services/mapProviders';
import {
  parseSpatialTextToGeoJson,
  detectSpatialFormat,
} from '../src/services/mapDataLoaderEngine';
import {
  CPU_MINI_MODEL_CATALOG,
  isBrowserMiniModelsEnabled,
} from '../src/services/localMiniModelEngine';

describe('Multi-Provider Map Engine & Spatial Data Loader', () => {
  it('resolveDefaultMapProvider selects Google Maps when key present, else FOSS OSM/Carto/Offline', () => {
    assert.equal(
      resolveDefaultMapProvider({ hasGoogleMapsKey: true, isDarkMode: false }),
      'google-maps'
    );
    assert.equal(
      resolveDefaultMapProvider({ hasGoogleMapsKey: false, isDarkMode: false }),
      'osm'
    );
    assert.equal(
      resolveDefaultMapProvider({ hasGoogleMapsKey: false, isDarkMode: true }),
      'carto-dark'
    );
    assert.equal(
      resolveDefaultMapProvider({ hasGoogleMapsKey: true, isOffline: true }),
      'offline-vector'
    );
    assert.ok(MAP_PROVIDERS.filter((p) => p.isFoss).length >= 4);
  });

  it('parses GeoJSON FeatureCollection and computes bounds', () => {
    const raw = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-97.7431, 30.2672] }, properties: { name: 'Austin' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] }, properties: { name: 'SF' } },
      ],
    });
    const parsed = parseSpatialTextToGeoJson(raw, 'cities.geojson');
    assert.equal(parsed.format, 'geojson');
    assert.equal(parsed.featureCount, 2);
    assert.deepEqual(parsed.bounds, [
      [30.2672, -122.4194],
      [37.7749, -97.7431],
    ]);
  });

  it('parses GPX waypoints and tracks into GeoJSON features', () => {
    const gpx = `<?xml version="1.0"?>
    <gpx version="1.1">
      <wpt lat="45.5" lon="-122.6"><name>Camp</name></wpt>
      <trk><name>Trail</name><trkseg>
        <trkpt lat="45.5" lon="-122.6"></trkpt>
        <trkpt lat="45.6" lon="-122.5"></trkpt>
      </trkseg></trk>
    </gpx>`;
    const parsed = parseSpatialTextToGeoJson(gpx, 'hike.gpx');
    assert.equal(parsed.format, 'gpx');
    assert.equal(parsed.featureCount, 2);
    assert.equal(parsed.geojson.features[0].geometry.type, 'Point');
    assert.equal(parsed.geojson.features[1].geometry.type, 'LineString');
  });

  it('parses KML Placemarks into GeoJSON features', () => {
    const kml = `<kml><Document><Placemark><name>Peak</name><Point><coordinates>-105.5,40.2,3000</coordinates></Point></Placemark></Document></kml>`;
    const parsed = parseSpatialTextToGeoJson(kml, 'peak.kml');
    assert.equal(parsed.format, 'kml');
    assert.equal(parsed.featureCount, 1);
    assert.deepEqual(parsed.geojson.features[0].geometry.coordinates, [-105.5, 40.2, 3000]);
  });

  it('parses geotagged CSV rows into GeoJSON Point features', () => {
    const csv = `name,lat,lng,elevation\nBase,39.7392,-104.9903,1609\nSummit,39.5883,-105.6438,4348`;
    assert.equal(detectSpatialFormat('points.csv', csv), 'csv');
    const parsed = parseSpatialTextToGeoJson(csv, 'points.csv');
    assert.equal(parsed.format, 'csv');
    assert.equal(parsed.featureCount, 2);
    assert.equal(parsed.geojson.features[0].properties.name, 'Base');
  });

  it('exposes CPU-only mini-model catalog for OCR, text, code, image, and audio', () => {
    const tasks = new Set(CPU_MINI_MODEL_CATALOG.map((m) => m.task));
    assert.ok(tasks.has('ocr'));
    assert.ok(tasks.has('text-chat'));
    assert.ok(tasks.has('code'));
    assert.ok(tasks.has('image-caption'));
    assert.ok(tasks.has('audio-transcribe'));
    assert.equal(isBrowserMiniModelsEnabled(), false);
  });
});

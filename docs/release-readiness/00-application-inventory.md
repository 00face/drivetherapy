# Phase 00 — Application Inventory & Baseline Establishment

- **Application**: Drive Therapy `v2.2.0`
- **Repository Revision**: `4c4763d`
- **Runtime Baseline**: Node.js `v22.23.2`, npm `12.0.2`, Linux `x64`
- **Generated At**: `2026-11-20T17:46:06.682Z`
- **Gate 00 Status**: **PASS**

## 1. System Architecture & Entry Points

| Layer | Entry Point / Directory | Count / Details | Status |
| :--- | :--- | :--- | :--- |
| Backend Gateway | `server.ts` + `server/` | 8 modular TypeScript server modules (OAuth 2.0 PKCE, AES-256-GCM session vault, Drive/GCS/External Cloud stream proxies, Loopback FS API, Hero Links, OpenSharing v1, 4-Tier Malware Scanner, Access Policy, Observability) | PASS |
| Frontend Shell | `src/main.tsx`, `src/App.tsx` | 9 studio views, cross-window auth sync, Vim/keyboard navigation, 52 themes, 20 languages | PASS |
| Business Services | `src/services/` | 94 modular engines (IndexedDB catalog, music engine, LUT/WebGL grading, CDC delta sync, CRDT conflict solver, zero-knowledge AES-256-GCM vault, enterprise sharing/DLP) | PASS |
| UI Components | `src/components/` | 92 React 19 components (WCAG 2.2 AAA target compliance) | PASS |
| Background Workers | `src/workers/` | 1 isolated workers (`vision.worker.ts` pure TS offline dHash/EXIF/quality analysis) | PASS |
| Desktop Packaging | `electron/main.ts`, `electron/windowDecoration.ts` | Cross-OS & Linux WM (GNOME, KDE, Hyprland, Sway, i3, XFCE, X11/Wayland) native window frame negotiation | PASS |
| Automated Tests | `tests/*.test.ts` | 78 test files, **476 passing tests across 109 suites** | PASS |

## 2. External Integration Inventory

| Integration | Protocol / Endpoint | Auth / Fallback Behavior | Status |
| :--- | :--- | :--- | :--- |
| Google OAuth 2.0 & Drive v3 | `/api/auth/google/*`, `/api/drive/stream/:fileId` | OAuth 2.0 + PKCE + AES-256-GCM `HttpOnly` session vault (`dt_sid`) | PASS |
| Google Gemini AI | `/api/gemini/*` | Server-proxied API key; 100% offline fallback to `vision.worker.ts` when key is absent | PASS |
| 15 External Cloud Providers | `/api/clouds/*` | Capabilities matrix, health check, folder browser, byte-range stream proxy, transfer job registry | PASS |
| Databricks OpenSharing v1 | `/api/opensharing/*` | Delta Sharing v1 REST protocol + `.share` Bearer profile generator | PASS |
| 4-Tier Malware & Threat Intel | `/api/security/*` | Tier 0 Offline Heuristics (always active), Tier 1 Hash/URL Lookup, Tier 2 Opt-in Sandbox, Tier 3 Local ClamAV | PASS |

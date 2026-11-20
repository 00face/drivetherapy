# Phase 12 — Application Lifecycle and State Management Audit

- **Gate 12 Status**: **PASS**

| Lifecycle State Transition | Mechanism | Verified Invariant | Test Evidence | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Fresh Startup & Port Negotiation** | `serverPortManager.ts` | Reclaims stale instance or advances to clean port `3010+` (never binds GlassBoy port `3009`) and writes `.runtime-server.json` | `tests/serverPortManager.test.ts` | PASS |
| **Concurrent Multi-Account Sign-In / Switch / Sign-Out** | `sessionVault.ts` + `ButlerConciergeWidget.tsx` | Adding User B preserves User A; signing out User B promotes User A; signing out last user leaves anonymous state | `tests/wo113MultiUserAuthLifecycle.test.ts` | PASS |
| **Hero Link Create → Update → Restart → Revoke** | `server/routes/heroLinks.ts` | Canonical `/s/:slug` persists to `.hero-links-store.json`, reloads across server restarts, and returns `404` after `DELETE` revocation | `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **Service Worker Upgrade & Cache Bust** | `public/sw.js` (`v2.7.0`) | Evicts stale sprite caches and serves `?v=bust2` with `Cache-Control: no-cache, must-revalidate` | `tests/wo110SpriteUrlCacheBust.test.ts` | PASS |
| **Factory Reset / Uninstallation Cleanup** | `storageJanitor.ts` (`flushAllStorage`) | Atomically wipes server vault, IndexedDB, Cache API, Service Workers, Web Storage, and cookies | `tests/wo111AtomicStorageFlush.test.ts` | PASS |

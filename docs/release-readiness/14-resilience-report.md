# Phase 14 — Reliability, Resilience and Failure Recovery Report

- **Gate 14 Status**: **PASS**

| Failure Scenario | Containment & Recovery Mechanism | Verification Evidence | Status |
| :--- | :--- | :--- | :--- |
| **Offline / Zero API Keys** | 100% of core curation, EXIF/dHash clustering (`vision.worker.ts`), LUT grading, CDC delta sync, CRDT conflict resolution, and Tier 0 malware heuristics run offline without external keys | `tests/wo115SettingsWindowAndCloudPowerSuite.test.ts`, `tests/wo116HeroLinksDlpOpenSharingMalware.test.ts` | PASS |
| **Missing Local ClamAV Daemon** | `isLocalClamAvAvailable()` probes `PATH` safely; when absent, `/api/security/scan-local` falls back to Tier 0 offline heuristics and sets `localClamAvAvailable: false` | `tests/wo116HeroLinksDlpOpenSharingMalware.test.ts` | PASS |
| **Port Conflict on Startup** | `serverPortManager.ts` probes `0.0.0.0` and `127.0.0.1`, skips port `3009`, and binds the next clean port `3010+` | `tests/serverPortManager.test.ts` | PASS |
| **Concurrent Edit Conflicts Across Devices** | `resolveCrdtConflict()` uses deterministic vector-clock comparison (`local-wins`, `remote-wins`, or `concurrent-fork` preserving both copies) | `tests/wo115SettingsWindowAndCloudPowerSuite.test.ts` | PASS |
| **Server Restart Mid-Session** | Encrypted `.session-vault.enc` and `.hero-links-store.json` reload automatically from disk on startup | `tests/wo113MultiUserAuthLifecycle.test.ts`, `tests/wo117UniversalReleaseHardening.test.ts` | PASS |

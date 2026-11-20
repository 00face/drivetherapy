# 03 — Cloud Power Suite, Zero-Knowledge Vault & Multicloud

The **Cloud Power Suite** (`src/services/cloudPowerSuiteEngine.ts` and `src/components/CloudPowerSuitePanel.tsx`) provides local-first cryptography, delta-sync algorithms, storage analytics, and multi-cloud adapter workflows.

---

## 1. Client-Side Zero-Knowledge AES-256-GCM Vault

Encrypts sensitive notes or files directly in your browser using the WebCrypto API before they are saved to disk or uploaded to a cloud drive:
- **Key Derivation**: `PBKDF2-SHA256` with **`210,000` iterations** and a cryptographically random 16-byte salt.
- **Authenticated Encryption**: `AES-256-GCM` with a random 12-byte initialization vector (IV) and 128-bit authentication tag.
- **Zero Server Knowledge**: Your passphrase never leaves your browser tab.

---

## 2. Content-Defined Chunking (CDC) Delta Sync & 30-Day Version Time-Machine

- Splits files into variable-length content-addressed chunks using a rolling Rabin-style polynomial hash (`computeCdcChunks`), computing per-chunk SHA-256 digests.
- When a file is modified, only the changed byte chunks need to be transferred (`computeDeltaSyncDiff`), and prior chunk manifests can be bookmarked in a local 30-day version history.

---

## 3. CRDT Vector-Clock Conflict Solver

- Tracks concurrent file edits across multiple devices or sessions using deterministic vector clocks (`compareVectorClocks` / `resolveCrdtConflict`).
- Automatically resolves strictly causal updates (`local-wins` or `remote-wins`) while safely preserving both versions (`concurrent-fork`) whenever two devices edit the same file offline at the same time.

---

## 4. Storage Treemap, Cross-Cloud Deduplication & 15 Cloud Connector Adapters

- **Storage Treemap & Deduplication**: Aggregates your catalog by category and content hash to identify duplicate files across folders or providers.
- **15 Cloud Connector Adapters (`/api/clouds/*`)**: Includes capability definitions, mount-command generators (`rclone` / FUSE / WebDAV), and adapter endpoints for Google Drive, Dropbox, Microsoft OneDrive, Box, iCloud Drive, Amazon S3, Cloudflare R2, Backblaze B2, MEGA, Proton Drive, Nextcloud, ownCloud, pCloud, Synology DSM, and SFTP/SSH.
  - *Forthright Note*: Live Google Drive browsing and streaming work directly through your Google OAuth 2.0 session; connecting external third-party clouds to live remote buckets requires supplying your own provider credentials or local `rclone`/WebDAV mounts.

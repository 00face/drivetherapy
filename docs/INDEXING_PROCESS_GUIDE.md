# Drive Therapy: Granular Indexing & Session Reconciliation Guide

## 1. Overview & Visualizer Compatibility

The file [`docs/indexing_process.graphml`](file:///home/face/Documents/Documents/code/drivetherapy/docs/indexing_process.graphml) models the end-to-end indexing engine, multi-tier scanning architecture, concurrency mutex locks, progressive batch streaming, abort signal cancellation, and the 5-step atomic session teardown lifecycle.

### Recommended Visualizers
- **Draw.io / diagrams.net**: Navigate to `File` &rarr; `Open From` &rarr; `Device` &rarr; select `docs/indexing_process.graphml`.
- **yEd Graph Editor**: Open directly. Use `Layout` &rarr; `Hierarchical` with orientation `Top to Bottom`.
- **Gephi**: Import as Directed Graph to inspect network topology.
- **Cytoscape**: Standard XML import with automatic hierarchical or organic layout.

---

## 2. Seven Functional Clusters

### Cluster 1: Authentication & Dispatch Gates
- **`N_START_TRIGGER`**: User-directed scan request originating from `StorageSidebar`, `CentralOmnibox`, or `FileManagerView`.
- **`N_AUTH_PREFLIGHT_GATE`**: Strict gate verifying `user !== null` and `getDriveAccessToken() !== null`. If unauthenticated, scanning is rejected immediately with a friendly warning toast; no network calls or phantom tasks are created.
- **`N_MUTEX_CONCURRENCY_GATE`**: Synchronous `isScanningRef.current` lock preventing simultaneous duplicate scan executions.

### Cluster 2: Initialization & Tier Separation
- **`N_SCAN_INIT`**: Instantiates a fresh `AbortController`, generates unique task ID, mounts task in `tasks` state.
- **`N_DRAWER_TASK_MOUNT`**: Mounts card in [`FloatingSyncDrawer.tsx`](file:///home/face/Documents/Documents/code/drivetherapy/src/components/FloatingSyncDrawer.tsx) with live progress bar and Cancel button.
- **`N_SCAN_TIER_BRANCH`**:
  1. **Quick Scan (Latest 300)**: `maxItems = 300`, `maxFolders = 200`.
  2. **Targeted Folder Scan**: `maxItems = 0` (unbounded within folder), targeted query `'${folderId}' in parents`.
  3. **Unbounded Deep Scan**: `maxItems = 0` (unbounded across entire drive), `maxFolders = 0` (all folders).

### Cluster 3: Fast vs Deep Folder Discovery Pipeline
- **`N_QUICK_FOLDER_DISCOVERY`**: In quick scan mode, queries Google Drive folders with `pageSize = 200` bounded to a single roundtrip, finishing folder discovery in $<1$ second rather than recursively crawling thousands of nested folders.
- **`N_TARGETED_FOLDER_RESOLVE`**: Resolves target folder metadata directly from active catalog or targeted query.
- **`N_UNBOUNDED_FOLDER_DISCOVERY`**: In deep scan mode, paginates all folders with circular hierarchy protection.
- **`N_FOLDER_PATH_RECONSTRUCT`**: Runs `buildFolderPath` to construct human-readable paths (`/Photos/2026/Studio`) and populates `folderMap`.

### Cluster 4: File Streaming & Pagination Loop
- **`N_DISPATCH_FILES_QUERY`**: Dispatches `files.list` with `orderBy=modifiedTime desc`, `mimeType != folder`, and page size (300 for quick, 1000 for deep).
- **`N_RECEIVE_PAGE_BATCH`**: Maps raw Drive files to `MediaAsset` records with resolved folder paths.
- **`N_PROGRESSIVE_UI_STREAM`**: Streams arriving pages directly to the UI (`setAssets`) in real time.
- **`N_UPDATE_TELEMETRY`**: Updates percentage and task status in `FloatingSyncDrawer`.
- **`N_PAGINATION_TERMINATION_GATE`**: Terminates when `nextPageToken` is exhausted or when `loadedCount >= maxItems` (in quick scan mode).

### Cluster 5: Post-Scan Analysis & Persistence
- **`N_BURST_CLUSTERING`**: Groups captures within 3.5s window and calculates sharpness score to crown hero photos (`isBurstHero`).
- **`N_FOLDER_COUNT_AGGREGATION`**: Computes accurate item counts per parent folder.
- **`N_PERSIST_INDEXEDDB`**: Commits catalog assets and folders to IndexedDB object stores.
- **`N_SCAN_COMPLETE_TOAST`**: Sets task to 100% complete, plays checkmark icon, and displays summary toast.

### Cluster 6: Cancellation, Error & Recovery
- **`N_USER_CANCEL_CLICK`**: User clicks Cancel button on running task.
- **`N_ABORT_SIGNAL_FIRED`**: `abortControllerRef.current.abort()` halts in-flight HTTP streams immediately.
- **`N_CANCEL_CLEANUP`**: Releases mutex lock, marks task failed/cancelled, and preserves already streamed assets.
- **`N_OAUTH_EXPIRED_INTERCEPT`**: Catches 401 Unauthorized or `OAuthExpiredError` mid-scan.
- **`N_AUTO_CLEAN_EXPIRED_SESSION`**: Automatically purges stale session credentials and prompts renewal.

### Cluster 7: Universal Session Teardown & Reconciliation
- **`N_MANUAL_DISCONNECT_CLICK`**: User triggers Disconnect or Clean Old Sessions in Settings.
- **`N_TERMINATE_ALL_SESSIONS`**: Orchestrates 5-step atomic session teardown:
  1. `resetGoogleDriveMemoryCache()`: Clears module variables.
  2. `clearOAuthToken()`: Clears storage tokens.
  3. `signOut(auth)`: Cleans Firebase Auth IndexedDB.
  4. `POST /api/auth/google/revoke`: Clears server HTTP-only `dt_rt` cookie.
  5. `purgeCloudData()`: Cleans cloud assets from client IndexedDB.
  6. `BroadcastChannel`: Synchronizes logout across open browser tabs.
- **`N_CLEAN_OFFLINE_STATE`**: Guaranteed clean offline state with 0 ghost sessions and 0 phantom scans.

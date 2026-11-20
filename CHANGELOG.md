# Changelog

All notable public changes to **Drive Therapy** are documented in this file.

---

## [2.2.0] — 2026-11-20

### Added
- **Cross-Platform Native Standalone Executables & Universal Portable Build**:
  - Added native Go launcher (`native-launcher/main.go`) and `npm run build:portable-bundle` producing standalone executables for Windows 10/11 (`DriveTherapy.exe`), Linux (`DriveTherapy-linux-x64`), macOS Apple Silicon & Intel (`DriveTherapy-macos-arm64`, `DriveTherapy-macos-x64`), and Android ARM64 (`DriveTherapy-android-arm64`).
  - Dual-mode operation: launches the full Node.js Express backend (`server.cjs`) when Node.js is available on the host, or runs a built-in zero-dependency native HTTP server serving the production `dist/` studio when Node.js is not installed.
- **Native Android WebView Studio Project (`android/` & `capacitor.config.ts`)**:
  - Added `npm run build:android` generating a ready-to-compile Android Studio / Gradle project (`com.drivetherapy.studio`) with hardware-accelerated WebView, `WebViewAssetLoader`, IndexedDB/WebGL support, and `drivetherapy://oauth` intent handling.
- **Microsoft-Style Persistent Hero Links, Unified DLP, Meet Share & Clean PDF Prep**:
  - Added `src/services/enterpriseSharingEngine.ts` and `server/routes/heroLinks.ts` (`/api/share/hero-links`, `/s/:slug`) providing a single canonical link per asset with live permission/expiry updates, mode-`0600` local disk persistence (`.hero-links-store.json`), sensitivity + audience DLP rule evaluation, and EXIF/GPS-scrubbed printable HTML/PDF share packets.
- **Databricks OpenSharing / Delta Sharing v1 Protocol Adapter (`server/routes/openSharing.ts`)**:
  - Added `/api/opensharing/shares`, `/schemas`, `/tables`, and `.share` profile generation for sharing AI skill manifests and media catalogs in Delta Sharing v1 format.
- **4-Tier Privacy-First Malware Scanner & Threat-Intelligence Gateway (`server/routes/malwareScanner.ts`)**:
  - Tier 0 (100% offline, zero file uploads): SHA-256 hashing, EICAR detection, PE/ELF/Mach-O executable extension-spoofing detection, PDF `/JavaScript` & `/OpenAction` checks, and SVG `<script>` / XSS checks.
  - Tier 1 (hash/URL-only lookups): MalwareBazaar and URLhaus + optional BYO-key integrations for VirusTotal v3, OPSWAT MetaDefender, Sophos Intelix, URLScan.io, AlienVault OTX, and AbuseIPDB.
  - Tier 2 (explicit opt-in sandboxes) and Tier 3 (auto-detected local ClamAV `clamscan`/`clamdscan`).
- **Country & IP Allowlisting Middleware (`server/security/accessPolicy.ts`)**:
  - Configurable IP and ISO-3166 country allowlist middleware on `/api` and `/s` that always preserves local loopback (`127.0.0.1` / `::1`) access.
- **Cloud Power Suite (`src/services/cloudPowerSuiteEngine.ts`, `src/components/CloudPowerSuitePanel.tsx`)**:
  - Client-side WebCrypto PBKDF2-SHA256 (`210,000` iterations) + AES-256-GCM Zero-Knowledge Vault, Content-Defined Chunking (CDC) delta sync engine, CRDT vector-clock conflict solver, storage treemap analyzer, and 15 external cloud connector adapters.
- **Cross-OS & Linux Window Manager Native Window Decorations (`electron/windowDecoration.ts`)**:
  - Automatic window frame negotiation across Linux X11 and Wayland desktop environments (GNOME, KDE Plasma, XFCE, Cinnamon, MATE) and tiling compositors (Hyprland, Sway, i3), Windows 10/11 (`titleBarOverlay`), and macOS (`hiddenInset`).
- **Full-Width Responsive Desktop Settings & Concurrent Multi-User Session Vault**:
  - Full-width desktop layout for `UnifiedSettingsModal` and `StorageSettingsModal`.
  - AES-256-GCM encrypted server-side `HttpOnly` session vault (`server/security/sessionVault.ts`) supporting concurrent Google accounts without storing raw OAuth tokens in `localStorage`.
- **Structured Observability & 23-Phase Release Readiness Dossier**:
  - Added `server/observability/telemetry.ts` (`X-Correlation-Id` propagation, secret redaction, `GET /api/system/observability`), CycloneDX 1.5 SBOM (`docs/release-readiness/sbom.cdx.json`), and the 23-phase audit dossier (`docs/release-readiness/00..22`).

---

## [2.1.0] — 2026-11-16

### Added
- **9 Integrated Studios**: File Manager, Culling Room, Pixel Editor, AI Vision Lab, Portfolio Maker, Slideshow Theater, World Map, Music & Universal Media Studio, and Cloud Sync Hub.
- **Universal Accessibility & Internationalization**: 52 themes (including High Contrast AAA and Warm Low-Glare Dyslexia presets) and 20 languages (including RTL Arabic and Hebrew).
- **Offline Vision Worker (`src/workers/vision.worker.ts`)**: Pure-TypeScript EXIF parser, 64-bit perceptual dHash burst/duplicate clustering, and sharpness/exposure quality scoring.

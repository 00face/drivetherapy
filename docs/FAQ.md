# Drive Therapy — Frequently Asked Questions (FAQ)

## 1. Mission, Origins & Honest Capabilities

### Q: Why was Drive Therapy created?
**A:** Drive Therapy was created to give people an easier, calmer, more accessible, and more secure way to manage their **Google Workspace** (Google Drive, Google Photos/Takeout, and cloud media) alongside their local files. Standard cloud dashboards can feel overwhelming, visually fatiguing, and opaque about privacy. Drive Therapy brings high-speed media curation, sensory-friendly accessibility (52 themes including low-glare and dyslexia-friendly presets), and local-first security controls into one non-destructive workspace.

### Q: How was Drive Therapy built, and what were the creator's contributions?
**A:** Drive Therapy was conceived, architected, directed, and iteratively tested by its creator as a practical solution to real-world Google Workspace and personal media management pain points, developed using modern human-directed AI-assisted software engineering. Every feature requirement, accessibility goal, security boundary, and workflow design came from hands-on product direction and verification.

### Q: Let's be completely forthright — which features work out-of-the-box vs. which require my own credentials or local setup?
**A:** We believe in 100% honesty about how every part of the app works:
1. **Works 100% Out-of-the-Box (Zero API Keys Required)**:
   - Local folder browsing (`/api/fs/*` on loopback), all 9 Studio UIs, non-destructive IndexedDB cataloging (`drive_therapy_catalog_v2`), offline EXIF & perceptual dHash duplicate/burst grouping (`src/workers/vision.worker.ts`), WebGL/Canvas LUT color grading (`src/services/lutEngine.ts`), XMP sidecar export, tokenized batch renaming/exporting, client-side WebCrypto AES-256-GCM vault encryption, CDC delta chunking, CRDT vector-clock conflict resolution, local persistent Hero Links (`/s/:slug`), Unified DLP policy evaluation, OpenSharing v1 JSON endpoints, and Tier-0 offline file malware heuristics (SHA-256, EICAR, executable extension-spoofing, PDF `/JavaScript`, SVG `<script>` checks).
2. **Works with Your Google OAuth Client Credentials (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`)**:
   - Connecting your real Google Workspace / Google Drive accounts via OAuth 2.0 PKCE, concurrent multi-account switching stored in the server-side AES-256-GCM encrypted session vault (`dt_sid`), live Google Drive v3 folder indexing, and HTTP 206 byte-range audio/video streaming (`/api/drive/stream/:fileId`). See [`docs/PRODUCTION_OAUTH_GUIDE.md`](PRODUCTION_OAUTH_GUIDE.md) for step-by-step Google Cloud Console setup.
3. **Works with Your Optional Gemini API Key (`GEMINI_API_KEY`)**:
   - Cloud AI vision tagging, natural-language assistant prompts, and Gemini file inspection (`/api/gemini/*`). If no Gemini key is provided, Drive Therapy automatically falls back to its local offline vision worker (`vision.worker.ts`) and local OCR (`tesseract.js`).
4. **Adapter / BYO-Credential Integrations (External Clouds & Threat-Intel APIs)**:
   - The 15 external cloud connectors (S3, Cloudflare R2, Backblaze B2, Dropbox, OneDrive, Box, Nextcloud, Proton Drive, MEGA, SFTP, etc.) and Tier 1/2 external antivirus APIs (VirusTotal, MetaDefender, Sophos Intelix, Hybrid Analysis, Xcitium) provide local protocol adapters, capability matrices, and workflow engines on your workstation. Connecting them to live external accounts or commercial threat-intel feeds requires supplying your own provider credentials or API keys. Tier 3 local ClamAV scanning automatically activates when `clamscan` or `clamdscan` is installed on your host OS.

---

## 2. Privacy, Security & Non-Destructive Integrity

### Q: Will Drive Therapy ever overwrite or delete my original Google Drive or local files?
**A:** **No.** Non-destructive integrity is our #1 rule. Picks, rejects, star ratings, tags, face labels, and LUT color adjustments are stored strictly in your local browser IndexedDB (`drive_therapy_catalog_v2`) or exported as non-destructive `.xmp` sidecar files. Any action that actually moves or deletes a file requires explicit confirmation through the `DestructiveActionDialog` safety gate.

### Q: Where are my Google OAuth tokens stored when I sign in?
**A:** Unlike purely client-side SPAs that leave raw OAuth tokens exposed in `localStorage`, Drive Therapy's backend stores your OAuth tokens in an **AES-256-GCM encrypted file (`.session-vault.enc`)** on your local machine with a mode-`0600` key (`.session-vault.key`). Your browser only holds an `HttpOnly; SameSite=Lax` cookie (`dt_sid`).

### Q: Does the built-in Malware Scanner upload my private files to third-party servers?
**A:** **Never by default.**
- **Tier 0 (Default)** runs 100% offline in memory on your machine (checking SHA-256, EICAR signatures, Windows PE / Linux ELF / macOS Mach-O binaries disguised with image/document extensions, PDF `/JavaScript` auto-actions, and SVG `<script>` tags).
- **Tier 1** only queries external reputation services by **SHA-256 hash or URL**, never uploading file contents.
- **Tier 2** (full file sandbox submission) is disabled unless you explicitly supply an API key and pass `userConsent: true`.
- **Tier 3** runs locally via your own installed ClamAV daemon (`clamscan` / `clamdscan`).

### Q: How do I completely wipe all cached data and sessions from my machine?
**A:** Open **Storage Settings → Factory Reset** (or `POST /api/system/factory-reset`). This atomically destroys the server-side `.session-vault.enc`, deletes all client IndexedDB databases, clears Cache API and Service Workers, clears `localStorage`/`sessionStorage`, expires cookies, and sends the `Clear-Site-Data: "cache", "cookies", "storage"` HTTP header.

---

## 3. Prebuilt Executables, OS Support & Android

### Q: Can I run Drive Therapy on Windows, Linux, or macOS without installing Node.js?
**A:** **Yes.** The Universal Portable release (`npm run build:portable-bundle`) compiles standalone native executables using Go (`native-launcher/main.go`):
- **Windows 10/11 (`x64`)**: `DriveTherapy.exe`
- **Linux (`x86_64`)**: `DriveTherapy-linux-x64`
- **macOS (`arm64` & `x64`)**: `DriveTherapy-macos-arm64` and `DriveTherapy-macos-x64`
- **Android (`arm64`)**: `DriveTherapy-android-arm64`

If Node.js is installed on your system, the native executable automatically boots `server.cjs` for full Express backend support and opens the application window. If Node.js is **not** installed, the executable serves the compiled `dist/` studio and built-in offline API endpoints directly with zero external dependencies.

### Q: Does Drive Therapy display proper window decorations on Linux Wayland and tiling Window Managers (Hyprland, Sway, i3, KDE, GNOME)?
**A:** **Yes.** [`electron/windowDecoration.ts`](../electron/windowDecoration.ts) detects `$XDG_CURRENT_DESKTOP`, `$XDG_SESSION_TYPE`, and `$WAYLAND_DISPLAY` at startup:
- On floating desktops (**GNOME, KDE Plasma, XFCE, Cinnamon, MATE**), it enables native OS window frames (`frame: true, titleBarStyle: 'default'`).
- On tiling compositors (**Hyprland, Sway, i3**), it defers cleanly to compositor-drawn window borders and enables `--ozone-platform-hint=auto` + `WaylandWindowDecorations`.
- On **Windows 10/11** and **macOS**, it configures native `titleBarOverlay` and `hiddenInset` traffic-light controls respectively.

### Q: How does the Android build work?
**A:** Running `npm run build:android` compiles the web studio and syncs it into the native Android Gradle project under [`android/`](../android/) (`com.drivetherapy.studio`). It wraps the studio inside a hardware-accelerated Android `WebView` (`MainActivity.java`) using `WebViewAssetLoader`, giving you all 9 Studio views, offline IndexedDB cataloging, WebWorker vision analysis, WebGL LUT grading, and `>= 44x44px` touch targets on Android 8.0+ (API 26–34).

---

## 4. Troubleshooting

### Q: Why did the server start on port `3010` (or `3011+`) instead of `3000` or `3009`?
**A:** Drive Therapy's port manager (`src/services/serverPortManager.ts`) automatically scans for a clean, conflict-free port starting at `3010` (and permanently skips port `3009` to avoid colliding with local companion services) and writes the active URL to `.runtime-server.json`.

### Q: My browser blocked the Google OAuth sign-in popup. How do I fix this?
**A:** Ensure popups are allowed for `http://localhost:<port>`, or use the **OAuth Setup Wizard** inside the app to verify that your Google Cloud Console Authorized Redirect URI matches `http://localhost:<port>/api/auth/google/callback`.

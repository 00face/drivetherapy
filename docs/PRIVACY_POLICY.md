# Drive Therapy — Privacy Policy & Google API Limited Use Disclosure

- **Effective Date**: November 20, 2026
- **Version**: `2.2.0`
- **Public HTML Endpoint**: `/privacy` (`public/privacy.html`)

---

## Google API Services User Data Policy (Limited Use Compliance)

> **Drive Therapy's use and transfer to any other app of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.**

---

## 1. What Data Drive Therapy Accesses

Drive Therapy is a local-first, non-destructive workspace for organizing and curating your Google Drive, Google Photos, and local media files. When you connect a Google account via OAuth 2.0 (PKCE), Drive Therapy requests only the minimum scopes necessary:

1. **Identity & Multi-Account Display (`openid`, `userinfo.email`, `userinfo.profile`)**:
   - Used strictly to display your active Google account name, email, and avatar inside the application header and multi-account switcher.
2. **Per-File & Sidecar Management (`https://www.googleapis.com/auth/drive.file`)**:
   - Used to read files you explicitly open with Drive Therapy and to write user-confirmed non-destructive metadata sidecars (such as `.xmp` rating sidecars or exported lookbooks).
3. **Drive Folder Browsing & Streaming (`https://www.googleapis.com/auth/drive.readonly`)**:
   - Used in Standard Drive Mode to list folder hierarchies, read EXIF/media dimensions, and stream audio/video/image previews directly to your browser (`/api/drive/stream/:fileId`) without duplicating your entire cloud library to third-party storage.
4. **Google Photos Picker (`https://www.googleapis.com/auth/photospicker.mediaitems.readonly`)**:
   - Used only when you launch the Google Photos Picker to import selected photos into your local curation catalog.
5. **Optional Incremental Scopes (`OPTIONAL_EXTRA_SCOPES`)**:
   - Additional Google Workspace or Google Cloud Storage scopes (`devstorage.read_only`, `calendar`, `tasks`, `contacts`, `gmail`, `classroom`, `youtube.readonly`) are never requested at initial sign-in; they are requested incrementally only if you explicitly enable those optional modules.

---

## 2. How Your Data Is Stored and Protected

- **Browser IndexedDB (`drive_therapy_catalog_v2`)**: Your curation ratings, picks, rejects, tags, and LUT color-grading settings are stored locally inside your browser's IndexedDB.
- **AES-256-GCM Encrypted Server Session Vault (`.session-vault.enc`)**: OAuth access and refresh tokens are encrypted at rest on your local Drive Therapy server using AES-256-GCM with a mode-`0600` local key (`.session-vault.key`) and bound to an `HttpOnly; SameSite=Lax` cookie (`dt_sid`). Raw OAuth tokens are never stored in browser `localStorage`.
- **Zero Sale, Zero Advertising, Zero AI Model Training**: Drive Therapy never sells, rents, shares with advertising networks, or trains foundational AI models on your Google user data.
- **Privacy-First Malware Heuristics**: Tier 0 malware scanning runs 100% offline in memory on your host machine and never uploads your private files to third-party servers.

---

## 3. Data Retention, Revocation & Zero-Residue Deletion

You retain full control of your data at all times:
- **Account Sign-Out**: Signing out of an account removes its encrypted OAuth token entry from `.session-vault.enc` and clears its scoped IndexedDB cache.
- **Zero-Residue Factory Reset**: Clicking **Storage Settings → Factory Reset** (`POST /api/system/factory-reset`) destroys `.session-vault.enc`, deletes all client IndexedDB databases, clears Cache API and Service Workers, and sends `Clear-Site-Data: "cache", "cookies", "storage"`.

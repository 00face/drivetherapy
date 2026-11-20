# Drive Therapy — Google OAuth App Verification & Production Guide (`v2.2.0`)

This guide walks you step-by-step through configuring and verifying **Drive Therapy** in Google Cloud Console so users can sign in without seeing the **"Google hasn't verified this app"** warning screen.

---

## 1. Scope Architecture & Google's 2025/2026 Verification Tiers

In `v2.2.0`, Drive Therapy's OAuth gateway (`server.ts`) is pre-configured to comply with Google's **Minimum Scope** and **Incremental Authorization** policies:
- **Removed Deprecated Scopes**: We removed `photoslibrary.readonly` and `photoslibrary.readonly.appcreateddata` (deprecated by Google on March 31, 2025) in favor of the modern Google Photos Picker API (`photospicker.mediaitems.readonly`).
- **Incremental Authorization**: Developer/Workspace scopes (`devstorage.read_only` for GCS, `gmail`, `calendar`, `tasks`, `contacts`, `classroom`, `youtube.readonly`) are never requested at initial sign-in; they are requested only when explicitly invoked via `?extra=...`.

### Two Selectable Default Sign-In Modes (`OAUTH_SCOPE_MODE`)

| Mode (`OAUTH_SCOPE_MODE`) | Requested Scopes at Initial Sign-In | Google Classification | Verification Effort |
| :--- | :--- | :--- | :--- |
| **`lite`** (`?mode=lite` or `OAUTH_SCOPE_MODE=lite`) | `openid`, `userinfo.profile`, `userinfo.email`, `drive.file` | **100% Non-Sensitive** | **Brand Verification Only (1–2 days)** — No YouTube demo video, no CASA security audit, and **zero "Unverified App" warning screen**. |
| **`standard`** *(Default)* | `openid`, `userinfo.profile`, `userinfo.email`, `drive.file`, `drive.readonly`, `photospicker.mediaitems.readonly` | **Sensitive + Restricted (`drive.readonly`)** | **OAuth App Review (3–5 days, YouTube demo video)** + **Free Open-Source CASA Tier 2 Self-Scan**. |

---

## 2. Step-by-Step Google Cloud Console Verification Procedure

### Step 1: Verify Your Domain & Host `/privacy` and `/terms`
Google requires 3 live HTTPS links on a domain verified in [Google Search Console](https://search.google.com/search-console) (this can be your custom domain or free GitHub Pages `https://<your-username>.github.io/drivetherapy`):
1. **Application Homepage**: `https://<your-domain>/`
2. **Privacy Policy Link**: `https://<your-domain>/privacy` (or `/privacy.html` — pre-built in [`public/privacy.html`](../public/privacy.html) with the mandatory **Google API Services User Data Policy / Limited Use** clause).
3. **Terms of Service Link**: `https://<your-domain>/terms` (or `/terms.html` — pre-built in [`public/terms.html`](../public/terms.html)).

### Step 2: Configure the OAuth Consent Screen (Google Auth Platform)
1. Open [Google Cloud Console → APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
2. Set **User Type** to **External** and set **Publishing status** to **In production**.
3. Upload the official **`120×120 px` App Logo**:
   - Use [`public/drive-therapy-logo-120.png`](../public/drive-therapy-logo-120.png) (rendered directly from the official Vector Brand Style Sheet v1.0 at exact `120×120 px`).
4. Fill in the **App Domain** fields with your Homepage, Privacy Policy (`/privacy`), and Terms of Service (`/terms`) URLs, and add your domain under **Authorized domains**.

### Step 3: Copy-Paste Scope Justifications (For `standard` Mode)
If you include `drive.readonly`, `drive.file`, and `photospicker.mediaitems.readonly`, paste the following into the **Scope Justification** box in Google Cloud Console:

> **Scope Justification for Google Trust & Safety Review:**
> - `https://www.googleapis.com/auth/drive.readonly`: Drive Therapy is a non-destructive media and document curation studio for Google Drive. It requires `drive.readonly` to list folder hierarchies, inspect EXIF/media metadata, and stream image, audio, and video previews directly to the user's browser without copying or ingesting their files into external cloud storage.
> - `https://www.googleapis.com/auth/drive.file`: Required to save user-initiated, non-destructive Adobe XMP rating sidecars (`.xmp`) and exported portfolio lookbooks back to the user's selected folder without granting broad destructive modification permissions across their entire Drive.
> - `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`: Required only when the user explicitly opens the Google Photos Picker to select and curate photos inside Drive Therapy.

### Step 4: Record the 2-Minute Unlisted YouTube Demo Video
If submitting Sensitive or Restricted scopes, record a 2-minute screen capture and upload it as an **Unlisted** YouTube video showing:
1. Your browser opening Drive Therapy with the **full browser address bar visible**.
2. Clicking **"Sign in with Google"**.
3. The Google OAuth consent screen popup with the **full URL bar expanded so `client_id=...` is clearly readable** and the language set to English.
4. Clicking **Continue / Allow** on the requested permissions.
5. Browsing a Google Drive folder inside Drive Therapy's **File Manager** and **Culling Room**, rating a file (`P` / `1–5` stars), and exporting a non-destructive `.xmp` sidecar.
6. Clicking **Sign Out** in the account switcher.

### Step 5: Complete the Free Open-Source CASA Tier 2 Self-Scan (Only if using `drive.readonly`)
Because Drive Therapy is licensed under an OSI-approved open-source license (`AGPL-3.0-or-later`), you qualify for the **100% free CASA Tier 2 Open-Source Self-Scan**:
1. After Google Trust & Safety approves your OAuth consent screen and demo video, you will receive an email invitation from the CASA assessment portal (TAC Security / PWC).
2. Select **Open-Source / Self-Scan (No Cost)** and provide your public GitHub repository URL.
3. Our repository already passes `npm audit --audit-level=high` (`0` vulnerabilities), enforces strict `Content-Security-Policy` headers, uses AES-256-GCM encrypted `HttpOnly` session cookies (`dt_sid`), and includes a CycloneDX 1.5 SBOM ([`docs/release-readiness/sbom.cdx.json`](release-readiness/sbom.cdx.json)) to streamline CASA verification.

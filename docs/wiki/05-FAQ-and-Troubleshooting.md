# 05 — Frequently Asked Questions & Troubleshooting

For the full FAQ, see [`docs/FAQ.md`](../FAQ.md). Below is a quick reference for common setup and operational questions.

---

## Quick FAQ

1. **Can I use Drive Therapy without configuring any API keys?**
   - **Yes.** All 9 Studio interfaces, local folder browsing (`/api/fs/*` on loopback), IndexedDB cataloging, offline EXIF & perceptual dHash burst grouping (`vision.worker.ts`), WebGL/Canvas LUT color grading, XMP sidecar export, WebCrypto AES-256-GCM vault encryption, local Hero Links, Unified DLP evaluation, and Tier-0 offline malware heuristics work 100% offline with zero API keys.
2. **How do I connect my real Google Workspace / Google Drive account?**
   - Follow [`docs/PRODUCTION_OAUTH_GUIDE.md`](../PRODUCTION_OAUTH_GUIDE.md) to create a Google OAuth 2.0 Web Client ID (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`), or paste your credentials directly into the in-app **OAuth Setup Wizard**.
3. **Are my original files ever modified?**
   - **Never automatically.** All ratings, picks/rejects, tags, and LUT edits are saved non-destructively in IndexedDB or `.xmp` sidecar files. Any file-mutating action requires explicit confirmation via `DestructiveActionDialog`.

---

## Troubleshooting Checklist

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| Server starts on port `3010` or `3018` instead of `3000` | Automatic clean-port negotiation (`serverPortManager.ts`) | Check `.runtime-server.json` or terminal output for the active URL (port `3009` is intentionally excluded). |
| Google OAuth popup does not open | Browser popup blocker | Allow popups for `http://localhost:<port>` in your browser address bar. |
| Google OAuth returns `redirect_uri_mismatch` | Redirect URI in Google Cloud Console does not match active port | Add `http://localhost:<port>/api/auth/google/callback` to Authorized Redirect URIs in Google Cloud Console. |
| `localClamAvAvailable: false` in Malware Scanner | ClamAV is not installed on host OS | Tier 0 offline heuristics still run automatically; optionally install `clamav` (`sudo apt install clamav`) to enable Tier 3 local daemon scanning. |
| Want to wipe all sessions and cached data | Resetting environment | Open **Storage Settings → Factory Reset** to purge `.session-vault.enc`, IndexedDB, Cache API, Service Workers, and cookies. |

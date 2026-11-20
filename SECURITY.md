# Security Policy & Architecture (`v2.2.0`)

## 1. Security Philosophy: Forthright, Local-First & Non-Destructive

Drive Therapy was created to give people an easier, more accessible, and more secure way to manage their Google Workspace and local files on their own machine. We believe security documentation should be completely honest about what is enforced locally, what requires your own API keys, and where trust boundaries lie.

| Version | Supported |
| :--- | :--- |
| `2.2.x` | Yes |
| `< 2.2.0` | No |

---

## 2. What Security Controls Are Actually Enforced

### A. Server-Side Encrypted OAuth Session Vault (`server/security/sessionVault.ts`)
- When you sign in with Google OAuth 2.0 (PKCE), your OAuth access and refresh tokens are stored on your local server in an **AES-256-GCM encrypted vault** (`.session-vault.enc`) keyed by a mode-`0600` local key (`.session-vault.key`).
- The browser receives only an opaque **`HttpOnly; SameSite=Lax` session cookie (`dt_sid`)**. Raw Google OAuth tokens are never stored in browser `localStorage`.
- Multiple Google accounts can be connected concurrently under one session vault, and signing out of one account removes only that account's token entry while preserving others.

### B. Loopback Isolation for Host Filesystem Routes (`server.ts`)
- All host filesystem routes (`/api/fs/*`, `/api/takeout/save-archive`, `/api/security/scan-local`, `/api/security/access-policy`) are guarded by `isLoopbackRequest(req)`, ensuring only requests originating from `127.0.0.1` / `::1` on the local machine can access host files.
- Path traversal (`..` or null bytes) on sprite and filesystem routes is explicitly blocked (`403 Forbidden`).

### C. Hardened HTTP Security Headers
Every response from both the Node.js Express server and the standalone Go launcher enforces:
- `Content-Security-Policy`: `default-src 'self' https: data: blob:; script-src 'self' 'wasm-unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https: ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'self';`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### D. Client-Side Zero-Knowledge AES-256-GCM Vault (`src/services/cloudPowerSuiteEngine.ts`)
- Files or text encrypted in the Cloud Power Suite Vault use browser-native **WebCrypto PBKDF2-SHA256 (`210,000` iterations)** with a 128-bit random salt and **AES-256-GCM** (96-bit IV, 128-bit authentication tag) before leaving the browser.

### E. Privacy-First File Scanning (`server/routes/malwareScanner.ts`)
- **Tier 0 (Built-In Offline Heuristics — Always Active)**: Computes SHA-256 hashes and inspects files locally for EICAR test signatures, executable magic-byte extension spoofing (`PE/MZ`, `ELF`, `Mach-O` disguised as images/documents), embedded PDF `/JavaScript` or `/OpenAction` triggers, and SVG `<script>` / inline event handlers. **No file content is ever uploaded to any third party by default.**
- **Tier 1 (Hash/URL Reputation Lookups)**: Queries public threat-intelligence feeds (such as MalwareBazaar and URLhaus, or optional VirusTotal / MetaDefender / Sophos Intelix when you configure your own API keys) using only SHA-256 hashes or URLs.
- **Tier 2 (External Sandboxes)** & **Tier 3 (Local ClamAV)**: Tier 2 requires explicit opt-in consent and user-supplied API keys; Tier 3 automatically invokes local `clamscan`/`clamdscan` if ClamAV is installed on your host OS.

### F. True Zero-Residue Factory Reset (`src/services/storageJanitor.ts`)
- Triggering **Factory Reset** destroys the server session vault, deletes all client IndexedDB databases, clears Cache API and Service Workers, clears `localStorage` and `sessionStorage`, and returns `Clear-Site-Data: "cache", "cookies", "storage"`.

---

## 3. Scope Limitations & Honest Disclosures

- **Self-Hosted / Local Workstation Design**: Drive Therapy is designed to run on your local desktop/workstation or private server. If you expose the Express server beyond `localhost` on an untrusted network, you should terminate TLS (HTTPS) via a reverse proxy and enable the built-in IP/Country allowlist (`/api/security/access-policy`).
- **Local Hero Links & DLP**: The Hero Links (`/s/:slug`) and Unified DLP rules evaluate and persist sharing policies on your local Drive Therapy instance (`.hero-links-store.json`, mode `0600`) to help you organize and audit access; they do not bypass or replace Google Workspace domain-level admin policies inside Google's cloud servers.
- **Software Bill of Materials (SBOM)**: A full CycloneDX 1.5 SBOM of all 412 npm dependencies is maintained in [`docs/release-readiness/sbom.cdx.json`](docs/release-readiness/sbom.cdx.json).

---

## 4. Reporting a Vulnerability

If you discover a security vulnerability in Drive Therapy:
1. **Do not open a public issue with exploit details.**
2. Use GitHub's **Report a vulnerability** (Private Vulnerability Reporting) tab on the repository, or contact the repository owner directly.
3. Include steps to reproduce, affected routes or components, and any suggested remediation.

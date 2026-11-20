# Contributing to Drive Therapy

Thank you for your interest in contributing to **Drive Therapy**. Drive Therapy was built to make managing Google Workspace, Google Drive, Google Photos/Takeout, and local media easier, more accessible, and more secure for everyday users and creators.

---

## 1. Core Engineering Principles

1. **Sacred Non-Destructive Integrity**:
   - Never modify, overwrite, or delete a user's original cloud or local files automatically. Any action that mutates a file on disk or in the cloud must require explicit user confirmation via `src/components/DestructiveActionDialog.tsx`.
   - Keep curation states (`picked`, `rejected`, `unrated`), star ratings, LUT color-grading parameters, face clusters, and portfolios in IndexedDB (`drive_therapy_catalog_v2`) or non-destructive XMP sidecars (`src/services/xmpExporter.ts`).
2. **Honest & Forthright UX**:
   - Never hardcode demo accounts, fake telemetry, or fabricated cloud identities.
   - Be transparent in UI labels and documentation about which features run 100% locally offline versus which features connect to external APIs using the user's own OAuth/API credentials.
3. **Zero-Key Offline Resilience**:
   - The application must remain 100% usable for local curation, EXIF inspection, perceptual dHash burst grouping (`src/workers/vision.worker.ts`), LUT color grading (`src/services/lutEngine.ts`), client-side AES-256-GCM vault encryption, and Tier-0 file heuristic checks even when no Google OAuth or Gemini API keys are configured.
4. **Erasable TypeScript Syntax**:
   - Do not use TypeScript `enum`, `namespace`, or constructor parameter properties. All TypeScript code must remain valid JavaScript when type annotations are stripped.
5. **Universal Accessibility (WCAG 2.2 AA / AAA Target)**:
   - Interactive controls must maintain `>= 44x44 CSS px` touch/click targets, visible `2px` focus rings, `tabular-nums` for counters/timers, and verified contrast across our 52 theme presets (including High Contrast AAA and Warm Low-Glare Dyslexia themes).
6. **Loopback Security**:
   - All `/api/fs/*` and administrative host routes in `server.ts` must preserve `isLoopbackRequest(req)`.

---

## 2. Development Setup

```bash
# 1. Install dependencies (Node.js >= 22 required)
npm install

# 2. Copy example environment variables
cp .env.example .env

# 3. Start the local development server
npm run dev
```

---

## 3. Pre-Pull-Request Verification Gate

Before submitting a pull request, run the verification suite and ensure all checks pass:

```bash
# 1. TypeScript strict type-checking
npm run lint

# 2. Automated unit, integration, contract, fuzz & security test suites
npm test

# 3. Clean production bundle build
npm run build

# 4. Supply-chain vulnerability audit
npm audit --audit-level=high
```

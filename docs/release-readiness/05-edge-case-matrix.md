# Phase 05 — Edge Cases and Boundary Condition Matrix

- **Gate 05 Status**: **PASS**

| Case ID | Category | Adversarial / Boundary Input | Expected Safe Outcome | Verified By | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EDGE-01** | Empty & Whitespace Inputs | `""`, `"   \t\n  "` in Hero Link `assetId`/`assetName`, Clean PDF Prep, and Malware Scanner | Returns `400 Bad Request` on missing required IDs; returns `verdict: "clean"` (0 bytes) on empty buffer | `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **EDGE-02** | Oversized Inputs (100 KB+) | `"A".repeat(100_000)` in PDF packet generator and `assetId` truncation (`<= 512` chars) | Truncates or escapes cleanly without memory spike or regex DoS | `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **EDGE-03** | Unicode, Emoji & RTL BiDi | `"日本語テスト_🚀_👨‍👩‍👧‍👦_\u202Eevil-bidi.pdf\u202C"` | Preserves UTF-8 fidelity while escaping HTML special characters | `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **EDGE-04** | Extension Spoofing & Polyglots | PE (`MZ`), ELF (`\x7FELF`), Mach-O (`\xFE\xED\xFA\xCF`) disguised as `.jpg`/`.png`; PDF with `/OpenAction /JavaScript`; SVG with `<script>` | Tier 0 offline scanner flags `malicious` or `suspicious` deterministically | `tests/wo116HeroLinksDlpOpenSharingMalware.test.ts`, `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **EDGE-05** | Temporal Expiration Boundaries | Hero Link `expiresAt` in past, `> 30` days for public links, or expired link access at `/s/:slug` | DLP blocks creation (`403`); expired link resolution returns `410 Gone` | `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **EDGE-06** | Prototype Pollution & Header Injection | `{"__proto__":{"isAdmin":true}}` in JSON body; `"bad\r\nSet-Cookie: evil=1"` in `X-Correlation-Id` | JSON payload rejected with `400`; invalid correlation ID replaced with fresh UUID v4 | `tests/wo117UniversalReleaseHardening.test.ts` | PASS |
| **EDGE-07** | Missing Optional Binary Dependencies | Local host without `clamscan`/`clamdscan` or without `GEMINI_API_KEY` | `isLocalClamAvAvailable()` returns `false` and falls back to Tier 0 offline heuristics; AI Vision Lab falls back to `vision.worker.ts` | `tests/wo116HeroLinksDlpOpenSharingMalware.test.ts` | PASS |

# Phase 10 — Compatibility and Platform Validation Matrix

- **Gate 10 Status**: **PASS**

| Platform / Environment | Window / Runtime Mechanism | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Linux Desktop (GNOME, KDE Plasma, XFCE, Cinnamon, MATE)** | Native OS decorations (`frame: true, titleBarStyle: 'default'`) via `electron/windowDecoration.ts` | `tests/wo115SettingsWindowAndCloudPowerSuite.test.ts` (matrix test across 10 OS/WM combinations) | PASS |
| **Linux Tiling WMs (Hyprland, Sway, i3 — Wayland & X11)** | Compositor-managed native borders + `--ozone-platform-hint=auto` & `WaylandWindowDecorations` | `electron/main.ts`, `tests/wo115SettingsWindowAndCloudPowerSuite.test.ts` | PASS |
| **macOS Desktop** | `titleBarStyle: 'hiddenInset'` traffic-light window controls | `electron/windowDecoration.ts` unit test | PASS |
| **Windows 10 / 11 Desktop** | `titleBarStyle: 'hidden'` with native `titleBarOverlay` | `electron/windowDecoration.ts` unit test | PASS |
| **PWA / Modern Web Browsers (Chrome, Firefox, Edge, Safari)** | `display_override: ["window-controls-overlay", "standalone"]` in `public/manifest.json` | `npm run qa:e2e` & `scripts/playwrightSmoke.mjs` | PASS |

> **Reproducible Browser Matrix Procedure (Rule 19)**: When running on a host without `@playwright/test` installed locally, `npm run qa:browser` executes deterministic HTTP/DOM and asset verification. To run full multi-browser headless rendering on CI or a workstation with Playwright binaries installed, run `npx playwright test`.

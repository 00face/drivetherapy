# Phase 20 — Post-Release Validation and Maintenance Plan

## 1. Post-Release Smoke Verification Checklist

1. Query `GET /api/system/observability` and verify `status: "healthy"`, `X-Correlation-Id` response header, and `securityPosture.cspActive: true`.
2. Execute `npm run qa:probe && npm run qa:e2e` against the active port in `.runtime-server.json`.
3. Verify `status5xx === 0` in `/api/system/observability`.

## 2. Continuous Maintenance Cadence

| Activity | Cadence | Command / Procedure |
| :--- | :--- | :--- |
| Supply-Chain Vulnerability Audit | Every commit / Weekly | `npm audit --audit-level=high` + `npm run qa:release-audit` |
| Full Automated Regression Suite | Every commit / PR | `npm run lint && npm test && npm run build` |
| Topology & Living Architecture Sync | Every feature change | `npm run qa:probe` |
| Session & Hero Link Store Backup / Restore Rehearsal | Monthly | Verify `.session-vault.enc` and `.hero-links-store.json` mode-`0600` permissions and reload |

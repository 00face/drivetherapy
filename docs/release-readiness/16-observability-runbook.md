# Phase 16 — Observability and Incident Response Runbook

- **Gate 16 Status**: **PASS**

## 1. Telemetry & Correlation Endpoints

- **Structured Observability Endpoint**: `GET /api/system/observability`
  - Returns `status`, `version`, `startedAt`, `uptimeSeconds`, request counters (`total`, `status2xx`, `status4xx`, `status5xx`), latency percentiles (`p50`, `p95`, `p99`), process memory (`rssMb`, `heapUsedMb`, `heapTotalMb`, `loadAvg1m`), active `securityPosture`, and secret-redacted `recentEvents`.
- **Correlation ID Propagation**: Every request/response carries `X-Correlation-Id` (validated against `/^[A-Za-z0-9._-]{4,128}$/` to prevent header injection).
- **Automatic Secret Redaction**: `redactSensitiveTelemetry()` strips Google API keys (`AIza*`), OAuth secrets (`GOCSPX-*`), access tokens (`ya29.*`), refresh tokens (`1//*`), Bearer tokens, and `dt_sid` cookies before recording any diagnostic event.

## 2. Incident Triage & Recovery Procedures

1. **Port or Process Hang**: Run `npm run rehost` to rebuild, clean stale state, and bind a fresh clean port (`3010+`), updating `.runtime-server.json`.
2. **Suspected Credential or Session Compromise**: Trigger `POST /api/system/factory-reset` (or click **Factory Reset** in Storage Settings) to destroy `.session-vault.enc` and issue `Clear-Site-Data: "cache", "cookies", "storage"`.
3. **Unauthorized External Traffic**: Enable Enterprise IP/Country Allowlisting via `POST /api/security/access-policy` (`enabled: true, allowedCountries: ["US"], alwaysAllowLoopback: true`).

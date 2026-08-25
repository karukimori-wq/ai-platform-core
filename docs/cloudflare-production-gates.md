# Cloudflare production acceptance gates

Cloudflare migration is complete only when every required gate below passes.

## Infrastructure
- Worker `ai-platform-core` deploys from `main`.
- D1 binding is named `DB` and targets database `ai-platform-core`.
- `platform_kv` schema exists remotely.
- No provider secret is committed to GitHub or persisted in D1.

## Runtime
- `/health` returns 200 and appName `ai-platform-core`.
- `/version` returns 200.
- `/contracts/status` returns 200 with `professionalIdRequired=false`.
- `/v1/readiness` or `/api/readiness` returns `productionReady=true`.
- Readiness output includes `failedChecks` and `recommendedActions` so Platform Admin/operators know the next endpoint to inspect when degraded.
- `/api/persistence/status` reports D1 reachable and database-backed persistence ready.
- `/api/persistence/roundtrip` returns `roundtripReady=true`.

## Persistence
- Activity created in one request can be read in a later request.
- Usage generated from the activity can be read in a later request.
- Prompt templates written through the stored runtime survive a later request.
- D1 record versions increment on updates.

## Isolation
- Usage queries scoped to workspace A/user A do not return workspace B/user B records.
- Activity reads do not bypass the HTTP authorization/scope rules already defined by APC.
- `professionalId` is not introduced.

## Integration
- Echo provider is used for the first production E2E so no real provider secret is needed.
- Platform Admin health/version/contracts/readiness monitoring is updated after the Worker URL is stable.
- professional-platform-contracts is updated only after the production gates are green.

## Status transitions
`in_progress` -> `production_verification` after the first successful Worker deploy and D1 roundtrip.
`production_verification` -> `completed` only after readiness + persistence + isolation E2E and Platform Admin integration are green.

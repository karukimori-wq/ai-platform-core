# Cloudflare production acceptance gates

Cloudflare migration is complete only when every required gate below passes.

## Infrastructure
- Worker `ai-platform-core` deploys from `main`.
- Main Production workflow deploys the plan-aware Worker entrypoint: `apps/cloudflare-worker/src/entry.ts`.
- Wrangler production config uses `compatibility_flags = ["nodejs_compat"]`.
- D1 binding is named `DB` and targets database `ai-platform-core`.
- `platform_kv` schema exists remotely.
- No provider secret is committed to GitHub or persisted in D1.
- `OPENAI_API_KEY` is supplied only as a Cloudflare runtime secret or environment binding.
- `OPENAI_DEFAULT_MODEL` is optional; when omitted the Cloudflare runtime uses the repository default model.

## Runtime
- `/health` returns 200 and appName `ai-platform-core`.
- `/version` returns 200.
- `/contracts/status` returns 200 with `professionalIdRequired=false`.
- `/v1/readiness` or `/api/readiness` returns `productionReady=true`.
- Readiness output includes `failedChecks` and `recommendedActions` so Platform Admin/operators know the next endpoint to inspect when degraded.
- `/api/persistence/status` reports D1 reachable and database-backed persistence ready.
- `/api/persistence/roundtrip` returns `roundtripReady=true`.

## Plan and entitlement gates
- `/v1/usage` returns `status=success` for a scoped `appId + workspaceId + userId + planId + featureKey` query.
- `/v1/entitlements` returns `allowed=true` for Free Numeria Studio `studio.report.ai_assist` with limit `20`.
- Plan API responses preserve the `workspaceId`, `userId`, `currentPlan`, `featureKey`, and limit/reset metadata.
- Header scope must match query scope: `x-client-id`, `x-workspace-id`, and `x-user-id`.
- Business-only features are defined but not exposed as a purchasable Business plan in APC.

## Gateway and provider gates
- `/v1/gateway/run` remains the single AI execution entrypoint.
- Production E2E uses `production-e2e` + `production.echo` with the echo provider, so base persistence checks do not require a real provider secret.
- Managed app calls for `numeria-studio` and `velvet` pass through the plan-aware entrypoint and Gateway Plan Guard.
- OpenAI execution uses the OpenAI Responses API provider when `OPENAI_API_KEY` is available.
- Provider secrets are never echoed in responses, logs, D1, or docs.

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
- Platform Admin health/version/contracts/readiness monitoring is updated after the Worker URL is stable.
- professional-platform-contracts is updated only after the production gates are green.
- Numeria Studio and Velvet should call APC with `workspaceId + userId`; APC does not own their customer, report, memory UI, payment, reservation, or sales records.

## Status transitions
`in_progress` -> `production_verification` after the first successful Worker deploy and D1 roundtrip.
`production_verification` -> `completed` only after readiness + persistence + isolation E2E and Platform Admin integration are green.

## Verified production release

- Workflow: `Cloudflare Production`
- Run ID: `34456010956`
- Commit: `d7f012cb71e091885376e47336a3d57029344863`
- Result: `success`
- Production URL: `https://ai-platform-core.karukimori.workers.dev`

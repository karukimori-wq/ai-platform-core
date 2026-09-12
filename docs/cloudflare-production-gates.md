# Cloudflare production acceptance gates

Cloudflare migration is complete only when every required gate below passes.

## Infrastructure
- Worker `ai-platform-core` deploys from `main`.
- There is one production deployment entrypoint: the `Cloudflare Production` workflow.
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
- `/release/status` reports the current Free / Pro release state and keeps Business `unavailable` / `purchasable=false`.
- `/auth/status` or `/api/auth/status` returns the scoped-header auth contract.
- `/persistence/status` or `/api/persistence/status` reports D1 reachable and database-backed persistence ready.
- `/v1/providers/status` reports managed provider readiness without exposing provider secrets.
- `/v1/readiness` or `/api/readiness` returns aggregate production readiness.
- Readiness output includes `failedChecks` and `recommendedActions` so Platform Admin/operators know the next endpoint to inspect when degraded.
- `/api/persistence/roundtrip` returns `roundtripReady=true`.

## Plan and entitlement gates
- `professional-platform-contracts/docs/contracts/plan-contract.md` is the plan-contract source of truth.
- AI decisions use `appId + appVersion + workspaceId + userId + planId + featureKey`; managed Gateway calls additionally require an idempotent `activityId`.
- `/v1/usage` returns `usagePeriod`, `usageCount`, `limit`, `overLimit`, `entitlementResult`, trace/correlation metadata, and the current plan/feature scope.
- `/v1/entitlements` returns the AI entitlement decision without consuming usage.
- APC records AI usage, but it does not reinterpret domain limits as AI-call quotas. Numeria Studio's 20-completed-appraisals-per-month Free limit is owned and enforced by Numeria Studio, not by APC.
- No numeric AI-call quota is enforced in the current Free / Pro release unless the shared plan contract explicitly defines one; therefore current allowed AI features report `limit=null`.
- Canonical Pro AI capability keys include `numeria.report.wording_adjustment` and `velvet.ai.organize_suggest`.
- Legacy APC capability keys may remain temporarily as compatibility aliases while app integrations migrate.
- Business is recognized but returns `entitlementResult=unavailable`, `releaseStatus=unavailable`, and `purchasable=false` for the current release.
- Usage payloads are allowlisted to operational metadata; full appraisal, consultation, conversation, message, customer, payment, API-key, secret, or secret-prompt content is rejected or not persisted.

## Gateway and provider gates
- `/v1/gateway/run` remains the single AI execution entrypoint.
- Production E2E uses `production-e2e` + `production.echo` with the echo provider, so base persistence checks do not require a real provider secret.
- Managed app calls for `numeria-studio` and `velvet` pass through the plan-aware entrypoint and Gateway Plan Guard.
- Managed calls require `x-source-app`, `x-app-version`, `x-plan-id`, `x-feature-key`, `x-activity-id`, `x-client-id`, `x-workspace-id`, and `x-user-id`.
- Header/body scope mismatches are rejected before provider execution.
- `/v1/integrations/status` must report `planGateway.status=success`.
- `planGateway.managedApps` must include both `numeria-studio` and `velvet`.
- `planGateway.usageCommitPolicy` must be `post_success_gateway_response`.
- `planGateway.failedProviderCallsConsumePlanUsage` must be `false`.
- `planGateway.idempotencyKey` must remain `appId|workspaceId|userId|activityId`.
- OpenAI execution uses the OpenAI Responses API provider when `OPENAI_API_KEY` is available.
- `/v1/providers/status` must report OpenAI configured in Production, and no secret value may appear in the response.

## Persistence and data minimization
- Activity created in one request can be read in a later request.
- Persisted Activity records retain operational metadata but redact free-form `goal`, `context`, `input`, provider `output`, and feedback `memo`.
- Persisted Analytics Usage records contain token/cost/provider/model/capability/scope metadata rather than full user content.
- Persisted Analytics feedback omits free-text `memo`.
- Plan usage idempotency records retain safe metadata such as appName, appVersion, featureKey, planId, traceId, correlationId, eventName, tokenEstimate, and status.
- Prompt templates written through the stored runtime survive a later request.
- D1 record versions increment on updates.

## Isolation
- Usage queries scoped to workspace A/user A do not return workspace B/user B records.
- Activity reads do not bypass the HTTP authorization/scope rules already defined by APC.
- `professionalId` is not introduced.

## Ownership boundaries
- APC owns AI Capability, AI Activity, AI Usage, AI Runtime, provider routing, entitlement decisions, and AI usage recording.
- APC does not own Subscription, Pricing, Customer, Reservation, Payment, Sales, Numeria Session/Report, or Velvet business records.
- Platform Admin may monitor APC release/readiness status but does not become the AI execution or subscription authority.

## Status transitions
`in_progress` -> `production_verification` after code CI is green and the production workflow is ready to run.
`production_verification` -> `completed` only after release/provider/plan/readiness + persistence + isolation E2E gates are green.

## Last verified production release

- Workflow: `Cloudflare Production`
- Run ID: `34550249935`
- Commit: `8bd6ee79081d54821c33613962b7b9fb5d2ca488`
- Result: `success`
- Production URL: `https://ai-platform-core.karukimori.workers.dev`
- This verification predates the current Free / Pro shared-plan-contract alignment. A new Production run is required after the latest main CI is green.

## Workflow consolidation

- The former `Cloudflare Production - Plan APIs` workflow was removed after its checks were merged into `Cloudflare Production`.
- Operators should use only `Cloudflare Production` for production deployment and verification.

# Changelog

## 0.1.43

- Aligned AI Platform Core with the shared Free / Pro plan contract and release-readiness requirements.
- Business remains a recognized `planId` but is unavailable and not purchasable in the current release.
- Added shared Usage response fields including `usagePeriod`, `usageCount`, `limit`, `overLimit`, and `entitlementResult`.
- Added `appVersion`, trace/correlation metadata, event name, and token-estimate support to safe Usage metadata.
- Added `/release/status` plus short `/auth/status` and `/persistence/status` monitoring aliases.
- Added canonical Pro AI capability keys `numeria.report.wording_adjustment` and `velvet.ai.organize_suggest` while preserving legacy APC compatibility aliases.
- Removed APC-invented numeric AI-call quotas. Numeria Studio's Free monthly 20 limit remains an appraisal-domain limit and is not treated as an APC 20-call AI quota; Velvet likewise has no APC-defined 100-call quota without an explicit shared contract.
- Usage remains measurable and idempotent for successful managed Gateway calls even when no numeric AI quota is defined.
- Hardened persisted Cloudflare Activity records so full goal/context/input/provider-output content is not retained in D1 audit storage.
- Stopped persisted Analytics feedback from retaining free-text memo content.
- Expanded integration/monitoring status to expose AI Runtime, canonical capabilities, `x-app-version`, Business unavailable state, provider readiness, and release status without exposing secrets.
- Updated Cloudflare Production gates to verify Free / Pro entitlement behavior, Business unavailable state, release status, provider readiness, D1/Event/Activity persistence, and workspace/user isolation.

## 0.1.42

- Split managed Gateway plan checks from usage consumption.
- Added `checkUsageAllowance` so Numeria Studio and Velvet Gateway calls can be authorized before provider execution without incrementing monthly usage.
- Updated the Cloudflare plan-aware entrypoint to commit managed Gateway usage only after a successful Gateway response.
- Preserved idempotent usage consumption through `x-activity-id`.
- Added coverage proving allowance checks do not consume Free monthly quota.

## 0.1.41

- Added Plan/Usage APIs for Free, Pro, and future Business-aware AI capability control.
- Added plan-aware Cloudflare Worker entrypoint at `src/entry.ts` for Production deployment.
- Added Gateway Plan Guard for managed Numeria Studio and Velvet AI calls.
- Added OpenAI Responses API provider while keeping the existing OpenAI-compatible Chat Completions provider available.
- Registered Numeria Studio AI capabilities: `studio.report.generate` and `studio.report.ai_assist`.
- Registered Velvet AI capabilities: `velvet.memory.summary`, `velvet.memory.search`, and `velvet.memory.recall`.
- Added Cloudflare Runtime support for `OPENAI_API_KEY` and optional `OPENAI_DEFAULT_MODEL`; secrets are read from runtime environment and never stored in code.
- Updated the main Cloudflare Production workflow to deploy `src/entry.ts` with `nodejs_compat` and verify Plan API readiness.
- Verified Production deployment through GitHub Actions run `34456010956` on commit `d7f012cb71e091885376e47336a3d57029344863`.

## 0.1.40

- Added aggregate production readiness views at `/v1/readiness` and `/api/readiness` for Platform Admin and deployment verification.
- Readiness now reports D1 persistence reachability, Event Store reachability, MVP identity alignment, and integration-boundary readiness without exposing secrets or application-owned business data.
- Added the deployed commit SHA to readiness output when `COMMIT_SHA` is configured.
- Added Cloudflare Worker contract coverage for the readiness surface.

## 0.1.39

- Updated local contract references to include `app-responsibilities.md`, `identity-contract.md`, and `platform-admin.md`.
- Clarified that `app-responsibilities.md` controls cross-app responsibility boundaries.
- Documented that Platform Admin observes AI Platform Core operational state but does not execute AI Activities or own Usage.
- Added a Platform Admin compatible HTTP health view at `/v1/health`.
- Added a Platform Admin compatible HTTP contract status view at `/v1/contracts/status`.
- Added a scoped HTTP Activity status view at `/v1/activities/{activityId}` without exposing raw input or context.
- Added scoped HTTP Capability manifest registration at `/v1/capabilities`.
- Added Prompt Template runtime and scoped HTTP rendering at `/v1/prompt-templates/render`.
- Added a storage-backed Prompt Template repository factory for durable template records.

## 0.1.0

- Initialized pnpm/Turborepo monorepo.
- Added strict TypeScript, ESLint, Prettier, and Vitest.
- Added kernel package.
- Added event engine package.
- Added capability runtime package.
- Added workflow runtime package.
- Added knowledge engine package.
- Added plugin runtime package.
- Added storage package.
- Added composed runtime package.
- Added SDK public API package.
- Added playground app.

## 0.1.1

- Added activity package with AI Activity contract and lifecycle runtime.
- Added provider package with provider interface, registry, and echo provider.
- Added analytics package with usage recording and summaries.
- Added gateway package as the single AI usage entrypoint.
- Exposed activity, provider, analytics, and gateway APIs through the SDK.
- Updated runtime composition to include activity, analytics, providers, and gateway.
- Added revised requirements documentation with non-functional requirements.

## 0.1.2

- Added client package with Client Manifest types, validation, and registry.
- Added Gateway validation for registered client capability access.
- Added Gateway token and cost budget checks.
- Exposed client manifest APIs through the SDK.
- Updated runtime composition to include the client registry.

## 0.1.3

- Added Activity lifecycle DomainEvent types.
- Added optional ActivityRuntime event dispatching.
- Connected PlatformRuntime Activity lifecycle events to the memory EventStore.
- Exposed Activity event and EventDispatcher types through the SDK.

## 0.1.4

- Added dashboard package with dashboard-ready usage metrics.
- Added period filters for today, month, year, and all usage.
- Added grouping by client, capability, provider, and model.
- Exposed Dashboard Query APIs through the SDK.

## 0.1.5

- Added Analytics read APIs for outcomes and feedback.
- Added Dashboard metrics for outcome count, average outcome score, average ROI, feedback count, accepted count, edited count, and average rating.
- Added Dashboard aggregation tests for outcome and feedback signals.

## 0.1.6

- Added Gateway APIs for recording Activity outcomes and feedback.
- Added ActivityRuntime read access for owner validation.
- Added Gateway ownership checks before outcome and feedback mutation.
- Exposed Gateway outcome and feedback request contracts through the SDK.

## 0.1.7

- Added optional Gateway Knowledge lookup before provider execution.
- Added Client Manifest Knowledge allowlist filtering.
- Added ActivityResult.knowledgeUsed population from matched Knowledge records.
- Wired the PlatformRuntime Gateway to the memory Knowledge repository.

## 0.1.8

- Added Client Manifest default model support.
- Added Gateway provider/model resolution from ActivityRequest, Client Manifest defaults, and platform fallback.
- Added tests for manifest route defaults and ActivityRequest route overrides.

## 0.1.9

- Added Gateway enforcement for Client Manifest monthly token budgets.
- Added Gateway enforcement for Client Manifest monthly cost budgets.
- Added analytics-backed monthly usage calculation for budget checks.
- Added Gateway tests for projected monthly budget rejection.

## 0.1.10

- Added Dashboard client monthly budget view.
- Added remaining token and cost metrics.
- Added budget usage ratio and limit reached flags.

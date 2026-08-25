# Changelog

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

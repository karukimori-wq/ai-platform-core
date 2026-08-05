# Changelog

## 0.1.39

- Updated local contract references to include `app-responsibilities.md`, `identity-contract.md`, and `platform-admin.md`.
- Clarified that `app-responsibilities.md` controls cross-app responsibility boundaries.
- Documented that Platform Admin observes AI Platform Core operational state but does not execute AI Activities or own Usage.
- Added a Platform Admin compatible HTTP health view at `/v1/health`.

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
- Connected Dashboard Query Service to PlatformRuntime.

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
- Exposed budget dashboard data through runtime and SDK.

## 0.1.11

- Added Dashboard budget status values for client budget metrics.
- Added warning status at 80 percent token or cost usage.
- Added exceeded status when token or cost budget limit is reached.
- Added Dashboard tests for budget status calculation.

## 0.1.12

- Added Dashboard client budget alert query.
- Added alert filtering for warning and exceeded client budget status.
- Exposed client budget alert view through the SDK.
- Added Dashboard tests for budget alert filtering.

## 0.1.13

- Added deterministic Dashboard budget alert ordering.
- Prioritized exceeded budget alerts before warning alerts.
- Added clientId ordering for alerts with the same status.

## 0.1.14

- Added Dashboard budget alert reasons.
- Added token and cost reason values for warning and exceeded alerts.
- Exposed budget alert reason types through the SDK.

## 0.1.15

- Added Dashboard budget alert summary.
- Added total, warning, and exceeded counts to budget alert views.
- Exposed budget alert summary type through the SDK.

## 0.1.16

- Added reason-level counts to Dashboard budget alert summary.
- Added token and cost alert reason totals for Dashboard views.

## 0.1.17

- Added status and reason filters to Dashboard budget alert queries.
- Added filtered budget alert summary behavior.

## 0.1.18

- Added Gateway retry policy for provider chat execution.
- Added Gateway fallback provider policy for failed provider execution.
- Exposed Gateway resilience policy types through the SDK.

## 0.1.19

- Added OpenAI-compatible chat provider adapter.
- Added fetch-injected provider tests without external network calls.
- Exposed OpenAI-compatible provider factory through the SDK.

## 0.1.20

- Added secrets package for platform-owned secret storage.
- Added memory and environment secret readers.
- Wired SecretStore into PlatformRuntime and SDK exports.

## 0.1.21

- Updated OpenAI-compatible provider to read API keys from SecretReader.
- Removed direct API key ownership from provider adapter config.
- Added provider tests for secret-backed authorization and missing secret errors.

## 0.1.22

- Added fetch-compatible Gateway HTTP handler package.
- Added HTTP request parsing for Gateway run requests.
- Exposed HTTP handler utilities through the SDK.

## 0.1.23

- Added platform HTTP handler routing for Gateway runs and analytics usage reads.
- Added client-scoped usage total endpoint for application API servers.
- Documented application API server integration and usage lookup.

## 0.1.24

- Added period filters to HTTP usage totals.
- Defaulted usage total queries to the current month.
- Exposed HTTP usage period type through the SDK.

## 0.1.25

- Added capability, workflow, provider, and model breakdowns to HTTP usage totals.
- Kept usage endpoint responses aggregate-only for client-scoped reporting.

## 0.1.26

- Added storage-backed Analytics repository factory for durable usage records.
- Exposed stored Analytics repository creation through the SDK.

## 0.1.27

- Added PlatformRuntime dependency injection options.
- Allowed custom Analytics repositories to back Gateway recording and Dashboard queries.

## 0.1.28

- Added shared Professional Studio integration event types.
- Documented AI Platform Core as the common AI foundation below Professional Studio.
- Clarified that Growth Engine and Professional Studio business logic is outside AI Platform Core.

## 0.1.29

- Added Event Engine subscription handles and unsubscribe support.
- Added filtered EventStore queries by aggregate, event type, and occurrence time.
- Exposed EventPublisher, EventSubscriberRegistry, EventSubscription, and EventQuery through the SDK.

## 0.1.30

- Clarified API versus Event responsibilities across Growth Engine, Professional Studio, and AI Platform Core.
- Separated Business Events from AI Activity Events and expanded shared event names.
- Added platform event envelope, event category, delivery state, schema validation, retry, and dead-letter contracts.
- Clarified that Customer, Session, Report, reservation, commerce payment, SNS Planner, and business orchestration are outside AI Platform Core ownership.
- Documented capability-first application integration, AI Usage Billing boundaries, and privacy-minimized external context references.

## 0.1.31

- Added local contracts and integration docs that reference `professional-platform-contracts` as the source of truth.
- Documented AI Platform Core repository obligations for shared boundaries, APIs, events, capabilities, privacy, and SNS Planner integration.

## 0.1.32

- Aligned platform integration event types with the versioned `professional-platform-contracts` event catalog.
- Standardized external Professional Studio deliverable references on `Report` and `reportId`.
- Kept `studio.recommendation.created.v1` pending-only and excluded it from stable integration event types.
- Documented SNS Planner request inputs while keeping business targeting, offer, and CTA decisions in Growth Engine.

## 0.1.33

- Added managed memory EventBus support for consumer state, idempotent delivery, retry, dead-letter recording, and replay.
- Exposed managed EventBus contracts and defaults through the SDK.

## 0.1.34

- Added Event Engine audit records for publish, delivery, dead-letter, and replay actions.
- Added a standard Platform Event envelope validator for required fields, event versions, allowed event types, and category consistency.

## 0.1.35

- Added MVP identity attribution fields to Activity requests and Usage records: `workspaceId`, `userId`, and optional `ownerUserId`.
- Added Usage summary grouping by workspace and user.
- Added HTTP usage filtering by `workspaceId` and `userId`.
- Documented that `professionalId` is a future extension concept, not a required MVP field.

## 0.1.36

- Added Dashboard grouping by `workspaceId` and `userId`.
- Added Dashboard filtering by `workspaceId` and `userId`.

## 0.1.37

- Updated API server integration docs for `createPlatformRuntime`, budget shape, and MVP workspace/user attribution.
- Updated requirements docs to include `workspaceId`, `userId`, optional `ownerUserId`, and Dashboard workspace/user dimensions.

## 0.1.38

- Added HTTP Dashboard usage view endpoint at `/v1/dashboard/usage`.
- Added client, workspace, and user scoped Dashboard HTTP tests.

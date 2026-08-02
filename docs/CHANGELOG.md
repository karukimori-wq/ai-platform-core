# Changelog

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
- Added token and cost alert reason totals for budget alert views.

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

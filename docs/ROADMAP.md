# Roadmap

## v0.0.1 Platform Initialization

- Monorepo
- pnpm
- Turborepo
- ESLint
- Prettier
- Vitest

## v0.0.2 Kernel

- Result
- PlatformError
- Logger
- Clock
- UUID
- Config
- DI container
- Value objects

## v0.0.3 Event Engine

- Event
- EventBus
- Publisher and subscriber model
- Dispatcher
- EventStore
- MemoryStore

## v0.0.4 Capability Runtime

- Capability interface
- Registry
- Permission checker
- Runtime executor
- Metadata

## v0.0.5 Workflow Runtime

- Workflow definition
- Workflow instance
- Approval state
- Retry metadata
- Rollback metadata
- Timeout metadata

## v0.1.0 SDK Public API

- Capability SDK
- Workflow SDK
- Storage SDK
- Plugin SDK
- Knowledge SDK

## v0.1.1 AI Activity Observability

- Activity runtime
- Provider registry
- AI Gateway
- Analytics repository
- Gateway usage recording
- Revised requirements document

## v0.1.2 Client Manifest Enforcement

- Client manifest registry
- Client capability allowlist validation
- Activity budget checks in Gateway
- SDK exports for client manifests

## v0.1.3 Activity Event Sourcing

- Activity lifecycle events
- Runtime EventStore connection
- EventBus subscription support for Activity events

## v0.1.4 Dashboard Query Engine

- Today/month/year/all metrics
- Client, capability, provider, and model grouping
- SDK dashboard query API

## v0.1.5 Outcome and Feedback Metrics

- Analytics outcome and feedback read models
- Dashboard outcome score, ROI, acceptance, edit, and rating metrics
- Dashboard test coverage for outcome and feedback aggregation

## v0.1.6 Gateway Outcome and Feedback Recording

- Gateway outcome recording API
- Gateway feedback recording API
- Activity ownership validation before outcome or feedback mutation
- SDK exports for Gateway outcome and feedback request contracts

## v0.1.7 Gateway Knowledge Context

- Gateway Knowledge search before provider execution
- Client manifest Knowledge allowlist enforcement
- ActivityResult.knowledgeUsed population from matched Knowledge records
- PlatformRuntime Knowledge repository wiring

## v0.1.8 Gateway Provider Model Routing

- Client Manifest default provider and model
- ActivityRequest provider and model override support
- Platform fallback provider and model
- Gateway tests for route resolution order

## v0.1.9 Client Monthly Budget Enforcement

- Gateway monthly token budget checks from Client Manifest
- Gateway monthly cost budget checks from Client Manifest
- Analytics-backed budget usage calculation
- Gateway tests for projected monthly budget rejection

## v0.1.10 Dashboard Client Budget View

- Dashboard client monthly budget query
- Remaining token and cost metrics
- Usage ratio and limit reached flags
- Runtime and SDK exposure for budget dashboard data

## v0.1.11 Dashboard Budget Status

- Dashboard budget status values: ok, warning, exceeded
- 80 percent warning threshold for token and cost budget usage
- Dashboard tests for warning and exceeded states

## v0.1.12 Dashboard Budget Alerts

- Dashboard client budget alert query
- Warning and exceeded client filtering
- SDK exposure for budget alert view

## v0.1.13 Dashboard Alert Ordering

- Exceeded budget alerts before warning alerts
- Deterministic clientId ordering within the same status

## v0.1.14 Dashboard Alert Reasons

- Token and cost alert reason values
- SDK exposure for budget alert reason types

## v0.1.15 Dashboard Alert Summary

- Total, warning, and exceeded alert counts
- SDK exposure for budget alert summary type

## v0.1.16 Dashboard Alert Reason Counts

- Reason-level counts in budget alert summary
- Token and cost alert reason totals for Dashboard views

## v0.1.17 Dashboard Alert Filters

- Status filters for budget alert queries
- Reason filters for budget alert queries
- Filtered alert summary totals

## v0.1.18 Gateway Retry And Fallback

- Retry policy for provider chat execution
- Fallback provider policy for failed provider execution
- SDK exposure for Gateway resilience policy types

## v0.1.19 OpenAI-Compatible Provider

- OpenAI-compatible chat completions adapter
- Fetch injection for testable provider calls
- SDK exposure for provider adapter factory

## v0.1.20 Platform Secrets

- Platform-owned SecretStore package
- Memory and environment secret readers
- Runtime and SDK exposure for secret management

## v0.1.21 Secret-Backed Provider Credentials

- SecretReader-backed OpenAI-compatible provider credentials
- Provider adapter config without direct API key ownership
- Tests for missing provider secrets

## v0.1.22 Gateway HTTP Handler

- Fetch-compatible HTTP handler for Gateway run requests
- Application API server integration surface
- SDK exports for HTTP handler utilities

## v0.1.23 HTTP Usage Endpoint

- Platform HTTP handler with Gateway and analytics routes
- Client-scoped usage totals endpoint
- Application API server integration guide

## v0.1.24 HTTP Usage Period Filters

- Today, month, year, and all-period usage total filters
- Current-month default usage totals
- SDK exposure for HTTP usage period values

## v0.1.25 HTTP Usage Breakdowns

- Capability, workflow, provider, and model usage breakdowns
- Aggregate-only client-scoped reporting for application dashboards

## v0.1.26 Stored Analytics Repository

- Storage-backed Analytics repository for durable usage records
- SDK factory for wiring persistent application storage

## v0.1.27 Runtime Dependency Injection

- PlatformRuntime options for injected runtime dependencies
- Custom Analytics repository wiring for Gateway and Dashboard

## v0.1.32 Contract Event Alignment

- Versioned integration event names from `professional-platform-contracts`
- `Report` terminology for external Professional Studio deliverables
- Pending recommendation event excluded from stable contracts
- SNS Planner input boundary documented

## v0.1.33 Managed Event Delivery

- Consumer delivery state tracking
- Idempotent memory event delivery
- Retry and dead-letter behavior
- Event replay through stored events

## v0.1.34 Event Validation And Audit

- Platform Event envelope validation
- Allowed event type validation
- Category consistency checks
- Managed EventBus audit log records

## v0.1.28 Professional Studio Event Boundary

- Shared integration event type names for Growth Engine and Professional Studio
- AI Platform Core responsibility boundary documentation
- SDK exposure for Professional Studio integration events

## v0.1.29 Event Adapter Boundary

- Event subscription handles and unsubscribe support
- Filtered EventStore reads for aggregate, type, and time windows
- SDK exports for publisher, subscriber registry, subscription, and query contracts

## v0.1.30 Growth Engine Boundary Alignment

- API/Event separation for synchronous operations and asynchronous state changes
- Business Event and AI Activity Event separation
- Expanded event names and event envelope contracts
- Capability-first integration for Professional Studio and Growth Engine AI calls
- AI Usage Billing, privacy, and external reference boundaries

## v0.1.31 Contracts Repository Adoption

- Local AI Platform Core contracts reference document
- Local AI Platform Core integration guide
- Explicit dependency on `professional-platform-contracts` as shared source of truth

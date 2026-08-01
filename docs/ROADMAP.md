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

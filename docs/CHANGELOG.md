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

# AI Platform Core

AI Platform Core is a TypeScript monorepo for building reusable platform primitives for AI applications.

This repository provides only platform code:

- Kernel
- AI Gateway
- Client manifest registry
- Activity runtime
- Provider registry
- Event engine
- Capability runtime
- Workflow runtime
- Analytics engine
- Dashboard query engine
- Knowledge engine
- Plugin runtime
- SDK

Application-specific business logic belongs in separate repositories.

## Principles

- Platform First: no application-specific code in this repository.
- Capability First: every executable feature is represented as a capability.
- Event First: events are the source of truth.
- Workflow First: workflows orchestrate capabilities.
- Human Approval: AI proposes; humans approve final decisions.
- SDK Boundary: applications should depend on `@ai-platform-core/sdk`.

## Packages

| Package | Role |
| --- | --- |
| `@ai-platform-core/kernel` | Result, errors, logger, clock, UUID, config, DI, value objects |
| `@ai-platform-core/client` | Client manifest registry and capability access validation |
| `@ai-platform-core/activity` | AI Activity contract, lifecycle, outcome, feedback |
| `@ai-platform-core/provider` | Provider interface, registry, echo provider for tests |
| `@ai-platform-core/gateway` | Single AI entrypoint, provider routing, usage recording |
| `@ai-platform-core/analytics` | Usage records and summary by client, capability, provider, model |
| `@ai-platform-core/dashboard` | Dashboard-ready usage metrics by period and dimension |
| `@ai-platform-core/event` | Domain events, event bus, dispatcher, memory event store |
| `@ai-platform-core/capability` | Capability interface, registry, permission checker, runtime |
| `@ai-platform-core/workflow` | Workflow definitions, instances, approval, retry hooks |
| `@ai-platform-core/knowledge` | Knowledge, references, confidence, memory search |
| `@ai-platform-core/plugin` | Plugin manifest and lifecycle runtime |
| `@ai-platform-core/storage` | Memory key-value storage and environment reader |
| `@ai-platform-core/runtime` | Composed platform runtime |
| `@ai-platform-core/sdk` | Public API surface |

## Development

```bash
pnpm install
pnpm check
```

## Roadmap

The first stable core should be grown in this order:

1. Kernel
2. Activity
3. Provider
4. Gateway
5. Analytics
6. Event
7. Capability
8. Workflow
9. SDK
10. Validate with one real application repository

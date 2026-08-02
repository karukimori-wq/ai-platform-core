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
| `@ai-platform-core/client` | Client manifest registry, provider/model defaults, and capability access validation |
| `@ai-platform-core/activity` | AI Activity contract, lifecycle, outcome, feedback |
| `@ai-platform-core/provider` | Provider interface, registry, echo provider for tests |
| `@ai-platform-core/gateway` | Single AI entrypoint, provider/model routing, allowed knowledge lookup, usage, outcome, and feedback recording |
| `@ai-platform-core/http` | Fetch-compatible HTTP handlers for application API servers |
| `@ai-platform-core/analytics` | Usage, outcome, and feedback records with summary APIs |
| `@ai-platform-core/dashboard` | Dashboard-ready usage, outcome, feedback, and ROI metrics by period and dimension |
| `@ai-platform-core/event` | Domain events, event bus, dispatcher, memory event store |
| `@ai-platform-core/capability` | Capability interface, registry, permission checker, runtime |
| `@ai-platform-core/workflow` | Workflow definitions, instances, approval, retry hooks |
| `@ai-platform-core/knowledge` | Knowledge, references, confidence, lifecycle, and memory search |
| `@ai-platform-core/plugin` | Plugin manifest and lifecycle runtime |
| `@ai-platform-core/storage` | Memory key-value storage and environment reader |
| `@ai-platform-core/runtime` | Composed platform runtime |
| `@ai-platform-core/sdk` | Public API surface |

## Development

```bash
pnpm install
pnpm check
```

## Playground

Run the playground without any external AI API key:

```bash
pnpm --filter @ai-platform-core/playground build
node apps/playground/dist/index.js
```

The playground registers a sample client, `fortune_teller_a`, runs `report.generate`
through the built-in `echo` provider, and prints usage analytics plus monthly
budget metrics by client.

Real provider credentials should stay server-side. Register an OpenAI-compatible
provider with a `SecretReader`, store the key in `runtime.secrets` or an
environment-backed reader, and route application requests through the Gateway so
client usage, tokens, cost, and monthly limits are recorded centrally.

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

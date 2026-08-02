# AI Platform Core Requirements v1.0

## Correction Summary

The original requirements were directionally strong, but implementation would drift without these corrections:

| Area | Correction |
| --- | --- |
| Platform scope | Keep this repository focused on platform, runtime, engine, and SDK code only. |
| AI Activity | Treat AI Activity as the main managed unit, not app names or provider calls. |
| Gateway | Make the AI Gateway the only runtime entrypoint for AI usage. |
| Analytics | Implement usage visibility before learning or optimization. |
| Provider | Keep providers replaceable through interfaces. |
| Learning | Keep Learning Engine out of MVP; define future extension points only. |
| Non-functional requirements | Add performance, retention, privacy, availability, and provider-switching rules. |
| Public API | Expose application-facing APIs through `@ai-platform-core/sdk`. |

## Purpose

AI Platform Core is not a framework for a single AI application. It is a common platform for managing, observing, analyzing, and eventually optimizing AI Activities across Web applications, bots, assistants, CLIs, APIs, AI employees, and future AI services.

The platform's core value is to turn AI usage into an asset:

- Which client used AI
- Which capability was executed
- Which provider and model were used
- How many tokens were consumed
- How much cost was incurred
- How long the activity took
- Which output was produced
- Which outcome and feedback were recorded
- What ROI was achieved

## Principles

- Platform First: no application-specific business logic.
- AI Activity First: the managed unit is an AI Activity.
- Capability First: every executable feature is represented as a Capability.
- Event First: important changes must be representable as Events.
- Gateway First: all AI usage must pass through the AI Gateway.
- Human Approval: AI proposes; humans decide.
- Learning Ready: MVP must be extendable toward learning, but not implement learning.

## MVP Scope

MVP does not make AI smarter. MVP makes AI usage visible.

MVP must capture:

- AI usage count
- Input, output, and total tokens
- Cost
- Provider
- Model
- Latency
- Workflow
- Capability
- Activity
- Feedback
- Outcome

## Core Packages

| Package | Responsibility |
| --- | --- |
| `kernel` | Result, errors, logger, config, clock, UUID, DI, entity, value objects |
| `client` | Client Manifest registration, validation, and capability access checks |
| `activity` | AI Activity contract, lifecycle, result, outcome, feedback |
| `gateway` | Authentication, provider routing, token/cost/latency recording |
| `provider` | Replaceable AI provider interfaces |
| `analytics` | Usage records and summaries |
| `dashboard` | Dashboard-ready usage views by period and dimension |
| `event` | EventBus, dispatcher, subscribers, EventStore |
| `capability` | Capability interface, registry, permission checks, execution |
| `workflow` | Workflow definitions, instances, approval, retry, rollback, timeout |
| `knowledge` | Knowledge storage and simple search |
| `storage` | Memory/File/Environment storage abstractions |
| `runtime` | Composed internal runtime |
| `sdk` | Public application-facing API |

## AI Activity Contract

`ActivityRequest` includes:

- client
- capability
- workflow
- goal
- context
- budget
- provider
- model
- input

`ActivityResult` includes:

- activityId
- output
- provider
- model
- tokens
- cost
- latencyMs
- knowledgeUsed

`ActivityOutcome` includes:

- activityId
- result
- score
- roi

`ActivityFeedback` includes:

- activityId
- rating
- edited
- accepted
- memo

## Client Manifest

Each client must declare a manifest before it can execute platform capabilities.

`ClientManifest` includes:

- id
- name
- type
- version
- provider
- defaultModel
- capabilities
- knowledge
- analytics
- budget
- metadata

Gateway must reject a request when:

- the authenticated client differs from `ActivityRequest.client`
- the client is not registered
- the requested capability is not declared by the client manifest
- the provider response exceeds the Activity token budget
- the provider response exceeds the Activity cost budget
- the registered client has reached or would exceed its monthly token budget
- the registered client has reached or would exceed its monthly cost budget
- the authenticated client does not own the Activity being updated with outcome or feedback

Gateway must only attach Knowledge records declared by the registered Client Manifest.

Gateway must resolve provider and model in this order:

1. `ActivityRequest.provider` / `ActivityRequest.model`
2. `ClientManifest.provider` / `ClientManifest.defaultModel`
3. platform fallback provider `echo` and model `default`

## Activity Events

Activity lifecycle changes must be representable as DomainEvents.

Initial Activity events:

- ActivityCreated
- ActivityStatusChanged
- ActivityCompleted
- ActivityOutcomeRecorded
- ActivityFeedbackRecorded

The memory runtime stores these events through EventStore. Future infrastructure adapters can replace the memory EventStore with PostgreSQL, Redis, Kafka, or another event backend without changing the Activity contract.

## Dashboard

Dashboard queries must be API-ready and UI-agnostic.

Initial dashboard periods:

- today
- month
- year
- all

Initial dashboard dimensions:

- client
- capability
- provider
- model

Initial metrics:

- usageCount
- totalTokens
- totalCost
- averageLatencyMs
- monthlyTokenLimit
- monthlyCostLimit
- remainingTokens
- remainingCost
- tokenUsageRatio
- costUsageRatio
- tokenLimitReached
- costLimitReached
- budgetStatus
- outcomeCount
- averageOutcomeScore
- averageRoi
- feedbackCount
- acceptedCount
- editedCount
- averageRating

Initial dashboard queries:

- usage dashboard view
- client monthly budget view
- client monthly budget alert view

## Non-Functional Requirements

| Category | Requirement |
| --- | --- |
| Gateway response | Gateway orchestration overhead should remain below 100 ms excluding provider latency in memory mode. |
| Availability | Core runtime should not depend on a specific external provider. |
| Privacy | API keys and secrets are held by platform infrastructure only; clients do not hold provider secrets. |
| Retention | Usage, outcome, feedback, and event retention must be configurable by infrastructure adapters. |
| Provider switching | Provider replacement must not change ActivityRequest or ActivityResult contracts. |
| Testability | Each package must be testable independently. |
| Type safety | Strict TypeScript is required. `any` is prohibited. |
| Observability | Gateway must record provider, model, tokens, cost, latency, client, capability, and workflow. |
| Client boundary | Gateway must validate Activity ownership before recording outcome or feedback. |
| Knowledge boundary | Gateway must not attach Knowledge records outside the client manifest allowlist. |
| Budget boundary | Gateway must enforce both per-Activity budget and Client Manifest monthly budget. |

## Not Included In MVP

- AI Advisor
- Recommendation Engine
- Prompt Optimizer
- Learning Engine
- Decision Engine
- Advanced Model Router
- Marketplace
- Blueprint system
- Development platform
- GitHub connector
- AI employee management
- Knowledge Graph
- Pattern Engine

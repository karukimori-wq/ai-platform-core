# Contracts

AI Platform Core follows the shared contracts defined in:

https://github.com/karukimori-wq/professional-platform-contracts.git

The contracts repository is the source of truth for cross-system language, ownership boundaries, API conventions, event naming, shared schemas, and repository-specific implementation guidance. This repository must not redefine those contracts independently.

## Required Contract Documents

AI Platform Core implementers must read these contract documents before changing cross-system behavior:

- `docs/contracts/platform-boundaries.md`
- `docs/contracts/shared-glossary.md`
- `docs/contracts/api-catalog.md`
- `docs/contracts/event-catalog.md`
- `docs/contracts/data-ownership.md`
- `docs/repositories/ai-platform-core.md`
- `docs/adoption-guide.md`
- `schemas/entities/activity.schema.json`
- `schemas/events/event-envelope.schema.json`
- `schemas/events/ai.activity.completed.v1.schema.json`

## AI Platform Core Ownership

AI Platform Core owns the AI execution platform:

- Workspace, project, environment, role, and permission foundations
- API key and webhook infrastructure
- Capability registry
- AI Activity execution and logging
- Usage tracking and AI Usage Billing records
- Prompt templates and Prompt Version resolution
- Tool registry
- Workflow runtime
- Evaluators
- AI events with the `ai.*` prefix

AI Platform Core must not own:

- Customer acquisition strategy
- Customer master data
- Nurturing workflow decisions
- Commerce payment records
- Professional Studio domain calculations
- Report PDF layout
- SNS post objective selection
- SNS Planner business state
- Growth Engine business workflow decisions

## Contract Alignment Rules

- Use APIs for synchronous operations where the caller needs an immediate response.
- Use events for state changes and downstream asynchronous processing.
- Treat Growth Engine as the canonical owner of Customer data.
- Treat Professional Studio as the owner of Session, Report, and domain records.
- Treat SNS Planner as a post creation tool called by Growth Engine.
- Expose AI features through capabilities instead of raw prompt or model contracts.
- Keep AI usage billing separate from Growth Engine commerce payment.
- Never make AI Platform Core the business workflow orchestrator for Growth Engine.

## Approved Cross-System Names

Use `Report`, not `Document`, for generated Professional Studio deliverables in external contracts.

Approved Professional Studio APIs:

- `Session.Start`
- `Session.Complete`
- `Report.Generate`
- `Report.Preview`
- `Report.ExportPdf`
- `ServiceReference.List`

Approved Professional Studio events:

- `studio.session.started.v1`
- `studio.session.completed.v1`
- `studio.report.generated.v1`
- `studio.service_reference.updated.v1`

Do not use these legacy names in cross-system contracts:

- `Session.Started`
- `Session.Completed`
- `Document.Generated`

Do not implement `studio.recommendation.created.v1` as a stable event. It is pending in the contracts repository.

## Event Contract

AI Platform Core publishes and consumes events according to the contracts repository event envelope and naming rules.

AI-owned events use the `ai.*` prefix. Approved examples include:

- `ai.activity.created.v1`
- `ai.activity.completed.v1`
- `ai.activity.failed.v1`
- `ai.usage.recorded.v1`

Business events from other systems must remain owned by those systems:

- `growth.*` events are owned by Growth Engine.
- `studio.*` events are owned by Professional Studio / Numeria Studio.
- `sns.*` events are owned by SNS Planner.

AI Platform Core may store event references for traceability, but it must not become the business source of truth for Growth Engine or Professional Studio state.

## API Contract

AI Platform Core provides these approved cross-system API operations:

- `Capability.Register`
- `Activity.Create`
- `Activity.Get`
- `Usage.List`
- `PromptTemplate.Render`

AI Platform Core may support internal routes or SDK methods, but external naming should remain aligned to the approved operation names.

## Capability Naming

Applications should call AI Platform Core by capability name. Product repositories must not depend on raw prompt names, provider-specific request bodies, or model-specific contracts.

Capability names may support product-specific work, but they must not move ownership into AI Platform Core.

Examples aligned to current contracts:

- `Report.Generate`
- `PostDraft.Generate`
- `Usage.List`
- `Customer.Find`

## Change Process

Before changing any cross-system contract:

1. Check the contracts repository first.
2. Confirm the change does not move business ownership into AI Platform Core.
3. Update the contracts repository before relying on a new shared contract.
4. Add or update local implementation docs only after the shared contract exists.
5. Keep local code and docs aligned with the published contracts.

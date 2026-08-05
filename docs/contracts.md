# AI Platform Core Contracts

AI Platform Core adopts the shared contracts from:

- https://github.com/karukimori-wq/professional-platform-contracts

The contracts repository is the source of truth for cross-system terminology,
ownership, API operation names, event names, and shared schemas.

## Required References

Read these files before changing cross-product behavior:

- `docs/contracts/app-responsibilities.md`
- `docs/contracts/platform-boundaries.md`
- `docs/contracts/shared-glossary.md`
- `docs/contracts/identity-contract.md`
- `docs/contracts/api-catalog.md`
- `docs/contracts/event-catalog.md`
- `docs/contracts/data-ownership.md`
- `docs/repositories/platform-admin.md`
- `docs/repositories/ai-platform-core.md`
- `docs/repositories/numeria-studio.md`
- `docs/repositories/sns-planner.md`
- `docs/adoption-guide.md`

`docs/contracts/app-responsibilities.md` is the controlling source for app
responsibility boundaries. If a local AI Platform Core assumption conflicts
with that document, update the local implementation or update the contracts
repository before changing product behavior.

## AI Platform Core Responsibility

AI Platform Core owns:

- Workspace, Project, Environment, Role, and Permission foundations
- API key and webhook infrastructure
- Capability registry
- Activity execution and logging
- AI usage tracking
- Prompt templates
- Tool registry
- Workflow runtime
- Evaluators
- AI events with the `ai.*` prefix

AI Platform Core must not own:

- Customer master data
- acquisition strategy
- nurturing workflow decisions
- Business Plan rules
- Professional Studio domain calculations
- Report PDF layout
- SNS campaign objective selection
- SNS Planner business state
- Growth Engine business workflow decisions
- Stripe payment state or execution
- Sales ledger
- Public site publishing

## Data Ownership

Customer canonical data belongs to Growth Engine.

Session and Report records belong to Professional Studio repositories such as
Numeria Studio.

SNS post drafts belong to SNS Planner.

AI Platform Core may store stable reference IDs for attribution and traceability,
but those references do not transfer ownership.

Allowed references include:

- `workspaceId`
- `userId`
- `ownerUserId`
- `projectId`
- `customerId`
- `sessionId`
- `reportId`
- `reservationId`
- `activityId`
- `capabilityId`

MVP identity scope:

- AI Platform Core Activity, Usage, and Capability execution history are scoped
  by `workspaceId + userId`.
- `ownerUserId` may be recorded when ownership attribution is required.
- `professionalId` is a future extension concept and is not a required MVP
  field.

## External Naming Rules

Use `Report`, not `Document`, in external contracts.

Approved Professional Studio capability/API names include:

- `Report.Generate`
- `Report.Preview`
- `Report.ExportPdf`

Approved Professional Studio event names include:

- `studio.session.started.v1`
- `studio.session.completed.v1`
- `studio.report.generated.v1`

Do not use legacy event names:

- `Session.Started`
- `Session.Completed`
- `Document.Generated`

Do not use `Document.*` names for cross-system APIs or capabilities.

## API Contract

AI Platform Core provides these approved cross-system operations:

- `Capability.Register`
- `Activity.Create`
- `Activity.Get`
- `Usage.List`
- `PromptTemplate.Render`

Applications call AI Platform Core by capability name. They must not depend on
provider-specific request bodies, prompt internals, or model-specific contracts.

Approved capability examples from the contracts include:

- `Customer.Find`
- `Report.Generate`
- `PostDraft.Generate`
- `Usage.List`

## Event Contract

AI Platform Core publishes AI-owned events:

- `ai.activity.created.v1`
- `ai.activity.completed.v1`
- `ai.activity.failed.v1`
- `ai.usage.recorded.v1`

Other prefixes remain owned by their source systems:

- `growth.*` belongs to Growth Engine.
- `studio.*` belongs to Professional Studio.
- `sns.*` belongs to SNS Planner.

`studio.recommendation.created.v1` is Pending and must not be implemented as a
stable event.

## Contract Change Rule

If AI Platform Core needs a new shared API, event, field, capability convention,
or ownership rule, update `professional-platform-contracts` first or in the same
change batch.

# AI Platform Core Integration

AI Platform Core integrates with Growth Engine, Professional Studio, and SNS
Planner through the shared contracts repository:

- https://github.com/karukimori-wq/professional-platform-contracts

## Integration Position

AI Platform Core is the AI execution platform. It is not the business workflow
orchestrator.

```text
Growth Engine
  -> business workflow decisions

Professional Studio
  -> Sessions, Reports, and domain records

SNS Planner
  -> SNS post drafts

AI Platform Core
  -> capabilities, activities, prompts, tools, workflows, usage
```

## API Versus Event

Use APIs when the caller needs an immediate result:

- create an AI Activity
- get Activity status
- list Usage
- render a Prompt Template
- register a Capability

Use events when a state change has already happened:

- AI Activity created
- AI Activity completed
- AI Activity failed
- AI Usage recorded
- Professional Studio Session completed
- Professional Studio Report generated
- Growth Engine Customer created
- SNS Planner post draft created

Events are notifications, not commands.

## Capability Entry Point

Applications call AI Platform Core by capability name.

Use shared external names:

- `Report.Generate`
- `PostDraft.Generate`
- `Customer.Find`
- `Usage.List`

Do not expose cross-system `Document.*` capability names. If an implementation
has internal document terminology, map it to `Report.*` at the external contract
boundary.

AI Platform Core resolves internal implementation details:

- provider
- model
- prompt version
- workflow
- tool
- knowledge
- evaluation
- usage recording

## External References

AI Platform Core may receive reference IDs for traceability:

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

These IDs are references, not ownership transfers.

For MVP requests, applications should send `workspaceId + userId` with AI
Activity execution requests so AI Platform Core can attribute Activity, Usage,
and Capability execution history to the correct workspace and signed-in
professional. `ownerUserId` is optional and should be used when ownership differs
from the acting user. Do not make `professionalId` mandatory for MVP.

Customer source of truth remains in Growth Engine. Session and Report source of
truth remain in Professional Studio. AI Platform Core stores only the minimum
context required for AI execution, usage attribution, and audit.

## Event Handling

AI Platform Core must support:

- idempotency by `eventId`
- versioned event types
- correlation IDs
- schema validation
- retry
- dead letter handling
- replay where supported
- audit logs

Approved AI events:

- `ai.activity.created.v1`
- `ai.activity.completed.v1`
- `ai.activity.failed.v1`
- `ai.usage.recorded.v1`

Approved consumed event examples:

- `growth.customer.created.v1`
- `studio.session.started.v1`
- `studio.session.completed.v1`
- `studio.report.generated.v1`
- `sns.post_draft.created.v1`
- `sns.post_draft.updated.v1`

Forbidden legacy names:

- `Session.Started`
- `Session.Completed`
- `Document.Generated`

Pending event not implemented:

- `studio.recommendation.created.v1`

## SNS Planner Flow

AI Platform Core does not call SNS Planner directly for business execution.

Expected flow:

```text
Growth Engine
  -> optionally calls AI Platform Core for analysis or content brief
Growth Engine
  -> decides purpose, targetAudience, cta, channel, tone, constraints
Growth Engine
  -> calls SNS Planner
SNS Planner
  -> creates post drafts
```

This keeps SNS strategy and campaign decisions in Growth Engine.

## Implementation Checklist

Before merging integration changes:

- Confirm the shared contract exists in `professional-platform-contracts`.
- Confirm the source-of-truth owner is unchanged.
- Use `Report`, not `Document`, externally.
- Use official versioned event names.
- Keep Pending events out of stable implementation.
- Use APIs for immediate work and events for state-change notification.
- Keep Customer, Session, Report, and SNS draft ownership outside AI Platform Core.
- Keep business decisions in Growth Engine or the relevant Professional Studio.

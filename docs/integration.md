# Integration

AI Platform Core integrates with Growth Engine, Professional Studio, and SNS Planner through the shared contracts repository:

https://github.com/karukimori-wq/professional-platform-contracts.git

This document describes how AI Platform Core applies those contracts locally.

## Integration Position

```text
Growth Engine
  acquisition, sales, customer nurturing, business workflow state

Professional Studio
  professional work, sessions, reports, domain records

AI Platform Core
  AI runtime, capabilities, prompts, tools, workflows, usage, AI events

SNS Planner
  SNS post draft creation requested by Growth Engine
```

AI Platform Core is not the business workflow orchestrator. It executes AI capabilities and records AI usage. Growth Engine decides business actions. Professional Studio owns domain work and Reports. SNS Planner creates post drafts.

## API Versus Event

Use APIs when the caller needs an immediate result:

- Execute an AI capability
- Fetch AI usage summary
- Register or inspect capabilities
- Render a prompt template
- Return an AI Activity result

Use events when a state change already happened:

- AI Activity created
- AI Activity completed
- AI Activity failed
- Usage recorded
- Professional session completed
- Report generated
- Customer created in Growth Engine

Events are notifications, not commands. AI Platform Core must not treat a business event as permission to decide the next Growth Engine action.

## Capability Entry Point

Applications should call AI Platform Core by capability name. They should not depend on prompt bodies, provider-specific request shapes, or model names.

Examples:

- `Report.Generate`
- `PostDraft.Generate`
- `Marketing.AnalyzeConsultationTrends`
- `Marketing.AnalyzeFunnel`
- `Marketing.DetectBottleneck`
- `Marketing.GenerateContentBrief`
- `Marketing.RecommendFollowup`
- `Marketing.RecommendRepeat`
- `Marketing.AnalyzeRevenue`
- `Marketing.GenerateNextActions`

AI Platform Core resolves the internal implementation:

- Provider
- Model
- Prompt Version
- Workflow
- Tool
- Knowledge
- Evaluation
- Usage recording

## External References

AI Platform Core may receive stable IDs from other systems for attribution and traceability:

- `workspaceId`
- `projectId`
- `customerId`
- `sessionId`
- `reportId`
- `reservationId`
- `activityId`
- `capabilityId`

These IDs are references, not ownership transfers.

Customer source of truth remains in Growth Engine. Session and Report source of truth remain in Professional Studio. AI Platform Core should store only the minimum context required for AI execution, usage attribution, and audit.

## Event Handling

AI Platform Core uses the contracts repository event envelope. Implementations must support:

- Idempotency by `eventId`
- Versioned event types
- Correlation IDs
- Consumer processing state
- Retry
- Dead letter handling
- Replay
- Schema validation
- Audit logs
- Partition keys where ordering matters

AI Platform Core publishes AI events with the `ai.*` prefix. Other event prefixes remain owned by their source systems.

Approved AI events:

- `ai.activity.created.v1`
- `ai.activity.completed.v1`
- `ai.activity.failed.v1`
- `ai.usage.recorded.v1`

Approved external events AI Platform Core may consume:

- `growth.customer.created.v1`
- `growth.customer.updated.v1`
- `growth.lead.converted.v1`
- `growth.reservation.created.v1`
- `growth.reservation.cancelled.v1`
- `studio.session.started.v1`
- `studio.session.completed.v1`
- `studio.report.generated.v1`
- `sns.post_draft.created.v1`
- `sns.post_draft.updated.v1`

Do not consume or publish these legacy names in cross-system integrations:

- `Session.Started`
- `Session.Completed`
- `Document.Generated`

Do not treat `studio.recommendation.created.v1` as stable. It is pending in the contracts repository.

## SNS Planner Integration

AI Platform Core does not call SNS Planner directly for business execution.

Expected flow:

```text
Growth Engine
  -> calls AI Platform Core capability
AI Platform Core
  -> returns analysis or content brief
Growth Engine
  -> decides whether to request SNS Planner
SNS Planner
  -> creates SNS draft
Growth Engine
  -> owns campaign and business follow-up state
```

This keeps SNS strategy, target selection, CTA decisions, and campaign decisions in Growth Engine.

SNS Planner expects Growth Engine to provide:

- `purpose`
- `targetAudience`
- `cta`
- `channel`
- `tone`
- `constraints`

## Privacy And Retention

AI Platform Core should minimize retained content:

- Do not accept personal data that is unnecessary for the selected capability.
- Use external reference IDs instead of copying customer master data.
- Do not persist full prompt text or consultation text by default.
- Configure storage policy per capability.
- Mask sensitive values in logs.
- Keep usage records separate from content records.
- Apply configurable retention periods.

## Local Implementation Checklist

Before adding or changing an integration:

- Confirm the shared contract exists in `professional-platform-contracts`.
- Confirm the source-of-truth owner is unchanged.
- Use API for immediate operations and Event for state-change notification.
- Use capability names as the app-facing AI entry point.
- Keep Growth Engine business decisions out of AI Platform Core.
- Keep Customer, Session, Report, and commerce payment ownership outside AI Platform Core.

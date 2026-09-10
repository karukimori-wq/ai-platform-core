# AI Platform Core Integration

AI Platform Core integrates with Growth Engine, Professional Studio, SNS
Planner, and Communication Planner through the shared contracts repository:

- https://github.com/karukimori-wq/professional-platform-contracts

Before changing cross-app behavior, read the latest main branch contracts:

- `docs/contracts/app-responsibilities.md`
- `docs/contracts/identity-contract.md`
- `docs/contracts/data-ownership.md`
- `docs/contracts/api-catalog.md`
- `docs/contracts/event-catalog.md`
- `docs/repositories/platform-admin.md`

`app-responsibilities.md` is the controlling responsibility matrix for all
apps. AI Platform Core changes must preserve those boundaries.

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

Communication Planner
  -> 1-to-1 inbox, person context, reply drafts, SafetyChecks, send decisions

AI Platform Core
  -> capabilities, activities, prompts, tools, workflows, usage
```

Platform Admin observes AI Platform Core health, contract compliance, API logs,
event logs, and AI logs by reference. It must not execute AI Activities or
become the Usage source of truth.

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
- Communication Planner message received
- Communication Planner reply draft created
- Communication Planner reply SafetyCheck completed

Events are notifications, not commands.

## Capability Entry Point

Applications call AI Platform Core by capability name.

Use shared external names:

- `Report.Generate`
- `PostDraft.Generate`
- `Customer.Find`
- `Usage.List`
- `Communication.ContextSummarize`
- `Communication.TopicExtract`
- `Communication.PromiseExtract`
- `Communication.NextActionSuggest`
- `Communication.ReplyGenerate`
- `Communication.ReplySafetyCheck`
- `Communication.IntentClassify`

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

## Plan-aware Gateway Contract

Managed application AI calls should use `/v1/gateway/run` with the plan-aware
Cloudflare entrypoint. The entrypoint enforces plan and usage before delegating
to the Gateway runtime.

Required scope:

- `appId` / `activity.client`
- `workspaceId`
- `userId`
- `planId`: `free`, `pro`, or `business`
- `featureKey`
- optional `activityId` for idempotent usage counting
- `x-client-id`
- `x-workspace-id`
- `x-user-id`
- optional `x-plan-id`
- optional `x-feature-key`
- optional `x-activity-id`
- optional `x-trace-id`
- optional `x-correlation-id`

The authenticated header scope must match the body/query scope. AI Platform Core
must reject mismatched workspace or user scopes before provider execution.

### Numeria Studio capabilities

Numeria Studio may call AI Platform Core for AI assistance around interpretation
and report generation only. The currently registered Production capabilities are:

- `studio.report.generate`
- `studio.report.ai_assist`

Free plan usage limits are enforced by APC for the feature keys defined in the
plan runtime. Pro is treated as normal use without the Free count limit. Business
capabilities are definable but Business is not sold or exposed by APC in this
release.

Numeria Studio remains the source of truth for Sessions and Reports. AI Platform
Core must not own report records, report snapshots, customer master data,
reservations, payments, sales, or UI state.

### Velvet capabilities

Velvet may call AI Platform Core for AI assistance around memory summarization,
search, and recall. The currently registered Production capabilities are:

- `velvet.memory.summary`
- `velvet.memory.search`
- `velvet.memory.recall`

Velvet remains the source of truth for customer/person memory records and the
user-facing memory experience. AI Platform Core must not become Velvet's CRM,
payment system, customer master, or message-draft authority.

### Provider behavior

Cloudflare Production registers the `openai` provider when `OPENAI_API_KEY` is
available in the runtime environment. OpenAI execution uses the Responses API
provider. `OPENAI_DEFAULT_MODEL` is optional; the Cloudflare runtime falls back
to its repository default when omitted.

Provider secrets must never be logged, returned, stored in D1, or committed to
GitHub.

## External References

AI Platform Core may receive reference IDs for traceability:

- `workspaceId`
- `userId`
- `ownerUserId`
- `projectId`
- `customerId`
- `personId`
- `conversationId`
- `messageId`
- `replyDraftId`
- `safetyCheckId`
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
truth remain in Professional Studio. Communication Person, Conversation,
Message, ConversationContext, Topic, Promise, Communication NextAction,
ReplyDraft, SafetyCheck, and ReplySendDecision source of truth remain in
Communication Planner. AI Platform Core stores only the minimum context required
for AI execution, usage attribution, and audit.

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
- `communication.message.received.v1`
- `communication.message.sent.v1`
- `communication.context.updated.v1`
- `communication.promise.created.v1`
- `communication.next_action.created.v1`
- `communication.reply_draft.created.v1`
- `communication.reply_draft.updated.v1`
- `communication.reply_safety.checked.v1`
- `communication.person_channel.linked.v1`

Forbidden legacy names:

- `Session.Started`
- `Session.Completed`
- `Document.Generated`

Pending event not implemented:

- `studio.recommendation.created.v1`

## Communication Planner Flow

AI Platform Core may provide `Communication.*` capabilities for analysis,
classification, extraction, and reply draft generation. Communication Planner
remains the source of truth for all 1-to-1 communication records and all send
safety decisions.

Reply generation requests must include:

- `workspaceId`
- `personId`
- `conversationId`

Communication Planner must supply only same-person context scoped by
`workspaceId + personId`. AI Platform Core must not merge context across
persons, conversations, or workspaces. Generated text is a ReplyDraft candidate
only; it must return to Communication Planner and pass the existing SafetyCheck
and send gate before any provider send is attempted.

AI Platform Core must not decide the final provider channel, send directly to
LINE, Instagram, or X, mutate a checked ReplyDraft after SafetyCheck, or create
an authoritative SendDecision. Those operations belong to Communication Planner.

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

- Read the latest `app-responsibilities.md`.
- Confirm the shared contract exists in `professional-platform-contracts`.
- Confirm the source-of-truth owner is unchanged.
- Use `Report`, not `Document`, externally.
- Use official versioned event names.
- Keep Pending events out of stable implementation.
- Use APIs for immediate work and events for state-change notification.
- Keep Customer, Session, Report, SNS draft, and Communication Planner record ownership outside AI Platform Core.
- Require `workspaceId + personId + conversationId` for Communication reply generation.
- Keep Communication generated replies as candidates until Communication Planner SafetyCheck and send gate approve them.
- Keep business decisions in Growth Engine or the relevant Professional Studio.
- For managed app AI calls, verify Plan API and Gateway Guard behavior before Production release.
- Never store provider secrets, payment data, customer master data, or full app-owned records in AI Platform Core.

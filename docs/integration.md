# AI Platform Core Integration

AI Platform Core integrates with Growth Engine, Numeria Studio, Velvet, SNS
Planner, and Communication Planner through the shared contracts repository:

- https://github.com/karukimori-wq/professional-platform-contracts

Before changing cross-app behavior, read the latest main branch contracts,
including:

- `docs/contracts/plan-contract.md`
- `docs/release-readiness/free-pro-release-implementation-requests.md`
- `docs/contracts/app-responsibilities.md`
- `docs/contracts/identity-contract.md`
- `docs/contracts/data-ownership.md`
- `docs/contracts/api-catalog.md`
- `docs/contracts/event-catalog.md`
- `docs/repositories/platform-admin.md`

The shared contracts repository is the source of truth for cross-app plan,
identity, ownership, release, and integration boundaries.

## Integration Position

AI Platform Core is the AI execution platform. It is not the subscription or
business workflow orchestrator.

```text
Growth Engine
  -> Customer, Reservation, Payment, Sales and business workflow decisions

Numeria Studio
  -> Sessions, Reports and appraisal-domain records

Velvet
  -> ProfessionalMemory and app-owned user experience records

SNS Planner
  -> SNS post drafts

Communication Planner
  -> 1-to-1 inbox, person context, reply drafts, SafetyChecks, send decisions

AI Platform Core
  -> AI Capability, AI Activity, AI Usage, AI Runtime, prompts, tools and knowledge
```

AI Platform Core does not own pricing, subscription billing authority, Stripe,
Customer, Reservation, Payment, or Sales.

Platform Admin observes AI Platform Core health, contract compliance, release
state, persistence, provider readiness, entitlement state, and Usage. It must not
execute AI Activities or become the Usage source of truth.

## API Versus Event

Use APIs when the caller needs an immediate result:

- execute an AI Activity
- get Activity status
- check entitlement
- read or record Usage
- render a Prompt Template
- register a Capability

Use events when a state change has already happened:

- AI Activity created
- AI Activity completed
- AI Activity failed
- AI Usage recorded
- Numeria Studio Session completed
- Numeria Studio Report generated
- Growth Engine Customer created
- SNS Planner post draft created
- Communication Planner message received
- Communication Planner reply draft created
- Communication Planner reply SafetyCheck completed

Events are notifications, not commands.

## Plan-aware Gateway Contract

Managed application AI calls use `/v1/gateway/run` through the plan-aware
Cloudflare entrypoint.

The authorization key is:

```text
appId + workspaceId + userId + planId + featureKey
```

Plan IDs are:

- `free`
- `pro`
- `business`

Business is recognized by contract but is unavailable in the current Free / Pro
release. APC must return Business as unavailable and must not make Business AI
capabilities usable or purchasable in this release.

Managed Gateway requests require:

- `activity.client` / `appId`
- `activity.workspaceId`
- `activity.userId`
- `x-source-app`
- `x-app-version`
- `x-plan-id`
- `x-feature-key`
- `x-activity-id`
- `x-client-id`
- `x-workspace-id`
- `x-user-id`

Trace headers should also be propagated when available:

- `x-trace-id`
- `x-correlation-id`

The authenticated header scope must match the request scope. AI Platform Core
must reject mismatched application, workspace, or user scope before provider
execution.

Plan API responses expose the shared release vocabulary, including:

- `planId`
- `featureKey`
- `usagePeriod`
- `usageCount`
- `limit`
- `overLimit`
- `entitlementResult`
- `appName`
- `appVersion`
- `traceId`
- `correlationId`

Usage is checked before provider execution and committed only after a successful
managed Gateway response. The idempotency key remains:

```text
appId|workspaceId|userId|activityId
```

A failed provider execution must not consume managed plan Usage.

## AI Usage limits

AI Platform Core records AI Usage, but it must not invent numeric AI-call quotas.
A numeric limit is enforced only when the shared plan contract explicitly defines
one for that AI feature.

In particular, Numeria Studio Free's monthly `20` limit is the number of
appraisals completed in Numeria Studio. It is not an APC AI-call limit. APC must
not reinterpret that domain limit as 20 AI calls.

For current Free / Pro AI features without a shared numeric AI quota:

- Usage is still recorded.
- `usageCount` increases for successful AI executions.
- `limit` is `null`.
- `usagePeriod` is `unlimited` for quota-enforcement purposes.
- `overLimit` remains `false`.

This does not mean the application itself has no domain limits. App-owned limits
remain with the application that owns the corresponding domain record.

## Numeria Studio capabilities

Numeria Studio may call AI Platform Core for AI assistance around interpretation
and report composition only.

Canonical shared-plan capability currently registered for Pro is:

- `numeria.report.wording_adjustment`

Legacy APC compatibility aliases remain temporarily registered while the app
integration migrates:

- `studio.report.generate`
- `studio.report.ai_assist`

The compatibility aliases do not create an APC-owned 20-call Free quota.

Numeria Studio remains the source of truth for Sessions and Reports. AI Platform
Core must not own appraisal records, Report Snapshots, customer master data,
reservations, payments, sales, or UI state.

## Velvet capabilities

Canonical shared-plan capability currently registered for Pro is:

- `velvet.ai.organize_suggest`

Legacy APC compatibility aliases remain temporarily registered while the app
integration migrates:

- `velvet.memory.summary`
- `velvet.memory.search`
- `velvet.memory.recall`

Velvet remains the source of truth for ProfessionalMemory and its user-facing
experience. AI Platform Core must not become Velvet's CRM, payment system,
customer master, or message-draft authority.

## Usage and metadata persistence

AI Platform Core may persist operational metadata required for AI execution,
Usage attribution, audit, and observability. Examples include:

- app metadata
- `workspaceId`
- `userId`
- `planId`
- `featureKey`
- `status`
- token counts or token estimates
- provider and model metadata
- event name
- activity ID
- trace ID
- correlation ID
- timestamps

AI Platform Core must not persist app-owned full-text payloads in Usage or
Activity audit storage. Persisted Cloudflare Activity records redact free-text
execution content such as Activity goal text, context, input, provider output,
and feedback memo.

Do not persist or send into Usage/audit metadata:

- full appraisal text
- full consultation text
- full conversation text/history
- full message text
- full customer master records
- payment details
- API keys
- Secrets
- secret prompts

AI execution may transiently receive content necessary to perform the requested
AI operation, but that does not transfer ownership of the content to APC and does
not permit storing the full content in Usage or Activity audit records.

## Provider behavior

Cloudflare Production registers the `openai` provider when `OPENAI_API_KEY` is
available in the runtime environment. OpenAI execution uses the Responses API
provider. `OPENAI_DEFAULT_MODEL` is optional; the Cloudflare runtime falls back
to its repository default when omitted.

Provider configuration readiness is exposed through:

- `/v1/providers/status`
- `/api/providers/status`

Provider status must never expose secret values.

## Release and readiness monitoring

Platform Admin and deployment verification may use the following surfaces:

- `/health`
- `/version`
- `/contracts/status`
- `/release/status`
- `/auth/status`
- `/persistence/status`
- `/v1/readiness`
- `/api/readiness`
- `/v1/providers/status`
- `/v1/integrations/status`

Legacy `/api/auth/status` and `/api/persistence/status` aliases remain supported.

Release status must show Free / Pro as the current release scope and Business as
unavailable / not purchasable.

## External References

AI Platform Core may receive reference IDs for traceability, such as:

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

These IDs are references, not ownership transfers. `professionalId` is not a
required MVP identity field.

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

Approved AI events include:

- `ai.activity.created.v1`
- `ai.activity.completed.v1`
- `ai.activity.failed.v1`
- `ai.usage.recorded.v1`

Approved consumed event examples include:

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

Forbidden legacy names include:

- `Session.Started`
- `Session.Completed`
- `Document.Generated`

## Communication Planner Flow

AI Platform Core may provide Communication capabilities for analysis,
classification, extraction, and reply draft generation. Communication Planner
remains the source of truth for all 1-to-1 communication records and all send
safety decisions.

Generated text is a ReplyDraft candidate only. AI Platform Core must not decide
the final provider channel, send directly to LINE, Instagram, or X, mutate a
checked ReplyDraft after SafetyCheck, or create an authoritative SendDecision.

## SNS Planner Flow

AI Platform Core does not call SNS Planner directly for business execution.
Growth Engine or the relevant owning application decides business purpose and
SNS Planner owns post drafts.

## Implementation Checklist

Before merging integration changes:

- Read the latest shared plan and release-readiness contracts.
- Confirm the source-of-truth owner is unchanged.
- Keep pricing, subscription, Stripe, Customer, Reservation, Payment, and Sales outside AI Platform Core.
- Use official versioned event names.
- Keep Business unavailable until the shared contract releases it.
- Do not invent numeric AI quotas from application-domain limits.
- Require managed Gateway scope including `appId + workspaceId + userId + planId + featureKey` and `appVersion`.
- Preserve idempotent Usage recording.
- Do not count failed provider calls as successful plan Usage.
- Never persist provider secrets, payment data, customer master data, full appraisal text, full consultation text, full conversation/message text, or secret prompts in APC Usage/Activity audit storage.

# AI Platform Core Development Log

This file records development handoffs that should be easy to ingest into External Intelligence or summarize for other app teams.

## 2026-09-12 - Free / Pro release contract alignment

### Repository

- `karukimori-wq/ai-platform-core`

### Summary

AI Platform Core has been aligned with the shared `professional-platform-contracts` Free / Pro release contract for AI entitlement, Usage, release monitoring, Business-unavailable behavior, metadata handling, and audit-data minimization.

### Implemented

- Plan authorization uses `appId + workspaceId + userId + planId + featureKey`.
- `free`, `pro`, and `business` are recognized PlanIds.
- Business remains defined but unavailable and not purchasable in the current release.
- Plan/Usage responses now expose `usagePeriod`, `usageCount`, `limit`, `overLimit`, and `entitlementResult`.
- Safe Usage metadata supports `appVersion`, `traceId`, `correlationId`, `eventName`, and token estimates.
- Managed Gateway execution requires `x-app-version` in addition to the existing app/plan/feature/scope/idempotency headers.
- Added `/release/status`, plus `/auth/status` and `/persistence/status` aliases for release monitoring.
- Provider readiness remains available through `/v1/providers/status` and `/api/providers/status` without exposing secret values.
- Added canonical Pro capability keys `numeria.report.wording_adjustment` and `velvet.ai.organize_suggest`; legacy APC keys remain temporary compatibility aliases.
- Removed APC-specific AI-call quotas that were not defined in the shared plan contract.
- Numeria Studio's Free `20/month` is treated as an appraisal-completion domain limit owned by Numeria Studio, not as a 20-call APC AI limit.
- Velvet's former APC `100` AI-call assumptions were likewise removed because no shared numeric AI quota defines them.
- Usage is still measured and recorded idempotently for successful calls even when `limit=null`.
- Managed Gateway Usage is checked before provider execution and committed only after a successful Gateway response.
- Failed provider calls do not consume managed plan Usage.

### Data minimization

Persistent APC audit/Usage storage now keeps operational metadata rather than app-owned full text.

Persisted Cloudflare Activity records redact:

- free-text Activity goal
- context
- input
- provider output
- feedback memo

Analytics persistence also removes free-text feedback memo while retaining rating/edited/accepted operational signals.

APC must not persist appraisal body text, consultation body text, conversation/message body text, full customer-master data, payment data, API keys, Secrets, or secret prompts in Usage/Activity audit storage.

### Release monitoring

Production verification has been aligned to check:

- `/health`
- `/version`
- `/contracts/status`
- `/release/status`
- `/auth/status`
- `/persistence/status`
- Plan Usage/Entitlement behavior
- Business unavailable / not purchasable
- provider readiness
- Plan Gateway post-success Usage commit policy
- D1 persistence
- Event persistence
- Activity/Usage persistence
- workspace/user isolation

### Ownership boundary

AI Platform Core owns:

- AI Capability
- AI Activity
- AI Usage
- AI Runtime
- entitlement evaluation for AI features
- provider routing
- AI Usage/audit metadata

AI Platform Core does not own:

- pricing
- subscription billing authority
- Stripe
- Customer
- Reservation
- Payment
- Sales
- Numeria Studio Session/Report records
- Velvet ProfessionalMemory records
- app-owned full-text conversations/messages

### Key commits

- `a5455b3926a398ea3d9978b4e4211732fb99a29b` - simplify Free / Pro entitlement condition after lint finding
- `ad350cbd07aeb01edaea3e3bfe180f7235cb358e` - align production-gate documentation with shared AI quota contract
- `c67f21e404ef2fb8853323cb2b7b2614d9bf47c4` - align APC integration documentation with Free / Pro plan contract
- `1766961cdbcbac3a5a72a9df1c4b4aa0343e5763` - record Free / Pro contract alignment in Changelog

## 2026-09-11 - Provider readiness monitoring

### Repository

- `karukimori-wq/ai-platform-core`

### Summary

AI Platform Core now exposes a safe provider-readiness surface for Platform Admin and production verification without returning provider secret values.

### Implemented

- Added `GET /v1/providers/status` and `GET /api/providers/status` to the plan-aware Cloudflare entrypoint.
- Reports whether the OpenAI provider is configured without returning `OPENAI_API_KEY` or any secret value.
- Reports that managed OpenAI execution uses the Responses API.
- Reports managed apps as `numeria-studio` and `velvet`.
- Reports whether the model selection comes from the environment or repository default without exposing the configured model value.
- Keeps the echo provider visible as the provider-secret-free Production E2E path.
- Added contract and runtime response tests, including a check that a supplied secret never appears in the response body.
- Consolidated Cloudflare production deployment to the single `Cloudflare Production` workflow; the duplicate Plan API production workflow was removed.

### Provider status behavior

```text
OPENAI_API_KEY configured
  -> status: success
  -> providers.openai.configured: true

OPENAI_API_KEY missing
  -> status: warning
  -> providers.openai.configured: false
```

The endpoint intentionally remains readable when degraded so Platform Admin can diagnose configuration problems.

### Useful commits

- `07707e27c3a41bef55fe04e737e31bcd4a27deed` - consolidate Cloudflare production workflow
- `11bd4ece9adb9bb21df44ebcbf0ac544f600f791` - expose provider readiness status
- `43db3aa7b8db0428ab81531fb13c5e3a2e7bef83` - cover provider readiness contract
- `d82d31310e002b02186d67836ccacef8f9f6eb35` - verify provider readiness response and secret non-disclosure

## 2026-09-11 - Safe managed Gateway usage commit

### Repository

- `karukimori-wq/ai-platform-core`

### Summary

Managed Gateway usage for Numeria Studio and Velvet is now checked before provider execution and committed only after a successful Gateway response. This prevents failed provider executions from consuming Free monthly quota.

### Implemented

- Added `checkUsageAllowance` for non-mutating plan/usage authorization.
- Updated `consumeUsage` to reuse the non-mutating allowance check.
- Updated `GatewayPlanGuard` to return validated plan context instead of consuming usage immediately.
- Added `commitGatewayPlanUsage` as the post-success usage commit step.
- Updated the Cloudflare plan-aware entrypoint to call the base Gateway first and consume usage only when the response is successful.
- Added test coverage proving allowance checks do not increment monthly usage.

### Behavior

Managed app Gateway requests still require:

- `x-source-app`
- `x-plan-id`
- `x-feature-key`
- `x-activity-id`
- `x-client-id`
- `x-workspace-id`
- `x-user-id`

Flow:

```text
request
  -> validate managed Gateway plan context
  -> check capability and remaining usage without consuming quota
  -> run AI Gateway/provider
  -> commit usage only when Gateway response is successful
```

### Useful commits

- `ffa9eab8d1b87e7b6fe2089b9b7279ff5ad174cd` - add plan usage allowance check
- `514363d678e9b55555806d382a9289a7ffa68783` - separate Gateway plan check from consume
- `7377a5b1c27d946861fd5a64d930781c01590793` - consume Gateway usage only after success
- `f75c16e265adfc3abe1ffe7371b2789b1dee7a8f` - cover plan usage allowance check

### Verification

- CI run `34500641641`: lint, test, and build completed successfully.

## 2026-09-11 - Plan-aware OpenAI Gateway production release

### Repository

- `karukimori-wq/ai-platform-core`

### Production URL

- `https://ai-platform-core.karukimori.workers.dev`

### Production verification

- Workflow: `Cloudflare Production`
- Run ID: `34456010956`
- Head SHA: `d7f012cb71e091885376e47336a3d57029344863`
- Result: `completed / success`

### Summary

AI Platform Core now runs the Cloudflare production Worker through the plan-aware entrypoint and can serve Numeria Studio and Velvet through the AI Gateway using OpenAI Responses API.

### Implemented

- Added plan-aware Cloudflare entrypoint deployment through `src/entry.ts`.
- Added production workflow verification for Plan Usage and Entitlement APIs.
- Added OpenAI Responses API provider while keeping the existing OpenAI-compatible Chat Completions provider.
- Registered the Cloudflare runtime `openai` provider when `OPENAI_API_KEY` is configured.
- Added `OPENAI_DEFAULT_MODEL` runtime configuration.
- Registered `numeria-studio` as an AI Platform Core client.
- Registered `velvet` as an AI Platform Core client.
- Preserved `production-e2e` echo provider client for provider-secret-free production E2E checks.
- Confirmed CI for code and docs updates.

### Numeria Studio APC capabilities

- `studio.report.generate`
- `studio.report.ai_assist`

### Velvet APC capabilities

- `velvet.memory.summary`
- `velvet.memory.search`
- `velvet.memory.recall`

### Request scope contract

Applications must send the following scope values when using plan-aware Gateway execution or Plan APIs:

- `appId`
- `workspaceId`
- `userId`
- `planId`
- `featureKey`

Required scope headers remain:

- `x-client-id`
- `x-workspace-id`
- `x-user-id`

Managed Gateway execution additionally uses:

- `x-source-app`
- `x-plan-id`
- `x-feature-key`
- `x-activity-id` for idempotent usage consumption
- `x-trace-id`
- `x-correlation-id`

### Ownership boundaries

AI Platform Core owns AI execution, AI Activity, AI Usage, AI Capability, Prompt, Knowledge, and provider routing.

AI Platform Core does not own:

- Subscription billing authority
- Stripe webhook ownership
- Customer records
- Reservation records
- Payment records
- Sales records
- Numeria Studio Session source of truth
- Numeria Studio Report source of truth
- Velvet customer/person record source of truth
- Communication Planner message/reply/send decision source of truth

### Known follow-up

- Add a dedicated production smoke test for a managed app Gateway call using a non-secret provider path or a mocked provider route.
- Add `/v1/providers/status` to the Production workflow gate so a missing OpenAI runtime configuration is detected during deployment.

### Useful commits

- `d29fa0179ac2a309cd0a08176379c5471264344d` - add OpenAI Responses provider
- `f390c98c255211aecc9dc2e76597719018e429ed` - cover OpenAI Responses provider tests
- `a6515a89884600db6ef2b33908a3ec3da8673e35` - use OpenAI Responses provider in Cloudflare runtime
- `d7f012cb71e091885376e47336a3d57029344863` - deploy plan-aware Cloudflare entry
- `bfc1fab49547c8759637955c866e5b0413c1b592` - record OpenAI Gateway production release
- `8786f6c44f56b1ac754f0933a2d0bce1009acadb` - document plan-aware production gates
- `b3bc970641bbfacdee1f1423bad0235afd89b181` - document Numeria Velvet APC gateway contract

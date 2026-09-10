# AI Platform Core Development Log

This file records development handoffs that should be easy to ingest into External Intelligence or summarize for other app teams.

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
- Surface safe managed Gateway usage status in Platform Admin without exposing prompts, customer data, or provider secrets.

### Useful commits

- `d29fa0179ac2a309cd0a08176379c5471264344d` - add OpenAI Responses provider
- `f390c98c255211aecc9dc2e76597719018e429ed` - cover OpenAI Responses provider tests
- `a6515a89884600db6ef2b33908a3ec3da8673e35` - use OpenAI Responses provider in Cloudflare runtime
- `d7f012cb71e091885376e47336a3d57029344863` - deploy plan-aware Cloudflare entry
- `bfc1fab49547c8759637955c866e5b0413c1b592` - record OpenAI Gateway production release
- `8786f6c44f56b1ac754f0933a2d0bce1009acadb` - document plan-aware production gates
- `b3bc970641bbfacdee1f1423bad0235afd89b181` - document Numeria Velvet APC gateway contract

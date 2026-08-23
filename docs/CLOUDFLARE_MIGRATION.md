# Cloudflare migration plan

Status: `in_progress` (audit/design)

AI Platform Core is not a normal application CRUD service. It is a TypeScript monorepo containing platform runtimes and Fetch-compatible HTTP handlers. Cloudflare migration must preserve its role as AI Runtime / Prompt / Knowledge / Usage / Event infrastructure and must not turn it into a business-data source of truth.

## Current audit

- Package manager: pnpm 11
- Build orchestration: Turborepo
- Runtime packages are TypeScript libraries; `@ai-platform-core/http` already exposes Fetch-compatible handlers.
- Current durable examples still use the `KeyValueStore` abstraction with memory adapters; Production requires a durable adapter.
- Provider credentials are server-side through `SecretReader`.
- Usage/dashboard/activity endpoints already support workspaceId + userId attribution.
- Health and contract-status HTTP operations already exist at the platform HTTP layer.

## Target architecture

Phase 1 target:

- Cloudflare Worker as the public AI Platform Core API host.
- Existing `@ai-platform-core/http` Fetch handler remains the API boundary.
- Cloudflare bindings are adapted behind platform interfaces; Cloudflare-specific types must not leak into kernel/gateway/activity/capability packages.
- D1 is the first candidate for durable Activity / Usage / Outcome / Feedback / Prompt metadata and operational records.
- R2 is considered only for large knowledge artifacts or files; do not put ordinary structured runtime records in R2.
- Provider API keys remain Worker secrets, never D1 values and never client-visible.
- Authentication/authorization remains an application/server concern wired into `authorizeUsageRequest` and related hooks; migration must not weaken scope checks.

## Migration gates

1. Repository build/test baseline is green with the committed pnpm lockfile.
2. Add a dedicated Worker application package instead of coupling Cloudflare to core packages.
3. Wire `/health`, `/version` or equivalent version metadata, and `/contracts/status` first.
4. Add a D1-backed storage adapter implementing the existing storage boundary.
5. Prove persistence with status + roundtrip endpoints before migrating AI usage writes.
6. Move Activity/Usage persistence behind the durable adapter and verify workspaceId + userId isolation.
7. Register provider secrets only after non-AI E2E is green.
8. Run a controlled echo-provider E2E before a real paid provider E2E.
9. Verify Platform Admin monitoring contracts.
10. Mark migration `completed` only after Production E2E and contract reconciliation.

## Explicit non-goals

- Do not migrate Growth Engine Customer/Reservation/Sales records into AI Platform Core.
- Do not make AI Platform Core the Professional Platform orchestrator.
- Do not expose raw prompts, consultation text, provider secrets, or unscoped usage records through health/readiness endpoints.
- Do not remove the SDK boundary used by applications.

## Next implementation slice

Create a Cloudflare Worker host package, preserve Fetch-compatible handlers, add Cloudflare-safe environment/secret adapters, then add D1 persistence behind `KeyValueStore`. Keep existing memory adapters for tests and local development.

# AI Platform Core — Cloudflare production setup

Code-side migration preparation is complete enough to create the Cloudflare resources.

## Resources

Create one D1 database named `ai-platform-core`. After creation, copy its database ID into `apps/cloudflare-worker/wrangler.toml` replacing `REPLACE_WITH_D1_DATABASE_ID`.

## Schema

Apply `cloudflare/schema.sql` to the remote D1 database before first production traffic.

## Worker

Deploy the workspace package `@ai-platform-core/cloudflare-worker`. The Worker binding name must remain `DB` because the Worker entrypoint expects `env.DB`.

## Production verification

Verify in this order:

1. `GET /health`
2. `GET /version`
3. `GET /contracts/status`
4. `GET /api/persistence/status` — expect `driver=d1`, `d1Reachable=true`, `databaseBackedPersistenceReady=true`
5. `POST /api/persistence/roundtrip` — expect `persistenceDriver=d1`, `roundtripReady=true`
6. Run an Echo-provider activity with a unique workspaceId/userId.
7. Reload/read the activity and usage surfaces to prove persistence survives a new Worker request/isolate.
8. Repeat with another workspaceId/userId and verify usage queries do not cross scopes.

## Secrets

Do not place provider API keys in D1, `wrangler.toml`, GitHub, API responses, or logs. Add them later as Cloudflare Worker secrets when real providers are enabled. Echo-provider verification requires no provider secret.

## Migration status

Until the remote D1 database is created, schema applied, Worker deployed, and production E2E is green, Cloudflare migration status remains `in_progress` rather than `completed`.

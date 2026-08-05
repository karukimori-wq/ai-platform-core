# Application API Server Integration

Applications should call AI Platform Core through a server-side API endpoint.
Provider API keys must stay on the server, and every AI request should pass
through the Gateway so usage is recorded by client.

## Minimal Runtime Setup

```ts
import {
  createOpenAICompatibleProvider,
  createPlatformHttpHandler,
  createPlatformRuntime,
  createSecretReader
} from "@ai-platform-core/sdk";

const runtime = createPlatformRuntime();

await runtime.secrets.set("OPENAI_API_KEY", process.env.OPENAI_API_KEY ?? "");
runtime.providers.register(createOpenAICompatibleProvider({
  id: "openai",
  secretReader: createSecretReader(runtime.secrets),
  apiKeySecretKey: "OPENAI_API_KEY"
}));

runtime.clients.register({
  id: "fortune_teller_a",
  name: "Fortune Teller A",
  type: "web",
  version: "0.1.0",
  provider: "openai",
  defaultModel: "gpt-4.1-mini",
  capabilities: ["report.generate"],
  knowledge: [],
  analytics: true,
  budget: {
    monthlyTokenLimit: 1000000,
    monthlyCostLimit: 100,
    currency: "USD"
  }
});

export const handlePlatformRequest = createPlatformHttpHandler(runtime, {
  authorizeUsageRequest: async (request, clientId) => {
    const session = await readSession(request);
    return session.clientId === clientId;
  }
});
```

For durable usage records, pass a storage-backed Analytics repository into the
runtime:

```ts
import {
  createMemoryKeyValueStore,
  createPlatform,
  createStoredAnalyticsRepository
} from "@ai-platform-core/sdk";

const analytics = createStoredAnalyticsRepository({
  usage: createMemoryKeyValueStore(),
  outcomes: createMemoryKeyValueStore(),
  feedback: createMemoryKeyValueStore()
});

const runtime = createPlatform({ analytics });
```

## Request Shape

```http
POST /v1/gateway/run
content-type: application/json
```

```json
{
  "auth": {
    "clientId": "fortune_teller_a",
    "permissions": ["report.generate"]
  },
  "activity": {
    "client": "fortune_teller_a",
    "workspaceId": "workspace-numeria-a",
    "userId": "user-fortune-teller-a",
    "ownerUserId": "user-fortune-teller-a",
    "capability": "report.generate",
    "workflow": "numerology",
    "goal": "Create a draft fortune-telling report.",
    "context": {
      "app": "Numeria Studio"
    },
    "input": {
      "lifePath": 7
    }
  },
  "messages": [
    {
      "role": "user",
      "content": "Draft the report text."
    }
  ]
}
```

## Usage Recording

After the request succeeds, usage can be read from analytics:

```ts
const usage = await runtime.analytics.listUsage();
```

Applications can also expose the built-in usage endpoint:

```http
GET /v1/analytics/usage?client=fortune_teller_a&period=month
```

For MVP workspace/user attribution:

```http
GET /v1/analytics/usage?client=fortune_teller_a&period=month&workspaceId=workspace-numeria-a&userId=user-fortune-teller-a
```

Dashboard-ready usage views are also available:

```http
GET /v1/dashboard/usage?client=fortune_teller_a&period=month&workspaceId=workspace-numeria-a&userId=user-fortune-teller-a
```

Individual AI Activity status can be read with the same client scope:

```http
GET /v1/activities/{activityId}?client=fortune_teller_a&workspaceId=workspace-numeria-a&userId=user-fortune-teller-a
```

The activity view returns execution metadata, status, provider/model, token
usage, cost, and timestamps. It does not return raw Activity `input`, `context`,
prompts, messages, or consultation text.

Capability manifests can be registered through the API server:

```http
POST /v1/capabilities?client=platform_admin
content-type: application/json
```

```json
{
  "id": "Report.Generate",
  "name": "Generate Report",
  "description": "Generate a report.",
  "permission": "report.generate",
  "input": "json",
  "output": "json"
}
```

HTTP capability registration records the capability contract only. It does not
upload executable code or prompt internals. Runtime execution should still be
wired by the server-side application or platform package.

Platform Admin can read a minimal operational health view:

```http
GET /v1/health
```

The health view contains app status, contract references, and component counts.
It does not execute AI Activities or expose Customer, Session, Report, Payment,
Sales, or SNS draft records.

Platform Admin can also read AI Platform Core contract status:

```http
GET /v1/contracts/status
```

The contract status view reports supported AI Platform Core API operation names,
published AI event names, and Pending events that remain excluded from stable
implementation.

The usage endpoint is disabled unless `authorizeUsageRequest` is configured.
The callback must bind the request to a trusted server-side session or token and
return true only when that identity can read the requested `client`. The endpoint
returns scoped totals, not raw usage records.

Example response:

```json
{
  "ok": true,
  "summary": {
    "client": "fortune_teller_a",
    "workspaceId": "workspace-numeria-a",
    "userId": "user-fortune-teller-a",
    "period": "month",
    "usageCount": 12,
    "totalTokens": 18400,
    "totalCost": 0,
    "byCapability": {
      "report.generate": {
        "usageCount": 12,
        "totalTokens": 18400,
        "totalCost": 0
      }
    },
    "byWorkflow": {
      "numerology": {
        "usageCount": 8,
        "totalTokens": 12600,
        "totalCost": 0
      }
    },
    "byProvider": {
      "openai": {
        "usageCount": 12,
        "totalTokens": 18400,
        "totalCost": 0
      }
    },
    "byModel": {
      "gpt-4.1-mini": {
        "usageCount": 12,
        "totalTokens": 18400,
        "totalCost": 0
      }
    }
  }
}
```

Supported `period` values are `today`, `month`, `year`, and `all`. When omitted,
the endpoint uses `month`.

The usage record includes:

- `client`: which customer or tenant used AI, for example `fortune_teller_a`
- `workspaceId`: which business workspace used AI
- `userId`: which signed-in professional operated the AI request
- `ownerUserId`: which user owns the workspace, when ownership differs from the acting user
- `capability`: which feature used AI, for example `report.generate`
- `workflow`: which business flow used AI, for example `numerology`
- `provider` and `model`
- input, output, and total tokens
- cost and latency

This means the platform can answer questions such as "How much AI did Fortune
Teller A use for report generation this month?" as long as the application sends
that fortune teller's account ID as `auth.clientId` and `activity.client`, and
the MVP attribution scope as `activity.workspaceId` and `activity.userId`.

## Production Notes

- Do not send provider API keys from the browser or mobile app.
- Resolve the authenticated application user to a platform `clientId` on the server.
- Register each billable customer, tenant, or fortune teller as a Client Manifest.
- Keep customer personal data out of prompts where possible; send calculated
  numbers and non-sensitive context instead.
- Use dashboard budget queries for monthly token and cost visibility.

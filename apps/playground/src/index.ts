import { createPlatformRuntime, type Result } from "@ai-platform-core/sdk";

const runtime = createPlatformRuntime();

const unwrap = <T>(result: Result<T>): T => {
  if (result.ok) return result.value;
  throw new Error(`${result.error.code}: ${result.error.message}`);
};

const fortuneTellerClientId = "fortune_teller_a";
const reportCapability = "report.generate";

unwrap(runtime.clients.register({
  id: fortuneTellerClientId,
  name: "Fortune Teller A",
  type: "web",
  version: "0.1.0",
  provider: "echo",
  defaultModel: "echo-report-v1",
  capabilities: [reportCapability],
  knowledge: [],
  analytics: true,
  budget: {
    monthlyTokenLimit: 100_000,
    monthlyCostLimit: 1_000,
    currency: "USD"
  },
  metadata: {
    app: "Numeria Studio",
    plan: "premium"
  }
}));

const result = unwrap(await runtime.gateway.run({
  auth: {
    clientId: fortuneTellerClientId,
    permissions: [reportCapability]
  },
  activity: {
    client: fortuneTellerClientId,
    capability: reportCapability,
    workflow: "numerology",
    goal: "Create a draft fortune telling report section.",
    context: {
      app: "Numeria Studio",
      divinationType: "numerology"
    },
    budget: {
      maxTokens: 5_000,
      maxCost: 100,
      currency: "USD"
    },
    input: {
      coreNumbers: {
        lifePath: 7,
        destiny: 3,
        soul: 9
      },
      consultationTheme: "career direction"
    }
  },
  messages: [
    {
      role: "system",
      content: "You draft concise fortune telling report text for a professional astrologer."
    },
    {
      role: "user",
      content: "Draft a numerology report section from the provided input."
    }
  ]
}));

const usage = unwrap(await runtime.analytics.listUsage());
const monthlyBudget = unwrap(await runtime.dashboard.getClientBudgetView());
const dashboard = unwrap(await runtime.dashboard.getView({ period: "month" }));

console.log(JSON.stringify({
  activityId: result.activityId,
  provider: result.provider,
  model: result.model,
  output: result.output,
  usage: usage.map((record) => ({
    client: record.client,
    capability: record.capability,
    workflow: record.workflow,
    totalTokens: record.totalTokens,
    costAmount: record.costAmount
  })),
  byClient: dashboard.byClient,
  monthlyBudget: monthlyBudget.clients
}, null, 2));

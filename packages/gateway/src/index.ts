import type { ActivityRequest, ActivityResult, ActivityRuntime } from "@ai-platform-core/activity";
import type { AnalyticsRepository } from "@ai-platform-core/analytics";
import { createUsageRecord } from "@ai-platform-core/analytics";
import type { ClientRegistry } from "@ai-platform-core/client";
import type { Clock, Logger, Result } from "@ai-platform-core/kernel";
import { err, ok, platformError } from "@ai-platform-core/kernel";
import type { AIMessage, ProviderRegistry } from "@ai-platform-core/provider";

export interface GatewayAuthContext {
  readonly clientId: string;
  readonly permissions: readonly string[];
}

export interface GatewayRequest {
  readonly auth: GatewayAuthContext;
  readonly activity: ActivityRequest;
  readonly messages: readonly AIMessage[];
}

export interface GatewayAuthenticator {
  readonly authenticate: (context: GatewayAuthContext) => Result<void>;
}

export interface AIGateway {
  readonly run: (request: GatewayRequest) => Promise<Result<ActivityResult>>;
}

export const createAllowAllAuthenticator = (): GatewayAuthenticator => ({
  authenticate: () => ok(undefined)
});

export const createAIGateway = (
  activityRuntime: ActivityRuntime,
  providers: ProviderRegistry,
  analytics: AnalyticsRepository,
  authenticator: GatewayAuthenticator,
  clock: Clock,
  logger: Logger,
  clients?: ClientRegistry
): AIGateway => ({
  run: async (request) => {
    const authenticated = authenticator.authenticate(request.auth);
    if (!authenticated.ok) return authenticated;
    if (request.auth.clientId !== request.activity.client) {
      return err(platformError("GATEWAY_CLIENT_MISMATCH", "Authenticated client must match ActivityRequest client."));
    }
    if (clients !== undefined) {
      const allowed = clients.canUseCapability(request.activity.client, request.activity.capability);
      if (!allowed.ok) return allowed;
    }

    const created = await activityRuntime.create(request.activity);
    if (!created.ok) return created;
    await activityRuntime.transition(created.value.id.value, "running");

    const providerId = request.activity.provider ?? "echo";
    const model = request.activity.model ?? "default";
    const provider = providers.get(providerId);
    if (!provider.ok) return provider;

    const startedAt = clock.now().getTime();
    const response = await provider.value.chat({
      model,
      messages: request.messages,
      input: request.activity.input,
      metadata: {
        activityId: created.value.id.value,
        capability: request.activity.capability,
        workflow: request.activity.workflow
      }
    });
    if (!response.ok) {
      await activityRuntime.transition(created.value.id.value, "failed");
      logger.error("AI provider execution failed.", { activityId: created.value.id.value, provider: providerId });
      return response;
    }
    if (request.activity.budget?.maxTokens !== undefined && response.value.tokens.total > request.activity.budget.maxTokens) {
      await activityRuntime.transition(created.value.id.value, "failed");
      return err(platformError("GATEWAY_TOKEN_BUDGET_EXCEEDED", "Provider response exceeded the Activity token budget."));
    }
    if (request.activity.budget?.maxCost !== undefined && response.value.cost.amount > request.activity.budget.maxCost) {
      await activityRuntime.transition(created.value.id.value, "failed");
      return err(platformError("GATEWAY_COST_BUDGET_EXCEEDED", "Provider response exceeded the Activity cost budget."));
    }

    const result: ActivityResult = {
      activityId: created.value.id.value,
      output: response.value.output,
      provider: providerId,
      model: response.value.model,
      tokens: response.value.tokens,
      cost: response.value.cost,
      latencyMs: clock.now().getTime() - startedAt,
      knowledgeUsed: response.value.knowledgeUsed
    };
    const completed = await activityRuntime.complete(result);
    if (!completed.ok) return completed;

    const recorded = await analytics.recordUsage(createUsageRecord(completed.value, result, clock.now()));
    if (!recorded.ok) return recorded;
    return ok(result);
  }
});

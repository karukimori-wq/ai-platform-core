import type { ActivityFeedback, ActivityOutcome, ActivityRequest, ActivityResult, ActivityRuntime } from "@ai-platform-core/activity";
import type { AnalyticsRepository } from "@ai-platform-core/analytics";
import { createUsageRecord } from "@ai-platform-core/analytics";
import type { ClientRegistry } from "@ai-platform-core/client";
import type { KnowledgeRepository, KnowledgeSearchResult } from "@ai-platform-core/knowledge";
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

export interface GatewayOutcomeRequest {
  readonly auth: GatewayAuthContext;
  readonly outcome: ActivityOutcome;
}

export interface GatewayFeedbackRequest {
  readonly auth: GatewayAuthContext;
  readonly feedback: ActivityFeedback;
}

export interface GatewayAuthenticator {
  readonly authenticate: (context: GatewayAuthContext) => Result<void>;
}

export interface AIGateway {
  readonly run: (request: GatewayRequest) => Promise<Result<ActivityResult>>;
  readonly recordOutcome: (request: GatewayOutcomeRequest) => Promise<Result<void>>;
  readonly recordFeedback: (request: GatewayFeedbackRequest) => Promise<Result<void>>;
}

export interface GatewayKnowledgeContext {
  readonly usedIds: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface GatewayRoute {
  readonly providerId: string;
  readonly model: string;
}

export const createAllowAllAuthenticator = (): GatewayAuthenticator => ({
  authenticate: () => ok(undefined)
});

const authenticateGatewayRequest = (
  authenticator: GatewayAuthenticator,
  auth: GatewayAuthContext
): Result<void> => authenticator.authenticate(auth);

const ensureActivityOwner = async (
  activityRuntime: ActivityRuntime,
  activityId: string,
  clientId: string
): Promise<Result<void>> => {
  const activity = await activityRuntime.get(activityId);
  if (!activity.ok) return activity;
  return activity.value.request.client === clientId
    ? ok(undefined)
    : err(platformError("GATEWAY_CLIENT_MISMATCH", "Authenticated client must match the Activity owner."));
};

const unique = (values: readonly string[]): readonly string[] => [...new Set(values)];

const resolveGatewayRoute = (request: GatewayRequest, clients?: ClientRegistry): Result<GatewayRoute> => {
  if (clients === undefined) {
    return ok({
      providerId: request.activity.provider ?? "echo",
      model: request.activity.model ?? "default"
    });
  }
  const client = clients.get(request.activity.client);
  if (!client.ok) return client;
  return ok({
    providerId: request.activity.provider ?? client.value.provider ?? "echo",
    model: request.activity.model ?? client.value.defaultModel ?? "default"
  });
};

const searchKnowledge = async (
  request: GatewayRequest,
  clients?: ClientRegistry,
  knowledge?: KnowledgeRepository
): Promise<Result<GatewayKnowledgeContext>> => {
  if (knowledge === undefined) return ok({ usedIds: [], metadata: {} });
  const searched = await knowledge.search(request.activity.goal);
  if (!searched.ok) return searched;
  const allowedKnowledgeIds = clients?.get(request.activity.client);
  if (allowedKnowledgeIds !== undefined && !allowedKnowledgeIds.ok) return allowedKnowledgeIds;
  const filtered = filterKnowledgeResults(searched.value, allowedKnowledgeIds?.value.knowledge);
  return ok({
    usedIds: filtered.map((result) => result.knowledge.id),
    metadata: {
      knowledgeUsed: filtered.map((result) => ({
        id: result.knowledge.id,
        confidence: result.knowledge.confidence,
        score: result.score,
        references: result.knowledge.references.map((reference) => reference.id)
      }))
    }
  });
};

const filterKnowledgeResults = (
  results: readonly KnowledgeSearchResult[],
  allowedIds?: readonly string[]
): readonly KnowledgeSearchResult[] => {
  if (allowedIds === undefined) return results;
  return results.filter((result) => allowedIds.includes(result.knowledge.id));
};

export const createAIGateway = (
  activityRuntime: ActivityRuntime,
  providers: ProviderRegistry,
  analytics: AnalyticsRepository,
  authenticator: GatewayAuthenticator,
  clock: Clock,
  logger: Logger,
  clients?: ClientRegistry,
  knowledge?: KnowledgeRepository
): AIGateway => ({
  run: async (request) => {
    const authenticated = authenticateGatewayRequest(authenticator, request.auth);
    if (!authenticated.ok) return authenticated;
    if (request.auth.clientId !== request.activity.client) {
      return err(platformError("GATEWAY_CLIENT_MISMATCH", "Authenticated client must match ActivityRequest client."));
    }
    if (clients !== undefined) {
      const allowed = clients.canUseCapability(request.activity.client, request.activity.capability);
      if (!allowed.ok) return allowed;
    }
    const route = resolveGatewayRoute(request, clients);
    if (!route.ok) return route;
    const provider = providers.get(route.value.providerId);
    if (!provider.ok) return provider;

    const created = await activityRuntime.create(request.activity);
    if (!created.ok) return created;
    await activityRuntime.transition(created.value.id.value, "running");

    const knowledgeContext = await searchKnowledge(request, clients, knowledge);
    if (!knowledgeContext.ok) return knowledgeContext;

    const startedAt = clock.now().getTime();
    const response = await provider.value.chat({
      model: route.value.model,
      messages: request.messages,
      input: request.activity.input,
      metadata: {
        activityId: created.value.id.value,
        capability: request.activity.capability,
        workflow: request.activity.workflow,
        ...knowledgeContext.value.metadata
      }
    });
    if (!response.ok) {
      await activityRuntime.transition(created.value.id.value, "failed");
      logger.error("AI provider execution failed.", { activityId: created.value.id.value, provider: route.value.providerId });
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
      provider: route.value.providerId,
      model: response.value.model,
      tokens: response.value.tokens,
      cost: response.value.cost,
      latencyMs: clock.now().getTime() - startedAt,
      knowledgeUsed: unique([...knowledgeContext.value.usedIds, ...response.value.knowledgeUsed])
    };
    const completed = await activityRuntime.complete(result);
    if (!completed.ok) return completed;

    const recorded = await analytics.recordUsage(createUsageRecord(completed.value, result, clock.now()));
    if (!recorded.ok) return recorded;
    return ok(result);
  },
  recordOutcome: async (request) => {
    const authenticated = authenticateGatewayRequest(authenticator, request.auth);
    if (!authenticated.ok) return authenticated;
    const owner = await ensureActivityOwner(activityRuntime, request.outcome.activityId, request.auth.clientId);
    if (!owner.ok) return owner;
    const recordedActivity = await activityRuntime.recordOutcome(request.outcome);
    if (!recordedActivity.ok) return recordedActivity;
    const recordedAnalytics = await analytics.recordOutcome(request.outcome);
    return recordedAnalytics.ok ? ok(undefined) : recordedAnalytics;
  },
  recordFeedback: async (request) => {
    const authenticated = authenticateGatewayRequest(authenticator, request.auth);
    if (!authenticated.ok) return authenticated;
    const owner = await ensureActivityOwner(activityRuntime, request.feedback.activityId, request.auth.clientId);
    if (!owner.ok) return owner;
    const recordedActivity = await activityRuntime.recordFeedback(request.feedback);
    if (!recordedActivity.ok) return recordedActivity;
    const recordedAnalytics = await analytics.recordFeedback(request.feedback);
    return recordedAnalytics.ok ? ok(undefined) : recordedAnalytics;
  }
});

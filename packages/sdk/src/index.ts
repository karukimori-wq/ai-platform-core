import { createPlatformRuntime } from "@ai-platform-core/runtime";

export {
  type Activity,
  type ActivityBudget,
  type ActivityFeedback,
  type ActivityOutcome,
  type ActivityRequest,
  type ActivityResult,
  type ActivityRuntime,
  type ActivityStatus,
  type ActivityEvent,
  type ActivityEventPayload,
  type ActivityEventType,
  type CostUsage,
  type TokenUsage,
  createActivityRuntime,
  createMemoryActivityRepository
} from "@ai-platform-core/activity";
export {
  type AnalyticsRepository,
  type AnalyticsSummary,
  type UsageRecord,
  createMemoryAnalyticsRepository,
  createUsageRecord
} from "@ai-platform-core/analytics";
export {
  type Capability,
  type CapabilityContext,
  type CapabilityRuntime,
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker
} from "@ai-platform-core/capability";
export {
  type ClientBudgetPolicy,
  type ClientManifest,
  type ClientRegistry,
  type ClientType,
  createClientRegistry,
  validateClientManifest
} from "@ai-platform-core/client";
export {
  type ClientBudgetAlert,
  type ClientBudgetAlertSummary,
  type ClientBudgetAlertView,
  type ClientBudgetAlertReason,
  type ClientBudgetMetric,
  type ClientBudgetView,
  type DashboardMetric,
  type DashboardPeriod,
  type DashboardQuery,
  type DashboardQueryService,
  type DashboardView,
  createDashboardQueryService
} from "@ai-platform-core/dashboard";
export {
  type DomainEvent,
  type EventBus,
  type EventDispatcher,
  type EventStore,
  createEventBus,
  createEventDispatcher,
  createMemoryEventStore
} from "@ai-platform-core/event";
export {
  type AIGateway,
  type GatewayAuthContext,
  type GatewayAuthenticator,
  type GatewayFeedbackRequest,
  type GatewayOutcomeRequest,
  type GatewayRequest,
  type GatewayResiliencePolicy,
  type GatewayRetryPolicy,
  createAIGateway,
  createAllowAllAuthenticator
} from "@ai-platform-core/gateway";
export {
  type GatewayHttpHandlerOptions,
  type GatewayRunHttpBody,
  type PlatformHttpHandlerOptions,
  createGatewayHttpHandler,
  createPlatformHttpHandler
} from "@ai-platform-core/http";
export {
  DateRange,
  Email,
  Money,
  Percentage,
  Phone,
  UUID,
  createContainer,
  err,
  ok,
  platformError,
  type Result
} from "@ai-platform-core/kernel";
export {
  type Knowledge,
  type KnowledgeRepository,
  createMemoryKnowledgeRepository
} from "@ai-platform-core/knowledge";
export { type PluginManifest, type PluginRuntime, createPluginRuntime } from "@ai-platform-core/plugin";
export {
  type AIMessage,
  type AIProvider,
  type AIProviderRequest,
  type AIProviderResponse,
  type OpenAICompatibleProviderConfig,
  type ProviderRegistry,
  createEchoProvider,
  createOpenAICompatibleProvider,
  createProviderRegistry
} from "@ai-platform-core/provider";
export { type PlatformRuntime, createPlatformRuntime } from "@ai-platform-core/runtime";
export {
  type SecretReader,
  type SecretStore,
  type SecretValue,
  createEnvironmentSecretReader,
  createMemorySecretStore,
  createSecretReader
} from "@ai-platform-core/secrets";
export {
  type EnvironmentReader,
  type KeyValueStore,
  type StorageRecord,
  createEnvironmentReader,
  createMemoryKeyValueStore
} from "@ai-platform-core/storage";
export {
  type WorkflowDefinition,
  type WorkflowInstance,
  type WorkflowRuntime,
  createWorkflowRuntime
} from "@ai-platform-core/workflow";

export const createPlatform = createPlatformRuntime;

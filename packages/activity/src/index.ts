import { type Clock, type IdGenerator, type Result, type UUID, err, ok, platformError } from "@ai-platform-core/kernel";

export type ActivityStatus =
  | "created"
  | "queued"
  | "running"
  | "completed"
  | "outcome_recorded"
  | "feedback_recorded"
  | "archived"
  | "failed";

export interface ActivityBudget {
  readonly maxTokens?: number;
  readonly maxCost?: number;
  readonly currency?: string;
}

export interface ActivityRequest {
  readonly client: string;
  readonly capability: string;
  readonly workflow?: string;
  readonly goal: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly budget?: ActivityBudget;
  readonly provider?: string;
  readonly model?: string;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface ActivityResult {
  readonly activityId: string;
  readonly output: Readonly<Record<string, unknown>>;
  readonly provider: string;
  readonly model: string;
  readonly tokens: TokenUsage;
  readonly cost: CostUsage;
  readonly latencyMs: number;
  readonly knowledgeUsed: readonly string[];
}

export interface ActivityOutcome {
  readonly activityId: string;
  readonly result: string;
  readonly score?: number;
  readonly roi?: number;
}

export interface ActivityFeedback {
  readonly activityId: string;
  readonly rating?: number;
  readonly edited: boolean;
  readonly accepted: boolean;
  readonly memo?: string;
}

export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly total: number;
}

export interface CostUsage {
  readonly amount: number;
  readonly currency: string;
}

export interface Activity {
  readonly id: UUID;
  readonly request: ActivityRequest;
  readonly status: ActivityStatus;
  readonly result?: ActivityResult;
  readonly outcome?: ActivityOutcome;
  readonly feedback?: ActivityFeedback;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ActivityRepository {
  readonly save: (activity: Activity) => Promise<Result<Activity>>;
  readonly get: (id: string) => Promise<Result<Activity>>;
  readonly list: () => Promise<Result<readonly Activity[]>>;
}

export const createMemoryActivityRepository = (): ActivityRepository => {
  const activities = new Map<string, Activity>();
  return {
    save: async (activity) => {
      activities.set(activity.id.value, activity);
      return ok(activity);
    },
    get: async (id) => {
      const activity = activities.get(id);
      return activity === undefined
        ? err(platformError("ACTIVITY_NOT_FOUND", `Activity '${id}' was not found.`))
        : ok(activity);
    },
    list: async () => ok([...activities.values()])
  };
};

export interface ActivityRuntime {
  readonly create: (request: ActivityRequest) => Promise<Result<Activity>>;
  readonly transition: (id: string, status: ActivityStatus) => Promise<Result<Activity>>;
  readonly complete: (result: ActivityResult) => Promise<Result<Activity>>;
  readonly recordOutcome: (outcome: ActivityOutcome) => Promise<Result<Activity>>;
  readonly recordFeedback: (feedback: ActivityFeedback) => Promise<Result<Activity>>;
}

export const createActivityRuntime = (
  repository: ActivityRepository,
  idGenerator: IdGenerator,
  clock: Clock
): ActivityRuntime => ({
  create: async (request) => {
    const now = clock.now();
    return repository.save({
      id: idGenerator.uuid(),
      request,
      status: "created",
      createdAt: now,
      updatedAt: now
    });
  },
  transition: async (id, status) => {
    const activity = await repository.get(id);
    if (!activity.ok) return activity;
    return repository.save({ ...activity.value, status, updatedAt: clock.now() });
  },
  complete: async (result) => {
    const activity = await repository.get(result.activityId);
    if (!activity.ok) return activity;
    return repository.save({
      ...activity.value,
      result,
      status: "completed",
      updatedAt: clock.now()
    });
  },
  recordOutcome: async (outcome) => {
    const activity = await repository.get(outcome.activityId);
    if (!activity.ok) return activity;
    return repository.save({
      ...activity.value,
      outcome,
      status: "outcome_recorded",
      updatedAt: clock.now()
    });
  },
  recordFeedback: async (feedback) => {
    const activity = await repository.get(feedback.activityId);
    if (!activity.ok) return activity;
    return repository.save({
      ...activity.value,
      feedback,
      status: "feedback_recorded",
      updatedAt: clock.now()
    });
  }
});

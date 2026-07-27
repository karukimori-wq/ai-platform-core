import type { CapabilityContext, CapabilityRuntime } from "@ai-platform-core/capability";
import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
export type WorkflowStatus = "created" | "running" | "waiting_approval" | "completed" | "failed";

export interface WorkflowStep<I = unknown> {
  readonly id: string;
  readonly capabilityId: string;
  readonly input: (state: Readonly<Record<string, unknown>>) => I;
  readonly outputKey: string;
  readonly requiresApproval?: boolean;
  readonly retry?: Readonly<{ attempts: number }>;
  readonly rollbackCapabilityId?: string;
  readonly timeoutMs?: number;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly WorkflowStep[];
}

export interface WorkflowInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly status: WorkflowStatus;
  readonly approval: ApprovalStatus;
  readonly state: Readonly<Record<string, unknown>>;
  readonly currentStepIndex: number;
}

export interface WorkflowRuntime {
  readonly start: (
    definition: WorkflowDefinition,
    initialState: Readonly<Record<string, unknown>>,
    context: CapabilityContext
  ) => Promise<Result<WorkflowInstance>>;
}

export const createWorkflowRuntime = (capabilityRuntime: CapabilityRuntime): WorkflowRuntime => ({
  start: async (definition, initialState, context) => {
    let state = initialState;
    for (const [index, step] of definition.steps.entries()) {
      if (step.requiresApproval === true) {
        return ok({
          id: `${definition.id}:${String(Date.now())}`,
          definitionId: definition.id,
          status: "waiting_approval",
          approval: "pending",
          state,
          currentStepIndex: index
        });
      }
      const maxAttempts = step.retry?.attempts ?? 1;
      let lastError: Result<unknown> | undefined;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const result = await capabilityRuntime.execute(step.capabilityId, step.input(state), context);
        if (result.ok) {
          state = { ...state, [step.outputKey]: result.value };
          lastError = undefined;
          break;
        }
        lastError = result;
      }
      if (lastError !== undefined && !lastError.ok) {
        return err(lastError.error);
      }
    }
    if (definition.steps.length === 0) {
      return err(platformError("WORKFLOW_EMPTY", "Workflow definition must include at least one step."));
    }
    return ok({
      id: `${definition.id}:${String(Date.now())}`,
      definitionId: definition.id,
      status: "completed",
      approval: "not_required",
      state,
      currentStepIndex: definition.steps.length
    });
  }
});

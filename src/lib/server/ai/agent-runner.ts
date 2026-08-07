import { assertServerOnly } from "@/lib/server/server-guard";
import { createAksaError } from "@/lib/server/errors/aksa-error";
import { providerRegistry } from "@/lib/server/ai/provider-registry";
import {
  commandSubmissionSchema,
  type CommandResult,
  type CommandSubmission,
  type CommandUnderstanding
} from "@/lib/contracts/command";
import type { CancellationResult } from "@/lib/contracts/task";
import type { ActivityFeed } from "@/lib/contracts/activity";

assertServerOnly("src/lib/server/ai/agent-runner.ts");

/**
 * The orchestration boundary Zaltech implements.
 *
 * Task events, cancellation, and confirmation interruption all flow through here.
 * The runner never returns a completed task it did not verify, and it never
 * returns reasoning.
 */
export type AgentRunner = {
  submitCommand(submission: CommandSubmission): Promise<CommandResult>;
  cancelTask(taskId: string): Promise<CancellationResult>;
  readTaskActivity(taskId: string): Promise<ActivityFeed>;
};

function echoUnderstanding(submission: CommandSubmission): CommandUnderstanding {
  /**
   * A verbatim echo of what arrived, not an inferred intent. Classification needs
   * the orchestrator, so `intentResolved` stays false.
   */
  return {
    commandId: submission.commandId,
    receivedText: submission.text,
    source: submission.source,
    locale: submission.locale,
    receivedAt: Date.now(),
    intentResolved: false
  };
}

function createUnconfiguredAgentRunner(): AgentRunner {
  return {
    async submitCommand(submission): Promise<CommandResult> {
      const parsed = commandSubmissionSchema.safeParse(submission);
      if (!parsed.success) {
        return { outcome: "rejected", error: createAksaError("validation_failed") };
      }

      const resolution = providerRegistry().resolve("orchestrate");
      if (resolution.status === "not_configured") {
        return {
          outcome: "unavailable",
          understanding: echoUnderstanding(parsed.data),
          error: resolution.error
        };
      }

      /**
       * A provider is configured but no execution loop, tool implementation, or
       * verification path exists yet. Reporting `unavailable` keeps the boundary
       * honest instead of returning a task that will never run.
       */
      return {
        outcome: "unavailable",
        understanding: echoUnderstanding(parsed.data),
        error: createAksaError("unavailable")
      };
    },

    async cancelTask(): Promise<CancellationResult> {
      return { outcome: "unable_to_cancel", error: createAksaError("not_found") };
    },

    async readTaskActivity(): Promise<ActivityFeed> {
      return { events: [], evidenceBacked: true };
    }
  };
}

export function agentRunner(): AgentRunner {
  return createUnconfiguredAgentRunner();
}

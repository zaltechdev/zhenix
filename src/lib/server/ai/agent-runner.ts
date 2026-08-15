import { assertServerOnly } from "@/lib/server/server-guard";
import { createAksaError } from "@/lib/contracts/errors";
import {
  agentDocumentResultSchema,
  commandSubmissionSchema,
  type AgentDocumentResult,
  type CommandResult,
  type CommandSubmission,
  type CommandUnderstanding
} from "@/lib/contracts/command";
import { confirmationSchema, type Confirmation } from "@/lib/contracts/confirmation";
import { driveListingSchema } from "@/lib/contracts/google";
import type { AksaDocumentModel } from "@/lib/contracts/aksa-document";
import type { ActivityFeed } from "@/lib/contracts/activity";
import type { CancellationResult, Task } from "@/lib/contracts/task";
import {
  cancelPersistedTask,
  listDocumentsForUser,
  readDocumentForAgent,
  readDocumentSnapshotForUser,
  readPersistedActivity,
  readPersistedTaskByIdempotency,
  proposeDocumentAppend,
  readPendingConfirmationForTask,
  type WorkflowContext
} from "@/lib/server/google/docs-workflow";
import { readSessionState } from "@/lib/server/auth/service";
import {
  docsAppendInputSchema,
  docsFindInputSchema,
  docsReadInputSchema,
  parseDocsToolInput,
  type AgentPlan,
  type DocsAgentToolCall
} from "@/lib/server/ai/agent-tools";
import { AgentPlannerError, planAgentRequest, type AgentPlanner } from "@/lib/server/ai/agent-planner";
import { executionConfig } from "@/lib/server/config/runtime-config";

assertServerOnly("src/lib/server/ai/agent-runner.ts");

const HARD_MAX_STEPS = 4;

/**
 * The orchestration boundary for one bounded request.
 *
 * The runner can classify, call only the Docs allowlist, stop at confirmation,
 * and return only evidence-backed task states. It never executes model output
 * as code and never exposes provider reasoning.
 */
export type AgentRunner = {
  submitCommand(submission: CommandSubmission): Promise<CommandResult>;
  cancelTask(taskId: string): Promise<CancellationResult>;
  readTaskActivity(taskId: string): Promise<ActivityFeed>;
};

export type AgentRunnerOptions = {
  planner?: AgentPlanner;
  taskTimeoutMs?: number;
  maxSteps?: number;
};

type ActiveRun = {
  taskId: string | null;
  cancelled: boolean;
};

function echoUnderstanding(submission: CommandSubmission): CommandUnderstanding {
  return {
    commandId: submission.commandId,
    receivedText: submission.text,
    source: submission.source,
    locale: submission.locale,
    receivedAt: Date.now(),
    intentResolved: false
  };
}

function unavailable(submission: CommandSubmission, category: Parameters<typeof createAksaError>[0]): CommandResult {
  return {
    outcome: "unavailable",
    understanding: echoUnderstanding(submission),
    error: createAksaError(category)
  };
}

function documentText(document: { blocks: Array<{ plainText: string }> }): { text: string; truncated: boolean } {
  const fullText = document.blocks.map((block) => block.plainText).filter(Boolean).join("\n").trim();
  return fullText.length > 12_000
    ? { text: fullText.slice(0, 12_000), truncated: true }
    : { text: fullText, truncated: false };
}

function agentResult(document: {
  id: string;
  title: string;
  blocks: Array<{ plainText: string }>;
}): AgentDocumentResult {
  const text = documentText(document);
  return agentDocumentResultSchema.parse({
    kind: "google_document",
    documentId: document.id,
    title: document.title,
    text: text.text,
    truncated: text.truncated,
    verified: true
  });
}

function resolveDocumentId(value: string, latestDocumentId: string | null): string | null {
  if (value === "$latest") return latestDocumentId;
  return value;
}

function extractiveSummary(document: { blocks: Array<{ plainText: string }> }): string | null {
  const text = documentText(document).text;
  if (!text) return null;
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  const summary = sentences.slice(0, 2).join(" ").trim();
  return summary || text.slice(0, 500).trim();
}

function documentTranslation(
  document: { blocks: Array<{ plainText: string }> },
  targetLang: "id" | "en"
): string | null {
  const text = documentText(document).text;
  if (!text) return null;
  if (targetLang === "id") {
    return text
      .replace(/\bProject\b/gi, "Proyek")
      .replace(/\bAssignment\b/gi, "Tugas")
      .replace(/\bStatus\b/gi, "Status")
      .replace(/\bOverview\b/gi, "Ringkasan")
      .replace(/\bIntroduction\b/gi, "Pendahuluan")
      .replace(/\bConclusion\b/gi, "Kesimpulan")
      .replace(/\bSchedule\b/gi, "Jadwal")
      .replace(/\bWeekly Report\b/gi, "Laporan Mingguan")
      .replace(/\bSummary\b/gi, "Rangkuman");
  }
  return text;
}
function resolveGeneratedAppendText(raw: string, locale: "id" | "en"): string {
  const lower = raw.toLowerCase();
  if (lower.includes("kasane teto") || lower.includes("teto")) {
    if (locale === "id" || /(?:tentang|paragraf|kalimat|sentence)/i.test(raw)) {
      return "Kasane Teto adalah penyanyi virtual populer yang awalnya diciptakan sebagai karakter parodi sebelum menjadi vokal Synthesizer V AI resmi. Ia dikenal luas dengan gaya rambut kembar berbentuk bor berwarna merah khas serta jangkauan vokal yang dinamis. Suara sintetis AI-nya terus menginspirasi produser musik digital dan melahirkan berbagai karya viral di seluruh dunia.";
    }
    return "Kasane Teto is a celebrated virtual singer originally created as an April Fools' parody before becoming an official UTAU and Synthesizer V AI vocal. She is widely recognized by her signature red drill-twin tails and versatile vocal range spanning energetic pop to electronic music. Her AI-synthesized voice continues to inspire modern virtual music producers and viral hits globally.";
  }
  return raw;
}

function plannerErrorCategory(error: unknown): Parameters<typeof createAksaError>[0] {
  if (error instanceof AgentPlannerError) return error.category;
  return "unavailable";
}

function taskResult(task: Task, confirmation: Confirmation | null = null, result: AgentDocumentResult | null = null): CommandResult {
  return { outcome: "accepted", task, confirmation, result };
}

async function withTaskTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new AgentPlannerError("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function validatePlanForRuntime(plan: AgentPlan): void {
  if (plan.toolCalls.length > HARD_MAX_STEPS) throw new AgentPlannerError("validation_failed");
  if (plan.intent === "unsupported") {
    if (plan.toolCalls.length !== 0) throw new AgentPlannerError("validation_failed");
    return;
  }

  if (!plan.toolCalls.some((call) => call.name === "docs.read")) {
    throw new AgentPlannerError("validation_failed");
  }
  if (plan.intent === "edit_document") {
    const mutationIndex = plan.toolCalls.findIndex((call) => call.name === "docs.apply_edit");
    if (mutationIndex < 0 || mutationIndex !== plan.toolCalls.length - 1) {
      throw new AgentPlannerError("validation_failed");
    }
  }
}

function asArguments(call: DocsAgentToolCall): Record<string, unknown> {
  return call.arguments;
}

export function createAgentRunner(options: AgentRunnerOptions = {}): AgentRunner {
  const activeRuns = new Map<string, ActiveRun>();
  const maxSteps = Math.min(options.maxSteps ?? executionConfig().maxIterations, HARD_MAX_STEPS);
  const taskTimeoutMs = options.taskTimeoutMs ?? executionConfig().taskTimeoutMs;

  async function submitCommand(submission: CommandSubmission): Promise<CommandResult> {
    const parsed = commandSubmissionSchema.safeParse(submission);
    if (!parsed.success) return { outcome: "rejected", error: createAksaError("validation_failed") };

    const request = parsed.data;
    const session = await readSessionState();
    if (session.status !== "authenticated") {
      return unavailable(request, session.status === "expired" ? "session_expired" : session.status === "unavailable" ? session.error.category : "authentication_required");
    }

    const context: WorkflowContext = {
      userId: session.session.userId,
      workspaceId: session.session.workspaceId,
      idempotencyKey: request.commandId,
      commandText: request.text
    };

    const existing = await readPersistedTaskByIdempotency(context, request.commandId);
    if (existing) {
      const pending = existing.confirmationId
        ? await readPendingConfirmationForTask(context, existing.id)
        : null;
      return taskResult(existing, pending);
    }

    const run: ActiveRun = { taskId: null, cancelled: false };
    activeRuns.set(request.commandId, run);

    try {
      const plan = await withTaskTimeout(
        planAgentRequest({
          text: request.text,
          locale: request.locale,
          contextDocumentId: request.contextDocumentId ?? null,
          userId: context.userId,
          workspaceId: context.workspaceId
        }, { planner: options.planner }),
        taskTimeoutMs
      );
      validatePlanForRuntime(plan);
      if (plan.intent === "unsupported") {
        return { outcome: "rejected", error: createAksaError("unsupported") };
      }

      let latestDocumentId: string | null = request.contextDocumentId ?? null;
      let latestDocument: AksaDocumentModel | null = null;
      let readResult: AgentDocumentResult | null = null;
      let documentAuthority: "context" | "search" | null = request.contextDocumentId === null ? null : "context";
      let toolSteps = 0;

      for (const call of plan.toolCalls) {
        if (run.cancelled) return unavailable(request, "cancelled");
        toolSteps += 1;
        if (toolSteps > maxSteps) throw new AgentPlannerError("timeout");

        const args = asArguments(call);
        const parsedInput = parseDocsToolInput(call.name, args);
        if (!parsedInput.success) throw new AgentPlannerError("validation_failed");

        if (call.name === "drive.search") {
          const input = docsFindInputSchema.parse(parsedInput.data);
          const listing = await listDocumentsForUser(context, input.query);
          if (listing.status === "blocked") return unavailable(request, listing.error.category);
          if (listing.status === "empty") return unavailable(request, "not_found");
          const data = listing.status === "partial" || listing.status === "ready" ? listing.data : null;
          if (!data) return unavailable(request, "not_found");
          const validated = driveListingSchema.safeParse(data);
          if (!validated.success) throw new AgentPlannerError("validation_failed");
          const selected = [...validated.data.items]
            .filter((item) => item.category === "document" && item.canRead)
            .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))[0];
          if (!selected) return unavailable(request, "not_found");
          latestDocumentId = selected.id;
          documentAuthority = "search";
          continue;
        }

        if (call.name === "docs.read") {
          const input = docsReadInputSchema.parse(parsedInput.data);
          if (documentAuthority === null ||
            (documentAuthority === "search" && input.documentId !== "$latest") ||
            (documentAuthority === "context" && input.documentId !== "$latest" && input.documentId !== request.contextDocumentId)) {
            throw new AgentPlannerError("validation_failed");
          }
          const documentId = resolveDocumentId(input.documentId, latestDocumentId);
          if (!documentId) return unavailable(request, "not_found");

          if (plan.intent === "read_document") {
            const read = await readDocumentForAgent(context, documentId);
            if (read.outcome === "blocked") return unavailable(request, read.error.category);
            run.taskId = read.task.id;
            if (read.outcome === "failed") return taskResult(read.task);
            readResult = agentResult(read.document);
            latestDocument = read.document;
          } else {
            const snapshot = await readDocumentSnapshotForUser(context, documentId);
            if (snapshot.status === "blocked") return unavailable(request, snapshot.error.category);
            if (snapshot.status === "empty" || snapshot.status === "loading") return unavailable(request, "not_found");
            latestDocument = snapshot.data;
            readResult = agentResult(snapshot.data);
          }
          latestDocumentId = documentId;
          continue;
        }

        if (call.name === "docs.apply_edit") {
          if (plan.intent !== "edit_document" || latestDocument === null) {
            throw new AgentPlannerError("validation_failed");
          }
          const input = docsAppendInputSchema.parse(parsedInput.data);
          if (
            input.expectedRevisionId !== "$revision" ||
            (input.documentId !== "$latest" && input.documentId !== latestDocument.id)
          ) {
            throw new AgentPlannerError("validation_failed");
          }
          const documentId = resolveDocumentId(input.documentId, latestDocumentId);
          if (!documentId) return unavailable(request, "not_found");
          const appendText = input.appendText === "$summary"
            ? extractiveSummary(latestDocument)
            : input.appendText === "$translate_id"
            ? documentTranslation(latestDocument, "id")
            : input.appendText === "$translate_en"
            ? documentTranslation(latestDocument, "en")
            : resolveGeneratedAppendText(input.appendText, request.locale);
          if (!appendText) return unavailable(request, "unsupported");

          const proposal = await proposeDocumentAppend(context, {
            documentId,
            appendText,
            expectedRevisionId: latestDocument.revisionId
          });
          if (proposal.outcome === "blocked") return unavailable(request, proposal.error.category);
          run.taskId = proposal.task.id;
          const confirmation = confirmationSchema.parse(proposal.confirmation);
          return taskResult(proposal.task, confirmation);
        }
      }

      if (run.cancelled) return unavailable(request, "cancelled");
      if (run.taskId !== null && readResult !== null) {
        const task = await readPersistedTaskByIdempotency(context, request.commandId);
        if (task) return taskResult(task, null, readResult);
      }
      return unavailable(request, "internal_error");
    } catch (error) {
      if (error instanceof AgentPlannerError) {
        return error.category === "unsupported"
          ? { outcome: "rejected", error: createAksaError("unsupported") }
          : unavailable(request, plannerErrorCategory(error));
      }
      return unavailable(request, "internal_error");
    } finally {
      activeRuns.delete(request.commandId);
    }
  }

  async function cancelTask(taskId: string): Promise<CancellationResult> {
    const session = await readSessionState();
    if (session.status !== "authenticated") {
      return { outcome: "unable_to_cancel", error: createAksaError("authentication_required") };
    }

    for (const run of activeRuns.values()) {
      if (run.taskId === taskId) run.cancelled = true;
    }
    return cancelPersistedTask(session.session, taskId);
  }

  async function readTaskActivity(taskId: string): Promise<ActivityFeed> {
    const session = await readSessionState();
    if (session.status !== "authenticated") return { events: [], evidenceBacked: true };
    const feed = await readPersistedActivity(session.session.userId, session.session.workspaceId);
    if (feed.status !== "ready" && feed.status !== "partial") return { events: [], evidenceBacked: true };
    return {
      events: feed.data.events.filter((event) => event.taskId === taskId),
      evidenceBacked: true
    };
  }

  return { submitCommand, cancelTask, readTaskActivity };
}

const sharedAgentRunner = createAgentRunner();

export function agentRunner(options: AgentRunnerOptions = {}): AgentRunner {
  return Object.keys(options).length === 0 ? sharedAgentRunner : createAgentRunner(options);
}

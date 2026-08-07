import { describe, expect, it } from "vitest";
import {
  createAksaError,
  errorCategories,
  isRetryableCategory,
  type ErrorCategory
} from "@/lib/contracts/errors";
import { artifactSchema, type Artifact } from "@/lib/contracts/search";
import { undoRecordSchema, isUndoOfferable } from "@/lib/contracts/undo";
import {
  ILLUSTRATIVE_CONFIRMATION_PREFIX,
  ILLUSTRATIVE_TASK_ID,
  confirmationSchema,
  isIllustrativeConfirmationId,
  isValidIllustrativeConfirmation,
  type Confirmation
} from "@/lib/contracts/confirmation";
import {
  isCancellableTaskState,
  isTerminalTaskState,
  taskStates,
  type TaskState
} from "@/lib/contracts/task";
import { capabilitySnapshotSchema, findCapability } from "@/lib/contracts/capability";
import { commandSubmissionSchema, commandResultSchema } from "@/lib/contracts/command";
import {
  intentToolAllowlist,
  registryHasDeleteTool,
  searchSubagentAllowlist,
  toolRegistry,
  isToolAllowedForIntent
} from "@/lib/server/ai/tool-registry";

function baseArtifact(): Artifact {
  return {
    id: "artifact-1",
    taskId: "task-1",
    kind: "search_summary",
    title: "Latest tooling news",
    blocks: [{ type: "summary", text: "A summary.", citations: ["source-1"] }],
    sources: [
      {
        id: "source-1",
        title: "A publisher article",
        publisher: "Publisher",
        url: "https://example.com/article",
        domain: "example.com",
        publishedAt: null,
        retrievedAt: 1_700_000_000_000,
        snippet: "Snippet text."
      }
    ],
    language: "en",
    bodyFormat: "markdown_safe",
    retrievedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    truncated: false
  };
}

describe("error model", () => {
  it("gives every category at least one way forward", () => {
    for (const category of errorCategories) {
      const error = createAksaError(category);
      expect(error.nextActions.length).toBeGreaterThan(0);
      expect(error.messageKey).toBe(`error.${category}`);
      expect(error.debugReference).toContain(category);
    }
  });

  it("marks transient categories retryable and permanent ones not", () => {
    expect(isRetryableCategory("rate_limited")).toBe(true);
    expect(isRetryableCategory("timeout")).toBe(true);
    expect(isRetryableCategory("not_configured")).toBe(false);
    expect(isRetryableCategory("scope_required")).toBe(false);
  });

  it("carries preserved progress when an operation stopped part way", () => {
    const error = createAksaError("partial_failure", {
      preservedProgress: {
        completedCount: 9,
        remainingCount: 3,
        completedItemNames: ["a"],
        remainingItemNames: ["b"]
      }
    });

    expect(error.preservedProgress?.completedCount).toBe(9);
    expect(error.preservedProgress?.remainingCount).toBe(3);
  });

  it("never emits a category outside the stable set", () => {
    const categories: ErrorCategory[] = [...errorCategories];
    expect(new Set(categories).size).toBe(categories.length);
  });
});

describe("artifact contract", () => {
  it("accepts an artifact whose claims all map to listed sources", () => {
    expect(artifactSchema.safeParse(baseArtifact()).success).toBe(true);
  });

  it("rejects a search summary with no source", () => {
    const artifact = { ...baseArtifact(), sources: [] };
    expect(artifactSchema.safeParse(artifact).success).toBe(false);
  });

  it("rejects a citation that does not map to a listed source", () => {
    const artifact = baseArtifact();
    artifact.blocks = [{ type: "summary", text: "A claim.", citations: ["source-missing"] }];
    expect(artifactSchema.safeParse(artifact).success).toBe(false);
  });

  it("requires a conflict note to cite both sides", () => {
    const artifact = baseArtifact();
    artifact.blocks = [{ type: "conflict_note", text: "They disagree.", citations: ["source-1"] }];
    expect(artifactSchema.safeParse(artifact).success).toBe(false);
  });
});

describe("undo contract", () => {
  it("requires a stated reason when the reverse operation is unsupported", () => {
    const unsupported = {
      id: "undo-1",
      taskId: "task-1",
      kind: null,
      supported: false,
      unsupportedReasonKey: null,
      state: "unavailable" as const,
      affectedItems: [],
      itemsTotal: 0,
      itemsReverted: null,
      expiresAt: null,
      resultSummaryKey: null
    };

    expect(undoRecordSchema.safeParse(unsupported).success).toBe(false);
    expect(
      undoRecordSchema.safeParse({
        ...unsupported,
        unsupportedReasonKey: "undo_reason_folder_create"
      }).success
    ).toBe(true);
  });

  it("offers Undo only for a supported record that is still available", () => {
    const record = undoRecordSchema.parse({
      id: "undo-2",
      taskId: "task-1",
      kind: "drive_move",
      supported: true,
      unsupportedReasonKey: null,
      state: "available",
      affectedItems: [],
      itemsTotal: 12,
      itemsReverted: null,
      expiresAt: 1_700_000_000_000,
      resultSummaryKey: null
    });

    expect(isUndoOfferable(record)).toBe(true);
    expect(isUndoOfferable({ ...record, state: "expired" })).toBe(false);
    expect(isUndoOfferable({ ...record, supported: false, unsupportedReasonKey: "x" })).toBe(false);
  });
});

describe("confirmation contract", () => {
  const illustrative: Confirmation = {
    id: `${ILLUSTRATIVE_CONFIRMATION_PREFIX}drive-move`,
    taskId: ILLUSTRATIVE_TASK_ID,
    action: "drive_move",
    scopeItems: [{ id: "i1", name: "Week 1 report", kind: "drive_file" }],
    scopeItemsTotal: 1,
    destinationName: "Submissions",
    changesExternalData: true,
    externalSystem: "google_drive",
    undoSupported: true,
    undoUnsupportedReasonKey: null,
    expiresAt: 0,
    canApprove: true,
    canEdit: true,
    canCancel: true,
    illustrative: true
  };

  it("validates a well-formed confirmation", () => {
    expect(confirmationSchema.safeParse(illustrative).success).toBe(true);
  });

  it("recognises reserved preview identifiers", () => {
    expect(isIllustrativeConfirmationId(illustrative.id)).toBe(true);
    expect(isIllustrativeConfirmationId("confirmation-real-1")).toBe(false);
  });

  it("treats a real pending approval as not a preview even if mislabelled", () => {
    expect(isValidIllustrativeConfirmation(illustrative)).toBe(true);
    expect(
      isValidIllustrativeConfirmation({ ...illustrative, id: "confirmation-real-1" })
    ).toBe(false);
    expect(isValidIllustrativeConfirmation({ ...illustrative, taskId: "task-9" })).toBe(false);
    expect(isValidIllustrativeConfirmation({ ...illustrative, illustrative: false })).toBe(false);
  });
});

describe("task contract", () => {
  it("exposes exactly the product state set", () => {
    expect([...taskStates]).toEqual([
      "idle",
      "listening",
      "transcribing",
      "understanding",
      "executing",
      "waiting_for_confirmation",
      "completed",
      "partially_completed",
      "failed",
      "cancelled",
      "undo_available"
    ]);
  });

  it("classifies terminal and cancellable states", () => {
    const terminal: TaskState[] = ["completed", "partially_completed", "failed", "cancelled"];
    for (const state of terminal) {
      expect(isTerminalTaskState(state)).toBe(true);
      expect(isCancellableTaskState(state)).toBe(false);
    }

    expect(isCancellableTaskState("executing")).toBe(true);
    expect(isCancellableTaskState("waiting_for_confirmation")).toBe(true);
    expect(isCancellableTaskState("idle")).toBe(false);
  });
});

describe("command contract", () => {
  it("rejects an empty command", () => {
    const result = commandSubmissionSchema.safeParse({
      commandId: "command-12345678",
      text: "   ",
      transcript: null,
      locale: "en",
      source: "text",
      submittedAt: 1
    });

    expect(result.success).toBe(false);
  });

  it("keeps understanding separate from execution", () => {
    const parsed = commandResultSchema.safeParse({
      outcome: "unavailable",
      understanding: {
        commandId: "command-12345678",
        receivedText: "Find the files for this project",
        source: "text",
        locale: "en",
        receivedAt: 1,
        intentResolved: false
      },
      error: createAksaError("not_configured")
    });

    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.outcome === "unavailable") {
      /** An echo of the command is not a resolved intent. */
      expect(parsed.data.understanding.intentResolved).toBe(false);
    }
  });
});

describe("capability contract", () => {
  it("finds a capability by name", () => {
    const snapshot = capabilitySnapshotSchema.parse({
      capabilities: [
        {
          name: "drive_read",
          availability: "connection_required",
          requiresConnection: true,
          requiresScope: false,
          reasonCategory: "connection_required",
          nextAction: "connect_google"
        }
      ],
      checkedAt: 1
    });

    expect(findCapability(snapshot, "drive_read")?.availability).toBe("connection_required");
    expect(findCapability(snapshot, "gmail_read")).toBeNull();
  });
});

describe("tool registry", () => {
  it("contains no delete tool", () => {
    expect(registryHasDeleteTool()).toBe(false);
  });

  it("requires a confirmation for every write tool that touches an external system", () => {
    for (const tool of toolRegistry) {
      if (tool.kind === "write" && tool.requiredCapability !== null) {
        expect(tool.confirmationRequired).toBe(true);
        expect(tool.confirmationAction).not.toBeNull();
      }
    }
  });

  it("never requires a confirmation for a read or search tool", () => {
    for (const tool of toolRegistry) {
      if (tool.kind !== "write") {
        expect(tool.confirmationRequired).toBe(false);
      }
    }
  });

  it("states no undo kind where the reverse operation is not supported", () => {
    const createFolder = toolRegistry.find((tool) => tool.name === "drive.create_folder");
    expect(createFolder?.undoKind).toBeNull();
  });

  it("keeps the search subagent away from Google tools", () => {
    for (const name of searchSubagentAllowlist) {
      expect(name.startsWith("drive.")).toBe(false);
      expect(name.startsWith("docs.")).toBe(false);
      expect(name.startsWith("sheets.")).toBe(false);
      expect(name.startsWith("gmail.")).toBe(false);
    }
  });

  it("refuses a tool outside the intent allowlist", () => {
    expect(isToolAllowedForIntent("research", "search.grounded_query")).toBe(true);
    expect(isToolAllowedForIntent("research", "drive.move")).toBe(false);
    expect(isToolAllowedForIntent("find_files", "drive.move")).toBe(false);
    expect(intentToolAllowlist.unsupported).toHaveLength(0);
  });
});

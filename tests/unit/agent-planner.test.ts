// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deterministicAgentPlan } from "@/lib/server/ai/agent-planner";

const baseRequest = {
  locale: "en" as const,
  userId: "user-agent-plan",
  workspaceId: "workspace-agent-plan"
};

describe("deterministic Docs planning", () => {
  it("keeps the exact document title in a find request", () => {
    const plan = deterministicAgentPlan({
      ...baseRequest,
      text: "Find my document Project Brief",
      contextDocumentId: null
    });

    expect(plan).toEqual({
      intent: "read_document",
      toolCalls: [
        { name: "drive.search", arguments: { query: "project brief", selectLatest: true } },
        { name: "docs.read", arguments: { documentId: "$latest" } }
      ]
    });
  });

  it("uses the previous real document for a context-bound edit", () => {
    const plan = deterministicAgentPlan({
      ...baseRequest,
      text: 'Add "Reviewed by Aksa" to the end.',
      contextDocumentId: "doc-project-brief"
    });

    expect(plan).toEqual({
      intent: "edit_document",
      toolCalls: [
        { name: "docs.read", arguments: { documentId: "doc-project-brief" } },
        {
          name: "docs.apply_edit",
          arguments: {
            documentId: "doc-project-brief",
            appendText: "Reviewed by Aksa",
            expectedRevisionId: "$revision"
          }
        }
      ]
    });
  });
});

// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentPlannerError,
  deterministicAgentPlan,
  planAgentRequest
} from "@/lib/server/ai/agent-planner";

const request = {
  text: "Please do something with my data",
  locale: "en" as const,
  contextDocumentId: null,
  userId: "planner-user",
  workspaceId: "planner-workspace"
};

afterEach(() => {
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GOOGLE_AI_MODEL;
});

describe("bounded Docs planner", () => {
  it("builds a deterministic read plan without a model call", () => {
    const plan = deterministicAgentPlan({
      ...request,
      text: "Read this document",
      contextDocumentId: "doc-real-1"
    });

    expect(plan).toEqual({
      intent: "read_document",
      toolCalls: [{ name: "docs.read", arguments: { documentId: "doc-real-1" } }]
    });
  });

  it("rejects malformed structured planner output", async () => {
    await expect(
      planAgentRequest(request, {
        planner: async () => ({ intent: "read_document", toolCalls: "not-an-array" } as never)
      })
    ).rejects.toMatchObject({ category: "validation_failed" } satisfies Partial<AgentPlannerError>);
  });

  it("rejects an unknown tool from the model boundary", async () => {
    await expect(
      planAgentRequest(request, {
        planner: async () => ({
          intent: "read_document",
          toolCalls: [{ name: "shell.exec", arguments: {} }]
        } as never)
      })
    ).rejects.toMatchObject({ category: "validation_failed" } satisfies Partial<AgentPlannerError>);
  });

  it("rejects provider-shaped malformed JSON", async () => {
    process.env.GOOGLE_AI_API_KEY = "unit-test-key";
    process.env.GOOGLE_AI_MODEL = "gemini-3.1-flash-lite";
    const fetchImpl = async () => new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] }),
      { status: 200 }
    );

    await expect(planAgentRequest(request, { fetchImpl })).rejects.toMatchObject({
      category: "validation_failed"
    });
  });

  it("does not exceed four planned tool calls", async () => {
    await expect(
      planAgentRequest(request, {
        planner: async () => ({
          intent: "read_document",
          toolCalls: Array.from({ length: 5 }, () => ({ name: "docs.read", arguments: { documentId: "doc-1" } }))
        } as never)
      })
    ).rejects.toMatchObject({ category: "validation_failed" });
  });

  it("rejects a plan that can mutate before reading", async () => {
    await expect(
      planAgentRequest({ ...request, contextDocumentId: "doc-1" }, {
        planner: async () => ({
          intent: "edit_document",
          toolCalls: [
            { name: "docs.apply_edit", arguments: { documentId: "doc-1", appendText: "unsafe", expectedRevisionId: "$revision" } },
            { name: "docs.read", arguments: { documentId: "doc-1" } }
          ]
        } as never)
      })
    ).rejects.toMatchObject({ category: "validation_failed" });
  });
});

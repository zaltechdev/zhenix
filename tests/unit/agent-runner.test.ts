// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db/client";
import { bootstrapUserWorkspaceAndProfile } from "@/lib/server/db/dal";
import { users } from "@/lib/server/db/schema";
import { storeGoogleTokens } from "@/lib/server/google/token-store";
import { createAgentRunner } from "@/lib/server/ai/agent-runner";
import { respondToConfirmation } from "@/lib/server/tasks/service";
import { readPersistedActivity, readPersistedTaskHistory } from "@/lib/server/google/docs-workflow";

const readSessionStateMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/auth/service", () => ({ readSessionState: readSessionStateMock }));

const encryptionKey = "agent-runner-test-encryption-key-32-bytes";

function googleDocument(text: string, revisionId: string) {
  return {
    documentId: "doc-agent-1",
    title: "Agent project brief",
    revisionId,
    body: {
      content: [{
        startIndex: 0,
        endIndex: Math.max(2, text.length + 2),
        paragraph: {
          elements: [{
            startIndex: 1,
            endIndex: Math.max(2, text.length + 2),
            textRun: { content: `${text}\n` }
          }]
        }
      }]
    }
  };
}

describe("bounded Docs agent runner", () => {
  let userId: string;
  let workspaceId: string;
  let documentText = "Original project brief.";
  let revisionId = "agent-rev-1";
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env.AUTH_SECRET = "agent-runner-test-auth-secret";
    process.env.GOOGLE_CLIENT_ID = "agent-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "agent-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = encryptionKey;
    userId = `agent_runner_${crypto.randomUUID()}`;
    const email = `${userId}@example.com`;
    await db.insert(users).values({ id: userId, email, name: "Agent Test", createdAt: new Date(), updatedAt: new Date() });
    workspaceId = (await bootstrapUserWorkspaceAndProfile(userId, email, "Agent Test")).workspaceId;
    await storeGoogleTokens(userId, {
      accessToken: "agent-access-token",
      refreshToken: "agent-refresh-token",
      expiresAt: Date.now() + 60_000,
      scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.metadata.readonly",
      idToken: null
    }, "agent@example.com");
    documentText = "Original project brief.";
    revisionId = "agent-rev-1";
    readSessionStateMock.mockResolvedValue({
      status: "authenticated",
      session: {
        userId,
        email,
        displayName: "Agent Test",
        workspaceId,
        locale: "en",
        expiresAt: Date.now() + 60_000
      }
    });
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({
          access_token: "agent-refreshed-access-token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.metadata.readonly"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("docs.googleapis.com/v1/documents/doc-agent-1") && init?.method !== "POST") {
        return new Response(JSON.stringify(googleDocument(documentText, revisionId)), { status: 200 });
      }
      if (url.includes(":batchUpdate") && init?.method === "POST") {
        documentText = `${documentText}\nAppended safely`;
        revisionId = "agent-rev-2";
        return new Response(JSON.stringify({ documentId: "doc-agent-1", replies: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    readSessionStateMock.mockReset();
    await db.delete(users).where(eq(users.id, userId));
    delete process.env.AUTH_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  });

  function submission(commandId: string, text: string) {
    return {
      commandId,
      text,
      transcript: null,
      contextDocumentId: "doc-agent-1",
      locale: "en" as const,
      source: "text" as const,
      submittedAt: Date.now()
    };
  }

  it("reads a real document and returns verified content with persisted history", async () => {
    const result = await createAgentRunner().submitCommand(
      submission("agent-read-command-1", "Read this document")
    );

    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") return;
    expect(result.task.state).toBe("completed");
    expect(result.result?.text).toContain("Original project brief.");
    expect(result.result?.verified).toBe(true);

    const activity = await readPersistedActivity(userId, workspaceId);
    expect(activity.status).toBe("ready");
    if (activity.status !== "ready") return;
    expect(activity.data.events.some((event) => event.eventType === "step_succeeded")).toBe(true);

    const history = await readPersistedTaskHistory(userId, workspaceId);
    expect(history.status).toBe("ready");
    if (history.status !== "ready") return;
    expect(history.data.tasks.some((task) => task.id === result.task.id)).toBe(true);
  });

  it("requires confirmation, cancel performs zero writes, and approve verifies the write", async () => {
    const runner = createAgentRunner();
    const cancelledProposal = await runner.submitCommand(
      submission("agent-edit-cancel-1", 'Append "Appended safely" to this document')
    );
    expect(cancelledProposal.outcome).toBe("accepted");
    if (cancelledProposal.outcome !== "accepted" || !cancelledProposal.confirmation) return;
    expect(cancelledProposal.task.state).toBe("waiting_for_confirmation");
    const writesBeforeCancel = fetchMock.mock.calls.filter(([url]) => String(url).includes(":batchUpdate")).length;

    const cancelled = await runner.cancelTask(cancelledProposal.task.id);
    expect(cancelled.outcome).toBe("accepted");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes(":batchUpdate")).length).toBe(writesBeforeCancel);

    const approvedProposal = await runner.submitCommand(
      submission("agent-edit-approve-1", 'Append "Appended safely" to this document')
    );
    expect(approvedProposal.outcome).toBe("accepted");
    if (approvedProposal.outcome !== "accepted" || !approvedProposal.confirmation) return;

    const approved = await respondToConfirmation({
      confirmationId: approvedProposal.confirmation.id,
      decision: "approve"
    });
    expect(approved.outcome).toBe("executed");
    if (approved.outcome !== "executed") return;
    expect(approved.task.state).toBe("completed");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(":batchUpdate"))).toBe(true);
    expect(documentText).toContain("Appended safely");
  });

  it("returns an honest provider-unavailable result for unsupported semantics", async () => {
    const result = await createAgentRunner().submitCommand(
      submission("agent-unsupported-1", "Please reorganize my entire account")
    );

    expect(result.outcome).toBe("unavailable");
    if (result.outcome !== "unavailable") return;
    expect(result.error.category).toBe("not_configured");
  });

  it("times out a planner without running any tool", async () => {
    const planner = async () => await new Promise<never>(() => {});
    const result = await createAgentRunner({ planner, taskTimeoutMs: 5 }).submitCommand(
      submission("agent-timeout-1", "Please do something with my data")
    );

    expect(result.outcome).toBe("unavailable");
    if (result.outcome !== "unavailable") return;
    expect(result.error.category).toBe("timeout");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

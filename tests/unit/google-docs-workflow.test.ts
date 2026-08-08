// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db/client";
import { bootstrapUserWorkspaceAndProfile } from "@/lib/server/db/dal";
import { users } from "@/lib/server/db/schema";
import { getGoogleConnectionState, getValidAccessToken, storeGoogleTokens } from "@/lib/server/google/token-store";
import {
  listDocumentsForUser,
  proposeDocumentAppend,
  readPersistedTaskHistory,
  readPersistedActivity,
  respondToDocumentConfirmation
} from "@/lib/server/google/docs-workflow";

const TEST_KEY = "test-high-entropy-oauth-token-encryption-key-32bytes";

function googleDocument(text: string, revisionId: string) {
  const endIndex = Math.max(2, text.length + 2);
  return {
    documentId: "doc-real-1",
    title: "Real project brief",
    revisionId,
    body: {
      content: [{
        startIndex: 0,
        endIndex,
        paragraph: {
          elements: [{
            startIndex: 1,
            endIndex,
            textRun: { content: `${text}\n` }
          }]
        }
      }]
    }
  };
}

describe("real Docs confirmation workflow", () => {
  let userId: string;
  let workspaceId: string;
  let documentText = "Original text";
  let revisionId = "rev-1";
  let allowVerification = true;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-long-enough-for-state-signing";
    process.env.GOOGLE_CLIENT_ID = "client-id-for-tests";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret-for-tests";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/google/callback";
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.GOOGLE_API_MAX_RETRIES = "1";
    userId = `docs_workflow_${crypto.randomUUID()}`;
    const email = `${userId}@example.com`;
    await db.insert(users).values({ id: userId, email, name: "Docs Test", createdAt: new Date(), updatedAt: new Date() });
    workspaceId = (await bootstrapUserWorkspaceAndProfile(userId, email, "Docs Test")).workspaceId;
    await storeGoogleTokens(userId, {
      accessToken: "unused-access-token",
      refreshToken: "encrypted-refresh-token",
      expiresAt: Date.now() + 60_000,
      scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.metadata.readonly",
      idToken: null
    }, "docs@example.com");

    documentText = "Original text";
    revisionId = "rev-1";
    allowVerification = true;
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({
          access_token: "short-lived-access-token",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.metadata.readonly"
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("drive/v3/files")) {
        return new Response(JSON.stringify({
          files: [{
            id: "doc-real-1",
            name: "Real project brief",
            mimeType: "application/vnd.google-apps.document",
            modifiedTime: "2026-08-08T20:00:00.000Z",
            parents: ["folder-real-1"],
            webViewLink: "https://docs.google.com/document/d/doc-real-1/edit",
            capabilities: { canEdit: true, canRename: true, canMoveItemWithinDrive: true }
          }],
          incompleteSearch: false
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes(":batchUpdate") && method === "POST") {
        if (allowVerification) {
          documentText = `${documentText}\nAppended safely`;
          revisionId = "rev-2";
        }
        return new Response(JSON.stringify({ documentId: "doc-real-1", replies: [], writeControl: { requiredRevisionId: revisionId } }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("docs.googleapis.com/v1/documents/doc-real-1")) {
        return new Response(JSON.stringify(googleDocument(documentText, revisionId)), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ error: "unexpected test request" }), { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete(users).where(eq(users.id, userId));
    delete process.env.AUTH_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_API_MAX_RETRIES;
  });

  it("creates a confirmation and cancel performs zero Google writes", async () => {
    const context = { userId, workspaceId };
    const proposal = await proposeDocumentAppend(context, {
      documentId: "doc-real-1",
      appendText: "Appended safely",
      expectedRevisionId: "rev-1"
    });

    expect(proposal.outcome).toBe("confirmation_required");
    if (proposal.outcome !== "confirmation_required") return;
    expect(proposal.confirmation.preview).toBe("Appended safely");

    const cancelled = await respondToDocumentConfirmation(context, proposal.confirmation.id, "cancel");
    expect(cancelled.outcome).toBe("cancelled");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("batchUpdate"))).toBe(false);
  });

  it("discovers real Docs through the server-side Drive boundary", async () => {
    const listing = await listDocumentsForUser({ userId, workspaceId });

    expect(listing.status).toBe("ready");
    if (listing.status !== "ready") return;
    expect(listing.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "doc-real-1", name: "Real project brief", category: "document" })
    ]));
  });

  it("confirms, writes, reads back, verifies, and records activity", async () => {
    const context = { userId, workspaceId };
    const proposal = await proposeDocumentAppend(context, {
      documentId: "doc-real-1",
      appendText: "Appended safely",
      expectedRevisionId: "rev-1"
    });
    if (proposal.outcome !== "confirmation_required") throw new Error("proposal did not require confirmation");

    const completed = await respondToDocumentConfirmation(context, proposal.confirmation.id, "approve");
    expect(completed.outcome).toBe("completed");
    if (completed.outcome !== "completed") return;
    expect(completed.document.blocks.map((block) => block.plainText).join("\n")).toContain("Appended safely");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(":batchUpdate"))).toBe(true);

    const activity = await readPersistedActivity(userId, workspaceId);
    expect(activity.status).toBe("ready");
    if (activity.status !== "ready") return;
    expect(activity.data.events.some((event) => event.eventType === "confirmation_approved")).toBe(true);
    expect(activity.data.events.some((event) => event.eventType === "task_completed" && event.verified)).toBe(true);

    const history = await readPersistedTaskHistory(userId, workspaceId);
    expect(history.status).toBe("ready");
    if (history.status !== "ready") return;
    expect(history.data.tasks.some((task) => task.state === "completed")).toBe(true);
  });

  it("does not claim success when read-back verification fails", async () => {
    allowVerification = false;
    const context = { userId, workspaceId };
    const proposal = await proposeDocumentAppend(context, {
      documentId: "doc-real-1",
      appendText: "Appended safely",
      expectedRevisionId: "rev-1"
    });
    if (proposal.outcome !== "confirmation_required") throw new Error("proposal did not require confirmation");

    const failed = await respondToDocumentConfirmation(context, proposal.confirmation.id, "approve");
    expect(failed.outcome).toBe("failed");
    if (failed.outcome !== "failed") return;
    expect(failed.error.category).toBe("verification_failed");
  });

  it("marks a permanently rejected refresh credential for reconnect", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: "invalid_grant" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    }));

    expect(await getValidAccessToken(userId)).toBeNull();
    expect(await getGoogleConnectionState(userId)).toBe("needs_reconnect");
  });
});

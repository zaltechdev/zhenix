// @vitest-environment node
import { describe, expect, it } from "vitest";
import { agentRunner } from "@/lib/server/ai/agent-runner";
import {
  cancelTask,
  readActiveTask,
  readTaskHistory,
  requestUndo,
  respondToConfirmation,
  submitCommand
} from "@/lib/server/tasks/service";
import { readWorkspaceActivity } from "@/lib/server/activity/service";
import { readCapabilitySnapshot } from "@/lib/server/capabilities/service";
import { googleGateway } from "@/lib/server/google/service";
import { searchGateway } from "@/lib/server/search/service";
import { authGateway } from "@/lib/server/auth/service";
import { commandResultSchema } from "@/lib/contracts/command";
import { ILLUSTRATIVE_CONFIRMATION_PREFIX } from "@/lib/contracts/confirmation";

/**
 * Server boundary honesty.
 *
 * These assertions exist because an unconfigured integration must report an explicit
 * typed state. A stub that returned a plausible success would be worse than no stub.
 */
const submission = {
  commandId: "command-12345678",
  text: "Find the files for this project",
  transcript: null,
  locale: "en" as const,
  source: "text" as const,
  submittedAt: 1_700_000_000_000
};

describe("agent runner", () => {
  it("never accepts a command while execution is unconfigured", async () => {
    const result = await submitCommand(submission);

    expect(commandResultSchema.safeParse(result).success).toBe(true);
    expect(result.outcome).not.toBe("accepted");
    if (result.outcome === "unavailable") {
      expect(result.understanding.receivedText).toBe(submission.text);
      expect(result.understanding.intentResolved).toBe(false);
      expect(["not_configured", "unavailable"]).toContain(result.error.category);
    }
  });

  it("rejects a malformed submission rather than guessing at it", async () => {
    const result = await agentRunner().submitCommand({
      ...submission,
      text: ""
    });

    expect(result.outcome).toBe("rejected");
  });

  it("returns an empty, evidence-backed activity feed rather than invented steps", async () => {
    const feed = await agentRunner().readTaskActivity("task-1");

    expect(feed.events).toHaveLength(0);
    expect(feed.evidenceBacked).toBe(true);
  });
});

describe("session scoped reads", () => {
  it("blocks task reads instead of returning a global collection", async () => {
    for (const state of [await readActiveTask(), await readTaskHistory()]) {
      expect(state.status).toBe("blocked");
      if (state.status === "blocked") {
        expect(["authentication_required", "not_configured", "session_expired"]).toContain(
          state.error.category
        );
      }
    }
  });

  it("blocks the activity feed for an unauthenticated caller", async () => {
    const state = await readWorkspaceActivity();
    expect(state.status).toBe("blocked");
  });

  it("refuses to cancel or undo without a session", async () => {
    const cancellation = await cancelTask("task-1");
    expect(cancellation.outcome).toBe("unable_to_cancel");

    const undo = await requestUndo("undo-1");
    expect(undo.outcome).not.toBe("applied");
    expect(undo.outcome).not.toBe("partially_applied");
  });
});

describe("confirmation boundary", () => {
  it("refuses a labelled preview identifier unconditionally", async () => {
    const outcome = await respondToConfirmation({
      confirmationId: `${ILLUSTRATIVE_CONFIRMATION_PREFIX}drive-move`,
      decision: "approve"
    });

    expect(outcome.outcome).toBe("unavailable");
    if (outcome.outcome === "unavailable") {
      expect(outcome.error.category).toBe("not_found");
    }
  });

  it("never executes a confirmation while writes are unavailable", async () => {
    const outcome = await respondToConfirmation({
      confirmationId: "confirmation-real-1",
      decision: "approve"
    });

    expect(outcome.outcome).not.toBe("executed");
  });
});

describe("google boundary", () => {
  it("blocks every read with a named reason and fabricates no content", async () => {
    const gateway = googleGateway();
    const states = [
      await gateway.searchDrive({ query: "report" }),
      await gateway.readDriveItem("file-1"),
      await gateway.readDocument("doc-1"),
      await gateway.readSheetRange({ spreadsheetId: "sheet-1" }),
      await gateway.listRecentMail(),
      await gateway.readMailMessage("message-1")
    ];

    for (const state of states) {
      expect(state.status).toBe("blocked");
      if (state.status === "blocked") {
        expect(["not_configured", "authentication_required", "connection_required"]).toContain(
          state.error.category
        );
      }
    }
  });

  it("never reports a write as completed", async () => {
    const gateway = googleGateway();
    const proposals = [
      await gateway.proposeDriveMove({ itemIds: ["a"], destinationFolderId: "b" }),
      await gateway.proposeDriveRename({ itemId: "a", nextName: "b" }),
      await gateway.proposeDriveCreateFolder({ parentFolderId: null, name: "b" }),
      await gateway.proposeSheetWrite({
        spreadsheetId: "s",
        sheetId: "t",
        a1Range: "A1:B2",
        values: [["1"]]
      }),
      await gateway.proposeMailDraft({ to: ["a@example.com"], subject: "s", body: "b" })
    ];

    for (const proposal of proposals) {
      expect(proposal.outcome).toBe("blocked");
    }

    const execution = await gateway.executeConfirmedWrite("confirmation-1");
    expect(execution.outcome).toBe("blocked");
  });

  it("reports the connection as not connected and grants no capability", async () => {
    const connection = await googleGateway().readConnection();

    expect(connection.state).toBe("not_connected");
    expect(connection.grantedCapabilities).toHaveLength(0);
    expect(connection.accountEmail).toBeNull();
  });

  it("reports the Drive chooser as unavailable without exposing a token", async () => {
    const picker = await googleGateway().readPickerCapability();

    expect(picker.available).toBe(false);
    expect(picker.requiredCapability).toBe("drive_picker");
  });
});

describe("search boundary", () => {
  it("reports unavailability instead of answering from model memory", async () => {
    const state = await searchGateway().runGroundedQuery({
      query: "latest AI coding tool news",
      locale: "en"
    });

    expect(state.status).toBe("blocked");
    expect(searchGateway().isGroundingAvailable()).toBe(false);
  });

  it("rejects an empty query", async () => {
    const state = await searchGateway().runGroundedQuery({ query: "   ", locale: "en" });
    expect(state.status).toBe("blocked");
    if (state.status === "blocked") {
      expect(state.error.category).toBe("validation_failed");
    }
  });
});

describe("account boundary", () => {
  it("never returns a session while authentication is unconfigured", async () => {
    const gateway = authGateway();
    const state = await gateway.readSessionState();

    expect(state.status).toBe("unavailable");

    const signIn = await gateway.signIn({
      email: "person@example.com",
      password: "correct horse battery",
      locale: "en"
    });
    expect(signIn.outcome).toBe("unavailable");

    const signUp = await gateway.signUp({
      email: "person@example.com",
      password: "correct horse battery",
      locale: "en"
    });
    expect(signUp.outcome).toBe("unavailable");
  });

  it("validates a profile before reporting the boundary state", async () => {
    const gateway = authGateway();

    const invalid = await gateway.saveAccessibilityProfile({
      pointerSensitivity: 5000,
      deadZone: 20,
      smoothing: 40,
      selectionMode: "dwell",
      dwellDurationMs: 1200,
      gestureType: null,
      gestureThreshold: null,
      gestureCooldownMs: null,
      reacquisitionPointerBehavior: "keep_position",
      reducedMotion: false
    });
    expect(invalid.outcome).toBe("invalid_input");

    const valid = await gateway.saveAccessibilityProfile({
      pointerSensitivity: 50,
      deadZone: 20,
      smoothing: 40,
      selectionMode: "dwell",
      dwellDurationMs: 1200,
      gestureType: null,
      gestureThreshold: null,
      gestureCooldownMs: null,
      reacquisitionPointerBehavior: "keep_position",
      reducedMotion: false
    });
    expect(valid.outcome).toBe("unavailable");
  });
});

describe("capability snapshot", () => {
  it("names why each capability is unavailable and offers a next action", async () => {
    const snapshot = await readCapabilitySnapshot();

    expect(snapshot.capabilities.length).toBeGreaterThan(0);
    for (const capability of snapshot.capabilities) {
      if (capability.availability === "available") {
        expect(capability.reasonCategory).toBeNull();
      } else {
        expect(capability.reasonCategory).not.toBeNull();
        expect(capability.nextAction).not.toBe("none");
      }
    }
  });

  it("leaves browser capabilities out, because the server cannot know them", async () => {
    const snapshot = await readCapabilitySnapshot();
    const names = snapshot.capabilities.map((capability) => capability.name);

    expect(names).not.toContain("voice_input");
    expect(names).not.toContain("camera_input");
    expect(names).not.toContain("head_pointer");
  });
});

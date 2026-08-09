import { assertServerOnly } from "@/lib/server/server-guard";
import { googleStatus } from "@/lib/server/config/runtime-config";
import { createAksaError } from "@/lib/server/errors/aksa-error";
import { blockedResource, type ResourceState } from "@/lib/contracts/resource-state";
import type { AksaError } from "@/lib/contracts/errors";
import type { GoogleConnection, DrivePickerCapability } from "@/lib/contracts/google";
import type {
  GoogleWorkspaceGateway,
  WriteExecution,
  WriteProposal
} from "@/lib/server/google/gateway";
import { readSessionState } from "@/lib/server/auth/service";
import { getConnectedEmail, getGoogleConnectionState, getGrantedGoogleScopes, getValidAccessToken } from "@/lib/server/google/token-store";
import {
  listDriveItemsForUser,
  proposeDocumentAppend,
  readDocumentForUser,
  readDriveItemForUser,
  respondToDocumentConfirmation
} from "@/lib/server/google/docs-workflow";

assertServerOnly("src/lib/server/google/service.ts");

async function blockingError(): Promise<AksaError> {
  if (!googleStatus().configured) {
    return createAksaError("not_configured");
  }

  const session = await readSessionState();
  if (session.status !== "authenticated") {
    return createAksaError("authentication_required");
  }

  return createAksaError("connection_required");
}

async function blocked<TData>(): Promise<ResourceState<TData>> {
  return blockedResource<TData>(await blockingError());
}

async function blockedProposal(): Promise<WriteProposal> {
  return { outcome: "blocked", error: await blockingError() };
}

async function blockedExecution(): Promise<WriteExecution> {
  return { outcome: "blocked", error: await blockingError() };
}

function createRealGoogleGateway(): GoogleWorkspaceGateway {
  return {
    async readConnection(): Promise<GoogleConnection> {
      const session = await readSessionState();
      if (session.status !== "authenticated") {
        return {
          state: "not_connected",
          accountEmail: null,
          grantedCapabilities: [],
          checkedAt: Date.now()
        };
      }

      let state: GoogleConnection["state"] = await getGoogleConnectionState(session.session.userId);
      if (state === "connected") {
        const accessToken = await getValidAccessToken(session.session.userId);
        if (!accessToken && (await getGoogleConnectionState(session.session.userId)) === "connected") {
          state = "error";
        }
      }
      const email = await getConnectedEmail(session.session.userId);
      const scopes = state === "connected" ? await getGrantedGoogleScopes(session.session.userId) : [];
      const hasDocsWrite = scopes.includes("https://www.googleapis.com/auth/documents");
      const hasDocsRead = hasDocsWrite || scopes.includes("https://www.googleapis.com/auth/documents.readonly");
      const hasDriveRead = scopes.some((scope) => [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.metadata.readonly"
      ].includes(scope));

      return {
        state,
        accountEmail: state === "connected" || state === "needs_reconnect" ? email : null,
        grantedCapabilities: state === "connected"
          ? [
              ...(hasDocsRead ? ["docs_read" as const] : []),
              ...(hasDocsWrite ? ["docs_write" as const] : []),
              ...(hasDriveRead ? ["drive_read" as const] : [])
            ]
          : [],
        checkedAt: Date.now()
      };
    },

    async searchDrive(input) {
      const session = await readSessionState();
      if (session.status !== "authenticated") return blocked();
      return listDriveItemsForUser(session.session, input.query, input.pageToken ?? null);
    },
    async readDriveItem(itemId) {
      const session = await readSessionState();
      if (session.status !== "authenticated") return blocked();
      return readDriveItemForUser(session.session, itemId);
    },
    proposeDriveMove: () => blockedProposal(),
    proposeDriveRename: () => blockedProposal(),
    proposeDriveCreateFolder: () => blockedProposal(),

    async readDocument(documentId) {
      const session = await readSessionState();
      if (session.status !== "authenticated") return blocked();
      return readDocumentForUser(session.session, documentId);
    },
    async proposeDocumentEdit(input) {
      const session = await readSessionState();
      if (session.status !== "authenticated") return blockedProposal();
      return proposeDocumentAppend(session.session, input);
    },

    readSheetRange: () => blocked(),
    proposeSheetWrite: () => blockedProposal(),

    listRecentMail: () => blocked(),
    readMailMessage: () => blocked(),
    proposeMailDraft: () => blockedProposal(),

    async executeConfirmedWrite(confirmationId) {
      const session = await readSessionState();
      if (session.status !== "authenticated") return blockedExecution();
      const result = await respondToDocumentConfirmation(session.session, confirmationId, "approve");
      if (result.outcome === "completed") return { outcome: "completed", task: result.task };
      if (result.outcome === "failed") return { outcome: "blocked", error: result.error };
      if (result.outcome === "cancelled") return { outcome: "blocked", error: createAksaError("cancelled") };
      return { outcome: "blocked", error: "error" in result ? result.error : createAksaError("unavailable") };
    },

    async readPickerCapability(): Promise<DrivePickerCapability> {
      return { available: false, requiredCapability: "drive_picker" };
    },

    readDraft: () => blocked()
  };
}

export function googleGateway(): GoogleWorkspaceGateway {
  return createRealGoogleGateway();
}

export async function readGoogleConnection(): Promise<GoogleConnection> {
  return googleGateway().readConnection();
}

export function googleConfiguration() {
  return googleStatus();
}

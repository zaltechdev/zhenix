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
import { isGoogleConnected, getConnectedEmail } from "@/lib/server/google/token-store";

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

      const connected = await isGoogleConnected(session.session.userId);
      const email = await getConnectedEmail(session.session.userId);

      return {
        state: connected ? "connected" : "not_connected",
        accountEmail: email,
        grantedCapabilities: connected ? ["docs_read", "drive_read", "drive_picker"] : [],
        checkedAt: Date.now()
      };
    },

    searchDrive: () => blocked(),
    readDriveItem: () => blocked(),
    proposeDriveMove: () => blockedProposal(),
    proposeDriveRename: () => blockedProposal(),
    proposeDriveCreateFolder: () => blockedProposal(),

    readDocument: () => blocked(),
    proposeDocumentEdit: () => blockedProposal(),

    readSheetRange: () => blocked(),
    proposeSheetWrite: () => blockedProposal(),

    listRecentMail: () => blocked(),
    readMailMessage: () => blocked(),
    proposeMailDraft: () => blockedProposal(),

    executeConfirmedWrite: () => blockedExecution(),

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

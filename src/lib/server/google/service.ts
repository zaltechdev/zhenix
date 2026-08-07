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

assertServerOnly("src/lib/server/google/service.ts");

/**
 * Unconfigured Google boundary.
 *
 * Every read reports why it cannot proceed. Nothing here fabricates a file, a
 * document, a sheet range, or a message, and no write ever reports success.
 */

async function blockingError(): Promise<AksaError> {
  if (!googleStatus().configured) {
    return createAksaError("not_configured");
  }

  /**
   * Credentials alone are not enough. A Google connection belongs to an account,
   * and the account boundary is unconfigured, so the honest blocker is the account.
   */
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

function createUnconfiguredGoogleGateway(): GoogleWorkspaceGateway {
  return {
    async readConnection(): Promise<GoogleConnection> {
      return {
        state: "not_connected",
        accountEmail: null,
        grantedCapabilities: [],
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
      /**
       * The Google Picker package is deliberately not installed, and no OAuth token
       * is exposed to the client to support a placeholder.
       */
      return { available: false, requiredCapability: "drive_picker" };
    },

    readDraft: () => blocked()
  };
}

export function googleGateway(): GoogleWorkspaceGateway {
  return createUnconfiguredGoogleGateway();
}

export async function readGoogleConnection(): Promise<GoogleConnection> {
  return googleGateway().readConnection();
}

export function googleConfiguration() {
  return googleStatus();
}

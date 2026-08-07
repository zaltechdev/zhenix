import type { ResourceState } from "@/lib/contracts/resource-state";
import type {
  DocumentResource,
  DraftRequest,
  DraftResource,
  DriveItem,
  DriveListing,
  GoogleConnection,
  MailInbox,
  MailMessageBody,
  SheetRange
} from "@/lib/contracts/google";
import type { Confirmation } from "@/lib/contracts/confirmation";
import type { Task } from "@/lib/contracts/task";

/**
 * The Google Workspace boundary Zaltech implements.
 *
 * Reads return a `ResourceState`, so disconnected, missing scope, unconfigured,
 * oversized, and failed all arrive as data the interface can render without
 * knowing anything about Google.
 *
 * Writes never execute directly. Each write returns a `Confirmation` first, and
 * execution happens only against an approved single-use confirmation. See
 * `.agents/features/google-workspace.md`.
 */

export type DriveSearchInput = {
  query: string;
  pageToken?: string | null;
};

export type SheetRangeInput = {
  spreadsheetId: string;
  sheetId?: string | null;
  a1Range?: string | null;
};

export type DriveMoveInput = {
  itemIds: string[];
  destinationFolderId: string;
};

export type DriveRenameInput = {
  itemId: string;
  nextName: string;
};

export type DriveCreateFolderInput = {
  parentFolderId: string | null;
  name: string;
};

export type DocumentEditInput = {
  documentId: string;
  tabId: string;
  /** Normalized replacement blocks. The frontend never sends a Google request body. */
  blocks: DocumentResource["blocks"];
};

export type SheetWriteInput = {
  spreadsheetId: string;
  sheetId: string;
  a1Range: string;
  values: string[][];
};

/**
 * A write request either produces an approval to review, or explains why it cannot
 * proceed. It never reports success.
 */
export type WriteProposal =
  | { outcome: "confirmation_required"; confirmation: Confirmation }
  | { outcome: "blocked"; error: import("@/lib/contracts/errors").AksaError };

export type WriteExecution =
  | { outcome: "completed"; task: Task }
  | { outcome: "partially_completed"; task: Task }
  | { outcome: "blocked"; error: import("@/lib/contracts/errors").AksaError };

export type GoogleWorkspaceGateway = {
  readConnection(): Promise<GoogleConnection>;

  /* Drive */
  searchDrive(input: DriveSearchInput): Promise<ResourceState<DriveListing>>;
  readDriveItem(itemId: string): Promise<ResourceState<DriveItem>>;
  proposeDriveMove(input: DriveMoveInput): Promise<WriteProposal>;
  proposeDriveRename(input: DriveRenameInput): Promise<WriteProposal>;
  proposeDriveCreateFolder(input: DriveCreateFolderInput): Promise<WriteProposal>;

  /* Docs */
  readDocument(documentId: string, tabId?: string | null): Promise<ResourceState<DocumentResource>>;
  proposeDocumentEdit(input: DocumentEditInput): Promise<WriteProposal>;

  /* Sheets */
  readSheetRange(input: SheetRangeInput): Promise<ResourceState<SheetRange>>;
  proposeSheetWrite(input: SheetWriteInput): Promise<WriteProposal>;

  /* Gmail */
  listRecentMail(pageToken?: string | null): Promise<ResourceState<MailInbox>>;
  readMailMessage(messageId: string): Promise<ResourceState<MailMessageBody>>;
  proposeMailDraft(input: DraftRequest): Promise<WriteProposal>;

  /* Confirmed execution */
  executeConfirmedWrite(confirmationId: string): Promise<WriteExecution>;

  /** Drive picker entry point. Reports availability rather than exposing a token. */
  readPickerCapability(): Promise<import("@/lib/contracts/google").DrivePickerCapability>;

  /* Draft read-back, used by the mail surface after a confirmed draft creation */
  readDraft(draftId: string): Promise<ResourceState<DraftResource>>;
};

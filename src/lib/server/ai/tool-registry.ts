import { z } from "zod";
import type { CapabilityName } from "@/lib/contracts/capability";
import type { ConfirmationAction } from "@/lib/contracts/confirmation";
import type { IntentCategory } from "@/lib/contracts/task";
import type { UndoKind } from "@/lib/contracts/undo";

/**
 * Tool registry descriptors.
 *
 * The registry is an allowlist. An unlisted tool cannot be called, and the model
 * never decides whether a tool is permitted. Descriptors carry the shape and the
 * policy; implementations are Zaltech's. See `.agents/features/agent-orchestration.md`.
 */

export const toolKinds = ["read", "write", "search"] as const;
export const toolKindSchema = z.enum(toolKinds);
export type ToolKind = z.infer<typeof toolKindSchema>;

export const toolNames = [
  "workspace.open_view",
  "drive.search",
  "drive.file_metadata",
  "drive.move",
  "drive.rename",
  "drive.create_folder",
  "docs.read",
  "docs.apply_edit",
  "sheets.read_range",
  "sheets.write_range",
  "gmail.list_recent",
  "gmail.read_message",
  "gmail.create_draft",
  "search.grounded_query",
  "artifact.create"
] as const;

export const toolNameSchema = z.enum(toolNames);
export type ToolName = z.infer<typeof toolNameSchema>;

export type ToolDescriptor = {
  name: ToolName;
  kind: ToolKind;
  /** Null for Aksa-owned tools that touch no external system. */
  requiredCapability: CapabilityName | null;
  confirmationRequired: boolean;
  /** The confirmation action this tool consumes, when one is required. */
  confirmationAction: ConfirmationAction | null;
  /** Null when the reverse operation is not genuinely supported. */
  undoKind: UndoKind | null;
};

/**
 * MVP registry. Read-only tools are the default and every state change is a
 * separate, confirmed tool.
 */
export const toolRegistry: readonly ToolDescriptor[] = [
  {
    name: "workspace.open_view",
    kind: "read",
    requiredCapability: null,
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "drive.search",
    kind: "read",
    requiredCapability: "drive_read",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "drive.file_metadata",
    kind: "read",
    requiredCapability: "drive_read",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "drive.move",
    kind: "write",
    requiredCapability: "drive_write",
    confirmationRequired: true,
    confirmationAction: "drive_move",
    undoKind: "drive_move"
  },
  {
    name: "drive.rename",
    kind: "write",
    requiredCapability: "drive_write",
    confirmationRequired: true,
    confirmationAction: "drive_rename",
    undoKind: "drive_rename"
  },
  {
    name: "drive.create_folder",
    kind: "write",
    requiredCapability: "drive_write",
    confirmationRequired: true,
    confirmationAction: "drive_create_folder",
    /** Reversing a folder creation would be a delete, which is out of MVP. */
    undoKind: null
  },
  {
    name: "docs.read",
    kind: "read",
    requiredCapability: "docs_read",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "docs.apply_edit",
    kind: "write",
    requiredCapability: "docs_write",
    confirmationRequired: true,
    confirmationAction: "docs_apply_edit",
    undoKind: "docs_edit"
  },
  {
    name: "sheets.read_range",
    kind: "read",
    requiredCapability: "sheets_read",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "sheets.write_range",
    kind: "write",
    requiredCapability: "sheets_write",
    confirmationRequired: true,
    confirmationAction: "sheets_write_range",
    undoKind: "sheets_range_write"
  },
  {
    name: "gmail.list_recent",
    kind: "read",
    requiredCapability: "gmail_read",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "gmail.read_message",
    kind: "read",
    requiredCapability: "gmail_read",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "gmail.create_draft",
    kind: "write",
    requiredCapability: "gmail_compose",
    confirmationRequired: true,
    confirmationAction: "gmail_create_draft",
    undoKind: "gmail_draft_delete"
  },
  {
    name: "search.grounded_query",
    kind: "search",
    requiredCapability: "grounded_search",
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  },
  {
    name: "artifact.create",
    kind: "write",
    /** Aksa-owned data only. It cannot reach Google data, so no confirmation. */
    requiredCapability: null,
    confirmationRequired: false,
    confirmationAction: null,
    undoKind: null
  }
];

/** Per-intent allowlists. An intent can never reach a tool outside its list. */
export const intentToolAllowlist: Record<IntentCategory, readonly ToolName[]> = {
  navigate: ["workspace.open_view"],
  find_files: ["drive.search", "drive.file_metadata"],
  read_document: ["drive.search", "docs.read"],
  edit_document: ["drive.search", "docs.read", "docs.apply_edit"],
  read_sheet: ["sheets.read_range"],
  write_sheet: ["sheets.read_range", "sheets.write_range"],
  read_mail: ["gmail.list_recent", "gmail.read_message"],
  draft_mail: ["gmail.list_recent", "gmail.read_message", "gmail.create_draft"],
  organize_files: ["drive.search", "drive.file_metadata", "drive.move", "drive.rename", "drive.create_folder"],
  research: ["search.grounded_query", "artifact.create"],
  unsupported: []
};

/** Tools the search subagent may call. It cannot widen this list. */
export const searchSubagentAllowlist: readonly ToolName[] = [
  "search.grounded_query",
  "artifact.create"
];

export function findTool(name: ToolName): ToolDescriptor | null {
  return toolRegistry.find((tool) => tool.name === name) ?? null;
}

export function isToolAllowedForIntent(intent: IntentCategory, name: ToolName): boolean {
  return intentToolAllowlist[intent].includes(name);
}

/** No delete tool exists in the registry. Deleting Google content is prohibited. */
export function registryHasDeleteTool(): boolean {
  return toolRegistry.some((tool) => tool.name.includes("delete"));
}

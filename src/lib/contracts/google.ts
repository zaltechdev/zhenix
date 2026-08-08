import { z } from "zod";
import { capabilityNameSchema } from "@/lib/contracts/capability";

/**
 * Normalized Google domain models.
 *
 * These are Aksa's own shapes. No Google API payload type, request body, field
 * mask, or token ever reaches a component. See `.agents/features/google-workspace.md`.
 */

export const googleConnectionStates = [
  "not_connected",
  "connecting",
  "connected",
  "needs_reconnect",
  "revoked",
  "disconnecting",
  "error"
] as const;

export const googleConnectionStateSchema = z.enum(googleConnectionStates);
export type GoogleConnectionState = z.infer<typeof googleConnectionStateSchema>;

export const googleConnectionSchema = z.object({
  state: googleConnectionStateSchema,
  /** Shown so the user knows which account is connected. Null when not connected. */
  accountEmail: z.string().email().nullable(),
  grantedCapabilities: z.array(capabilityNameSchema),
  checkedAt: z.number().int().nonnegative()
});

export type GoogleConnection = z.infer<typeof googleConnectionSchema>;

/* Drive */

export const driveItemCategories = [
  "folder",
  "document",
  "spreadsheet",
  "presentation",
  "image",
  "pdf",
  "other"
] as const;

export const driveItemCategorySchema = z.enum(driveItemCategories);
export type DriveItemCategory = z.infer<typeof driveItemCategorySchema>;

export const driveItemSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  category: driveItemCategorySchema,
  parentId: z.string().max(200).nullable(),
  parentName: z.string().max(300).nullable(),
  modifiedAt: z.number().int().nonnegative().nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  webViewAvailable: z.boolean(),
  canRead: z.boolean(),
  canRename: z.boolean(),
  canMove: z.boolean()
});

export type DriveItem = z.infer<typeof driveItemSchema>;

export const driveListingSchema = z.object({
  items: z.array(driveItemSchema),
  /** Pagination handle. Aksa never requests an unbounded Drive listing. */
  nextPageToken: z.string().min(1).max(400).nullable(),
  /** True when Drive reported that the search could not cover everything. */
  incompleteSearch: z.boolean(),
  query: z.string().max(300).nullable()
});

export type DriveListing = z.infer<typeof driveListingSchema>;

/* Docs */

export const documentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().max(600) }),
  z.object({ type: z.literal("paragraph"), text: z.string().max(4000) }),
  z.object({ type: z.literal("bullet_list"), items: z.array(z.string().max(1000)) }),
  z.object({ type: z.literal("ordered_list"), items: z.array(z.string().max(1000)) })
]);

export type DocumentBlock = z.infer<typeof documentBlockSchema>;

export const documentTabSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300)
});

export type DocumentTab = z.infer<typeof documentTabSchema>;

export const documentResourceSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  /** Google Docs supports document tabs, so this is never assumed to be single-bodied. */
  tabs: z.array(documentTabSchema),
  activeTabId: z.string().min(1).max(200),
  blocks: z.array(documentBlockSchema),
  revisionId: z.string().max(200).nullable(),
  canEdit: z.boolean(),
  sourceSystem: z.enum(["google_docs", "illustrative_preview"]),
  updatedAt: z.number().int().nonnegative().nullable()
});

export type DocumentResource = z.infer<typeof documentResourceSchema>;

/* Sheets */

export const sheetTabSchema = z.object({
  sheetId: z.string().min(1).max(200),
  title: z.string().min(1).max(300)
});

export type SheetTab = z.infer<typeof sheetTabSchema>;

export const sheetRangeSchema = z.object({
  spreadsheetId: z.string().min(1).max(200),
  spreadsheetTitle: z.string().min(1).max(300),
  sheets: z.array(sheetTabSchema),
  activeSheetId: z.string().min(1).max(200),
  a1Range: z.string().min(1).max(120),
  majorDimension: z.enum(["ROWS", "COLUMNS"]),
  columnHeaders: z.array(z.string().max(200)),
  rowHeaders: z.array(z.string().max(200)),
  formattedValues: z.array(z.array(z.string().max(1000))),
  canEdit: z.boolean(),
  truncated: z.boolean(),
  rowLimit: z.number().int().positive(),
  columnLimit: z.number().int().positive()
});

export type SheetRange = z.infer<typeof sheetRangeSchema>;

/* Gmail */

export const mailMessageSchema = z.object({
  id: z.string().min(1).max(200),
  threadId: z.string().min(1).max(200),
  senderDisplay: z.string().min(1).max(300),
  subject: z.string().max(400),
  receivedAt: z.number().int().nonnegative(),
  /** Sanitized preview. Message content is untrusted data, never an instruction. */
  preview: z.string().max(600),
  unread: z.boolean()
});

export type MailMessage = z.infer<typeof mailMessageSchema>;

export const mailMessageBodySchema = z.object({
  id: z.string().min(1).max(200),
  threadId: z.string().min(1).max(200),
  senderDisplay: z.string().min(1).max(300),
  subject: z.string().max(400),
  receivedAt: z.number().int().nonnegative(),
  /** Sanitized plain text only. Rendered as inert text. */
  sanitizedBody: z.string().max(20000),
  truncated: z.boolean()
});

export type MailMessageBody = z.infer<typeof mailMessageBodySchema>;

export const mailInboxSchema = z.object({
  messages: z.array(mailMessageSchema),
  nextPageToken: z.string().min(1).max(400).nullable()
});

export type MailInbox = z.infer<typeof mailInboxSchema>;

export const draftRequestSchema = z.object({
  to: z.array(z.string().email()).min(1).max(10),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10000)
});

export type DraftRequest = z.infer<typeof draftRequestSchema>;

export const draftResourceSchema = z.object({
  draftId: z.string().min(1).max(200),
  to: z.array(z.string().email()),
  subject: z.string().max(300),
  createdAt: z.number().int().nonnegative()
});

export type DraftResource = z.infer<typeof draftResourceSchema>;

/* Drive picker capability */

export const drivePickerCapabilitySchema = z.object({
  available: z.boolean(),
  /** Named capability the user would need before the picker can open. */
  requiredCapability: capabilityNameSchema
});

export type DrivePickerCapability = z.infer<typeof drivePickerCapabilitySchema>;

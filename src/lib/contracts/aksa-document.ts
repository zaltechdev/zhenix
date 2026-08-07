/**
 * Aksa normalized document model.
 *
 * The adapter boundary between Google Docs JSON and the TipTap editor.
 * Components render this. They never see Google API shapes.
 *
 * Each block carries its source Google indexes so edits can be mapped back
 * to structured Docs API operations (Pass 3).
 */

export type AksaTextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  link: string | null;
  /** Google document start index for this run. */
  startIndex: number;
  /** Google document end index for this run. */
  endIndex: number;
};

export type AksaTableData = {
  rows: number;
  columns: number;
  cells: string[][];
};

export type AksaBlockType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "table"
  | "image"
  | "unsupported";

export type AksaBlock = {
  id: string;
  type: AksaBlockType;
  textRuns: AksaTextRun[];
  /** Plain text content for accessibility and search. */
  plainText: string;
  /** Heading level 1-6, null for non-heading blocks. */
  headingLevel: number | null;
  /** CSS text-align value, null for default (start). */
  alignment: string | null;
  /** Google list ID for list items. */
  listId: string | null;
  /** Nesting level for list items (0-based). */
  nestingLevel: number | null;
  /** Whether the list is ordered (true) or unordered (false/null). */
  ordered: boolean | null;
  /** Source Google document start index. */
  sourceStartIndex: number;
  /** Source Google document end index. */
  sourceEndIndex: number;
  /** Read-only blocks cannot be edited (tables, images, unsupported). */
  readOnly: boolean;
  /** Table data for table blocks. */
  tableData?: AksaTableData;
  /** Image URL for image blocks. */
  imageUri?: string;
  /** Alt text for image blocks. */
  imageAlt?: string;
};

export type AksaDocumentModel = {
  id: string;
  title: string;
  revisionId: string;
  blocks: AksaBlock[];
  sourceSystem: "google_docs" | "illustrative_preview";
  canEdit: boolean;
  updatedAt: number | null;
};

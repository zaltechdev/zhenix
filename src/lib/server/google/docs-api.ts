import { assertServerOnly } from "@/lib/server/server-guard";
import { fetchGoogleJson } from "@/lib/server/google/http";

assertServerOnly("src/lib/server/google/docs-api.ts");

/**
 * Direct Google Docs API client.
 *
 * Uses fetch against the REST API. No `googleapis` package (saves ~40MB).
 * Every call requires an access token obtained server-side.
 */

const DOCS_BASE = "https://docs.googleapis.com/v1/documents";

export { GoogleApiError } from "@/lib/server/google/http";

export type GoogleDocsGetResponse = {
  documentId: string;
  title: string;
  revisionId: string;
  body: {
    content: GoogleStructuralElement[];
  };
  lists?: Record<string, GoogleList>;
  namedStyles?: { styles: GoogleNamedStyle[] };
};

export type GoogleStructuralElement = {
  startIndex: number;
  endIndex: number;
  paragraph?: GoogleParagraph;
  table?: GoogleTable;
  sectionBreak?: unknown;
  tableOfContents?: unknown;
};

export type GoogleParagraph = {
  elements: GoogleParagraphElement[];
  paragraphStyle?: {
    namedStyleType?: string;
    alignment?: string;
  };
  bullet?: {
    listId: string;
    nestingLevel: number;
  };
};

export type GoogleParagraphElement = {
  startIndex: number;
  endIndex: number;
  textRun?: {
    content: string;
    textStyle?: GoogleTextStyle;
  };
  inlineObjectElement?: {
    inlineObjectId: string;
  };
};

export type GoogleTextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  link?: { url?: string };
  fontSize?: { magnitude: number; unit: string };
  foregroundColor?: unknown;
  backgroundColor?: unknown;
  weightedFontFamily?: { fontFamily: string; weight: number };
};

export type GoogleTable = {
  rows: number;
  columns: number;
  tableRows: GoogleTableRow[];
};

export type GoogleTableRow = {
  tableCells: GoogleTableCell[];
};

export type GoogleTableCell = {
  content: GoogleStructuralElement[];
};

export type GoogleList = {
  listProperties: {
    nestingLevels: Array<{
      bulletAlignment?: string;
      glyphType?: string;
      glyphFormat?: string;
      glyphSymbol?: string;
      startNumber?: number;
    }>;
  };
};

export type GoogleNamedStyle = {
  namedStyleType: string;
  textStyle?: GoogleTextStyle;
  paragraphStyle?: {
    alignment?: string;
  };
};

export type GoogleBatchUpdateRequest = {
  requests: GoogleDocRequest[];
  writeControl?: {
    requiredRevisionId?: string;
    targetRevisionId?: string;
  };
};

export type GoogleDocRequest =
  | { insertText: { text: string; location: { index: number; segmentId?: string } } }
  | { deleteContentRange: { range: { startIndex: number; endIndex: number; segmentId?: string } } }
  | { updateTextStyle: { range: { startIndex: number; endIndex: number }; textStyle: Partial<GoogleTextStyle>; fields: string } }
  | { updateParagraphStyle: { range: { startIndex: number; endIndex: number }; paragraphStyle: { namedStyleType: string }; fields: string } }
  | { createParagraphBullets: { range: { startIndex: number; endIndex: number }; bulletPreset: string } }
  | { deleteParagraphBullets: { range: { startIndex: number; endIndex: number } } };

export type GoogleBatchUpdateResponse = {
  documentId: string;
  replies: unknown[];
  writeControl: {
    requiredRevisionId: string;
  };
};

/**
 * Fetch a Google Doc by ID.
 */
export async function getDocument(
  accessToken: string,
  documentId: string
): Promise<GoogleDocsGetResponse> {
  return fetchGoogleJson<GoogleDocsGetResponse>(
    `${DOCS_BASE}/${encodeURIComponent(documentId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    },
    "documents.get"
  );
}

/**
 * Apply a batch update to a Google Doc.
 */
export async function batchUpdateDocument(
  accessToken: string,
  documentId: string,
  request: GoogleBatchUpdateRequest
): Promise<GoogleBatchUpdateResponse> {
  return fetchGoogleJson<GoogleBatchUpdateResponse>(
    `${DOCS_BASE}/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(request)
    },
    "documents.batchUpdate"
  );
}

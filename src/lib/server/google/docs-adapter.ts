import { assertServerOnly } from "@/lib/server/server-guard";
import type {
  GoogleDocsGetResponse,
  GoogleParagraph,
  GoogleParagraphElement,
  GoogleStructuralElement,
  GoogleTable,
} from "@/lib/server/google/docs-api";
import type { AksaBlock, AksaDocumentModel, AksaTextRun } from "@/lib/contracts/aksa-document";

assertServerOnly("src/lib/server/google/docs-adapter.ts");

/**
 * Transforms a Google Docs API response into Aksa's normalized document model.
 *
 * Adapter boundary between raw Google JSON and the frontend representation.
 * Components never see Google API shapes.
 *
 * Preserves source indexes for edit mapping (Pass 3).
 * Unsupported structures become read-only blocks, not silent omissions.
 */

let blockIdCounter = 0;
function nextBlockId(): string {
  blockIdCounter += 1;
  return `block-${blockIdCounter}`;
}

function extractTextRuns(elements: GoogleParagraphElement[]): AksaTextRun[] {
  const runs: AksaTextRun[] = [];

  for (const element of elements) {
    if (!element.textRun) continue;

    const content = element.textRun.content;
    /** Skip the trailing newline Google adds to every paragraph. */
    const text = content.endsWith("\n") ? content.slice(0, -1) : content;
    if (text.length === 0) continue;

    const style = element.textRun.textStyle ?? {};

    runs.push({
      text,
      bold: style.bold === true,
      italic: style.italic === true,
      underline: style.underline === true,
      strikethrough: style.strikethrough === true,
      link: style.link?.url ?? null,
      startIndex: element.startIndex,
      endIndex: element.endIndex
    });
  }

  return runs;
}

function namedStyleToHeadingLevel(namedStyleType: string | undefined): number | null {
  switch (namedStyleType) {
    case "HEADING_1": return 1;
    case "HEADING_2": return 2;
    case "HEADING_3": return 3;
    case "HEADING_4": return 4;
    case "HEADING_5": return 5;
    case "HEADING_6": return 6;
    default: return null;
  }
}

function alignmentToCSS(alignment: string | undefined): string | null {
  switch (alignment) {
    case "CENTER": return "center";
    case "END": return "right";
    case "JUSTIFIED": return "justify";
    case "START":
    default: return null;
  }
}

function convertParagraph(
  paragraph: GoogleParagraph,
  startIndex: number,
  endIndex: number,
  lists: GoogleDocsGetResponse["lists"]
): AksaBlock {
  const headingLevel = namedStyleToHeadingLevel(paragraph.paragraphStyle?.namedStyleType);
  const textRuns = extractTextRuns(paragraph.elements);
  const alignment = alignmentToCSS(paragraph.paragraphStyle?.alignment);
  const plainText = textRuns.map((run) => run.text).join("");

  if (paragraph.bullet) {
    const listId = paragraph.bullet.listId;
    const nestingLevel = paragraph.bullet.nestingLevel ?? 0;
    const listDef = lists?.[listId];
    const nestingDef = listDef?.listProperties?.nestingLevels?.[nestingLevel];

    /** Detect ordered vs unordered from glyph properties. */
    const isOrdered = nestingDef?.glyphType !== undefined &&
      nestingDef.glyphType !== "GLYPH_TYPE_UNSPECIFIED";

    return {
      id: nextBlockId(),
      type: "list_item",
      textRuns,
      plainText,
      headingLevel: null,
      alignment,
      listId,
      nestingLevel,
      ordered: isOrdered,
      sourceStartIndex: startIndex,
      sourceEndIndex: endIndex,
      readOnly: false
    };
  }

  if (headingLevel !== null) {
    return {
      id: nextBlockId(),
      type: "heading",
      textRuns,
      plainText,
      headingLevel,
      alignment,
      listId: null,
      nestingLevel: null,
      ordered: null,
      sourceStartIndex: startIndex,
      sourceEndIndex: endIndex,
      readOnly: false
    };
  }

  return {
    id: nextBlockId(),
    type: "paragraph",
    textRuns,
    plainText,
    headingLevel: null,
    alignment,
    listId: null,
    nestingLevel: null,
    ordered: null,
    sourceStartIndex: startIndex,
    sourceEndIndex: endIndex,
    readOnly: false
  };
}

function convertTable(table: GoogleTable, startIndex: number, endIndex: number): AksaBlock {
  const rows: string[][] = [];

  for (const tableRow of table.tableRows) {
    const cells: string[] = [];
    for (const cell of tableRow.tableCells) {
      const cellText = cell.content
        .map((element) => {
          if (element.paragraph) {
            return element.paragraph.elements
              .map((el) => el.textRun?.content ?? "")
              .join("");
          }
          return "";
        })
        .join("")
        .trim();
      cells.push(cellText);
    }
    rows.push(cells);
  }

  return {
    id: nextBlockId(),
    type: "table",
    textRuns: [],
    plainText: `[Table: ${table.rows} rows, ${table.columns} columns]`,
    headingLevel: null,
    alignment: null,
    listId: null,
    nestingLevel: null,
    ordered: null,
    sourceStartIndex: startIndex,
    sourceEndIndex: endIndex,
    readOnly: true,
    tableData: { rows: table.rows, columns: table.columns, cells: rows }
  };
}

function convertStructuralElement(
  element: GoogleStructuralElement,
  lists: GoogleDocsGetResponse["lists"]
): AksaBlock | null {
  if (element.paragraph) {
    return convertParagraph(element.paragraph, element.startIndex, element.endIndex, lists);
  }

  if (element.table) {
    return convertTable(element.table, element.startIndex, element.endIndex);
  }

  /** Section breaks and table of contents are unsupported but preserved. */
  if (element.sectionBreak || element.tableOfContents) {
    return {
      id: nextBlockId(),
      type: "unsupported",
      textRuns: [],
      plainText: element.sectionBreak ? "[Section break]" : "[Table of contents]",
      headingLevel: null,
      alignment: null,
      listId: null,
      nestingLevel: null,
      ordered: null,
      sourceStartIndex: element.startIndex,
      sourceEndIndex: element.endIndex,
      readOnly: true
    };
  }

  return null;
}

/**
 * Transform a Google Docs API response into an AksaDocumentModel.
 */
export function adaptGoogleDocument(response: GoogleDocsGetResponse): AksaDocumentModel {
  blockIdCounter = 0;
  const blocks: AksaBlock[] = [];

  for (const element of response.body.content) {
    const block = convertStructuralElement(element, response.lists);
    if (block) {
      blocks.push(block);
    }
  }

  return {
    id: response.documentId,
    title: response.title,
    revisionId: response.revisionId,
    blocks,
    sourceSystem: "google_docs",
    canEdit: true,
    updatedAt: Date.now()
  };
}

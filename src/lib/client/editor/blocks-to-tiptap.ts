import type { AksaBlock, AksaTextRun } from "@/lib/contracts/aksa-document";

/**
 * Converts AksaDocumentModel blocks to TipTap-compatible HTML.
 *
 * All Google-sourced content is treated as untrusted data. Text is escaped
 * before it reaches the editor. Only known safe HTML structures are generated.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTextRun(run: AksaTextRun): string {
  let html = escapeHtml(run.text);

  if (run.link) {
    html = `<a href="${escapeHtml(run.link)}">${html}</a>`;
  }
  if (run.bold) {
    html = `<strong>${html}</strong>`;
  }
  if (run.italic) {
    html = `<em>${html}</em>`;
  }
  if (run.underline) {
    html = `<u>${html}</u>`;
  }
  if (run.strikethrough) {
    html = `<s>${html}</s>`;
  }

  return html;
}

function renderTextRuns(runs: AksaTextRun[]): string {
  if (runs.length === 0) return "";
  return runs.map(renderTextRun).join("");
}

function alignmentStyle(alignment: string | null): string {
  if (!alignment) return "";
  return ` style="text-align: ${escapeHtml(alignment)}"`;
}

/**
 * Convert an array of AksaBlocks to TipTap-compatible HTML.
 *
 * Groups consecutive list items by listId into <ul> or <ol> wrappers.
 */
export function blocksToTiptapHtml(blocks: AksaBlock[]): string {
  const parts: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    switch (block.type) {
      case "heading": {
        const level = Math.min(Math.max(block.headingLevel ?? 2, 1), 6);
        const content = renderTextRuns(block.textRuns);
        parts.push(`<h${level}${alignmentStyle(block.alignment)}>${content || "&nbsp;"}</h${level}>`);
        i += 1;
        break;
      }

      case "paragraph": {
        const content = renderTextRuns(block.textRuns);
        parts.push(`<p${alignmentStyle(block.alignment)}>${content || "&nbsp;"}</p>`);
        i += 1;
        break;
      }

      case "list_item": {
        /** Group consecutive list items with the same listId. */
        const listId = block.listId;
        const isOrdered = block.ordered === true;
        const tag = isOrdered ? "ol" : "ul";
        const items: string[] = [];

        while (i < blocks.length && blocks[i].type === "list_item" && blocks[i].listId === listId) {
          const item = blocks[i];
          const content = renderTextRuns(item.textRuns);
          items.push(`<li>${content || "&nbsp;"}</li>`);
          i += 1;
        }

        parts.push(`<${tag}>${items.join("")}</${tag}>`);
        break;
      }

      case "table": {
        if (block.tableData) {
          const rows = block.tableData.cells.map((row) => {
            const cells = row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("");
            return `<tr>${cells}</tr>`;
          }).join("");
          parts.push(`<table><tbody>${rows}</tbody></table>`);
        } else {
          parts.push(`<p><em>${escapeHtml(block.plainText)}</em></p>`);
        }
        i += 1;
        break;
      }

      case "image": {
        if (block.imageUri) {
          const alt = block.imageAlt ? escapeHtml(block.imageAlt) : "Document image";
          parts.push(`<img src="${escapeHtml(block.imageUri)}" alt="${alt}" />`);
        }
        i += 1;
        break;
      }

      case "unsupported": {
        /** Render unsupported content with visible label for accessibility. */
        parts.push(`<p class="aksa-unsupported-block"><em>${escapeHtml(block.plainText)}</em></p>`);
        i += 1;
        break;
      }

      default:
        i += 1;
        break;
    }
  }

  return parts.join("");
}

/**
 * Compute a plain text representation from blocks (for diffing and accessibility).
 */
export function blocksToPlainText(blocks: AksaBlock[]): string {
  return blocks.map((block) => block.plainText).filter(Boolean).join("\n");
}

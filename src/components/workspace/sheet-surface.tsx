"use client";

import { useState } from "react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { SheetRange } from "@/lib/contracts/google";
import { formatCount } from "@/lib/i18n/copy";
import { StatusChip } from "@/components/workspace/status-chip";

/**
 * Aksa sheet work surface.
 *
 * A native semantic table with real row and column headers, so every cell is
 * reachable and announced by keyboard. Values are read only until a write is
 * reviewed, and truncation is stated rather than hidden.
 */
export function SheetSurface({
  range,
  locale,
  onReviewWrite
}: {
  range: SheetRange;
  locale: Locale;
  onReviewWrite?: (a1Range: string) => void;
}) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const options = { locale };
  const canWrite = range.canEdit && onReviewWrite !== undefined;

  return (
    <div className="aksa-sheet">
      <div className="aksa-document__meta">
        <StatusChip
          label={m.sheets_title_label({}, options)}
          tone="info"
          value={range.spreadsheetTitle}
        />
        <StatusChip label={m.sheets_range_label({}, options)} tone="info" value={range.a1Range} />
        {range.canEdit ? null : (
          <StatusChip tone="neutral" value={m.sheets_read_only({}, options)} />
        )}
      </div>

      {range.sheets.length > 1 ? (
        <div className="aksa-field">
          <label className="aksa-label" htmlFor="sheet-tab">
            {m.sheets_tab_label({}, options)}
          </label>
          <select className="aksa-select" defaultValue={range.activeSheetId} id="sheet-tab">
            {range.sheets.map((sheet) => (
              <option key={sheet.sheetId} value={sheet.sheetId}>
                {sheet.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <p className="aksa-hint">
        {m.sheets_range_limit(
          {
            rows: formatCount(range.rowLimit, locale),
            columns: formatCount(range.columnLimit, locale)
          },
          options
        )}
      </p>

      {range.truncated ? (
        <p className="aksa-inline-note">{m.sheets_truncated({}, options)}</p>
      ) : null}

      <div className="aksa-table-scroll">
        <table className="aksa-table aksa-table--grid">
          <caption className="sr-only">{m.sheets_table_label({}, options)}</caption>
          <thead>
            <tr>
              <th scope="col">{m.sheets_row_header({}, options)}</th>
              {range.columnHeaders.map((header) => (
                <th key={header} scope="col">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {range.formattedValues.map((row, rowIndex) => (
              <tr key={range.rowHeaders[rowIndex] ?? rowIndex}>
                <th className="aksa-table__row-header" scope="row">
                  {range.rowHeaders[rowIndex] ?? rowIndex + 1}
                </th>
                {row.map((value, columnIndex) => {
                  const cell = `${range.columnHeaders[columnIndex] ?? columnIndex + 1}${
                    range.rowHeaders[rowIndex] ?? rowIndex + 1
                  }`;

                  return (
                    <td data-selected={selectedCell === cell || undefined} key={cell}>
                      <button
                        aria-pressed={selectedCell === cell}
                        className="aksa-cell-button"
                        onClick={() => setSelectedCell(cell)}
                        type="button"
                      >
                        <span className="sr-only">{cell}</span>
                        <span aria-hidden={value === "" ? "true" : undefined}>{value}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell !== null ? (
        <p className="aksa-inline-note" role="status">
          {m.sheets_selected_cell({ cell: selectedCell }, options)}
        </p>
      ) : null}

      <button
        className="aksa-button aksa-button--primary"
        disabled={!canWrite}
        onClick={() => onReviewWrite?.(range.a1Range)}
        type="button"
      >
        {m.documents_review_edit({}, options)}
      </button>

      <p className="aksa-hint">{m.sheets_write_note({}, options)}</p>
    </div>
  );
}

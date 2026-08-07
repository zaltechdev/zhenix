"use client";

import { useState } from "react";
import { Folder, FolderPlus, MoveRight, PencilLine, Search } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { DriveItem, DriveListing, DrivePickerCapability } from "@/lib/contracts/google";
import { capabilityCopy, formatDateTime } from "@/lib/i18n/copy";
import { StatusChip } from "@/components/workspace/status-chip";

/**
 * Aksa files work surface.
 *
 * Selection uses activation, never dragging, because head control cannot drag. Every
 * write is a review request rather than an immediate change, and listings are paged
 * rather than fetched without a bound.
 */
export function FilesSearchForm({
  locale,
  defaultQuery
}: {
  locale: Locale;
  defaultQuery?: string;
}) {
  const options = { locale };

  return (
    <form action="/workspace/files" className="aksa-search-form" method="get">
      <div className="aksa-field">
        <label className="aksa-label" htmlFor="files-query">
          {m.files_search_label({}, options)}
        </label>
        <input
          className="aksa-input"
          defaultValue={defaultQuery}
          id="files-query"
          name="q"
          placeholder={m.files_search_placeholder({}, options)}
          type="search"
        />
      </div>
      <button className="aksa-button aksa-button--primary" type="submit">
        <Search aria-hidden="true" className="aksa-icon" />
        <span>{m.files_search_submit({}, options)}</span>
      </button>
    </form>
  );
}

export function FilesSurface({
  listing,
  picker,
  locale,
  onReviewWrite
}: {
  listing: DriveListing;
  picker: DrivePickerCapability;
  locale: Locale;
  onReviewWrite?: (action: "rename" | "move" | "create_folder", item: DriveItem | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = listing.items.find((item) => item.id === selectedId) ?? null;
  const options = { locale };
  const canWrite = onReviewWrite !== undefined;

  return (
    <div className="aksa-files">
      {listing.incompleteSearch ? (
        <p className="aksa-inline-note">{m.files_incomplete_search({}, options)}</p>
      ) : null}

      <div className="aksa-table-scroll">
        <table className="aksa-table">
          <caption className="sr-only">{m.files_list_label({}, options)}</caption>
          <thead>
            <tr>
              <th scope="col">{m.files_column_name({}, options)}</th>
              <th scope="col">{m.files_column_type({}, options)}</th>
              <th scope="col">{m.files_column_modified({}, options)}</th>
              <th scope="col">{m.files_column_location({}, options)}</th>
              <th scope="col">{m.files_open({}, options)}</th>
            </tr>
          </thead>
          <tbody>
            {listing.items.map((item) => (
              <tr data-selected={item.id === selectedId || undefined} key={item.id}>
                <th className="aksa-table__row-header" scope="row">
                  <span className="aksa-files__name">
                    {item.category === "folder" ? (
                      <Folder aria-hidden="true" className="aksa-icon aksa-icon--sm" />
                    ) : null}
                    {item.name}
                  </span>
                </th>
                <td>{item.mimeType}</td>
                <td>{item.modifiedAt === null ? "" : formatDateTime(item.modifiedAt, locale)}</td>
                <td>{item.parentName ?? ""}</td>
                <td>
                  <button
                    aria-pressed={item.id === selectedId}
                    className="aksa-button aksa-button--quiet"
                    onClick={() => setSelectedId(item.id)}
                    type="button"
                  >
                    {m.files_open({}, options)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected !== null ? (
        <p className="aksa-inline-note">
          <StatusChip
            label={m.files_selection_label({}, options)}
            tone="info"
            value={selected.name}
          />
        </p>
      ) : null}

      <div className="aksa-files__actions">
        <button
          className="aksa-button aksa-button--secondary"
          disabled={!canWrite || selected === null || !selected.canRename}
          onClick={() => onReviewWrite?.("rename", selected)}
          type="button"
        >
          <PencilLine aria-hidden="true" className="aksa-icon" />
          <span>{m.files_rename({}, options)}</span>
        </button>
        <button
          className="aksa-button aksa-button--secondary"
          disabled={!canWrite || selected === null || !selected.canMove}
          onClick={() => onReviewWrite?.("move", selected)}
          type="button"
        >
          <MoveRight aria-hidden="true" className="aksa-icon" />
          <span>{m.files_move({}, options)}</span>
        </button>
        <button
          className="aksa-button aksa-button--secondary"
          disabled={!canWrite}
          onClick={() => onReviewWrite?.("create_folder", null)}
          type="button"
        >
          <FolderPlus aria-hidden="true" className="aksa-icon" />
          <span>{m.files_create_folder({}, options)}</span>
        </button>
      </div>

      <div className="aksa-files__picker">
        <button className="aksa-button aksa-button--quiet" disabled={!picker.available} type="button">
          {m.files_choose_from_drive({}, options)}
        </button>
        {picker.available ? null : (
          <p className="aksa-hint">
            {m.files_picker_unavailable({}, options)}
            <span className="sr-only">{capabilityCopy(picker.requiredCapability, locale)}</span>
          </p>
        )}
      </div>

      {listing.nextPageToken !== null ? (
        <button className="aksa-button aksa-button--quiet" type="button">
          {m.files_load_more({}, options)}
        </button>
      ) : null}

      <p className="aksa-hint">{m.files_write_note({}, options)}</p>
    </div>
  );
}

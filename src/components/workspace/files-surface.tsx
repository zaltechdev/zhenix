"use client";

import Link from "next/link";
import { Folder, Search } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import type { DriveListing } from "@/lib/contracts/google";
import { formatDateTime } from "@/lib/i18n/copy";

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
  locale
}: {
  listing: DriveListing;
  locale: Locale;
}) {
  const options = { locale };

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
              <tr key={item.id}>
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
                  <a
                    className="aksa-button aksa-button--quiet"
                    href={`/api/google/drive/${encodeURIComponent(item.id)}/open`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {m.files_open({}, options)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {listing.nextPageToken !== null ? (
        <Link
          className="aksa-button aksa-button--quiet"
          href={`/workspace/files?${new URLSearchParams({
            ...(listing.query ? { q: listing.query } : {}),
            pageToken: listing.nextPageToken
          }).toString()}` as never}
        >
          {m.files_load_more({}, options)}
        </Link>
      ) : null}
    </div>
  );
}

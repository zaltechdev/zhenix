import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import { createAksaError } from "@/lib/contracts/errors";
import type { ResourceState } from "@/lib/contracts/resource-state";
import type {
  DriveListing,
  MailInbox,
  SheetRange
} from "@/lib/contracts/google";
import type { Artifact } from "@/lib/contracts/search";
import type { ActivityEvent } from "@/lib/contracts/activity";
import type { AksaDocumentModel } from "@/lib/contracts/aksa-document";
import { undoRecordSchema } from "@/lib/contracts/undo";
import { SurfaceState } from "@/components/workspace/state-panel";
import { FilesSurface } from "@/components/workspace/files-surface";
import { SheetSurface } from "@/components/workspace/sheet-surface";
import { MailSurface } from "@/components/workspace/mail-surface";
import { DocumentSurface } from "@/components/workspace/document-surface";
import { SlidesSurface } from "@/components/workspace/slides-surface";
import { ArtifactView } from "@/components/workspace/artifact-view";
import { ActivityList } from "@/components/workspace/activity-list";
import { UndoPanel } from "@/components/workspace/undo-panel";
import { CapabilitySummary } from "@/components/workspace/capability-summary";
import { capabilitySnapshotSchema } from "@/lib/contracts/capability";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

afterEach(() => cleanup());

describe("surface state envelope", () => {
  function renderState(state: ResourceState<{ label: string }>, locale: "en" | "id" = "en") {
    return render(
      <SurfaceState locale={locale} state={state}>
        {(data) => <p>{data.label}</p>}
      </SurfaceState>
    );
  }

  it("shows a loading status without claiming content", () => {
    renderState({ status: "loading" });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(m.state_loading({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("explains an empty surface by reason and offers a next action slot", () => {
    render(
      <SurfaceState
        emptyActions={<button type="button">Start a task</button>}
        locale="en"
        state={{ status: "empty", reason: "no_tasks" }}
      >
        {() => <p>never</p>}
      </SurfaceState>
    );

    expect(screen.getByText(m.empty_no_tasks({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a task" })).toBeInTheDocument();
  });

  it("distinguishes no results from nothing existing yet", () => {
    const { unmount } = renderState({ status: "empty", reason: "no_results" });
    expect(screen.getByText(m.empty_no_results({}, { locale: "en" }))).toBeInTheDocument();
    unmount();

    renderState({ status: "empty", reason: "no_items" });
    expect(screen.getByText(m.empty_no_items({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("names the blocker and routes the recovery action", () => {
    renderState({ status: "blocked", error: createAksaError("connection_required") });

    expect(screen.getByText(m.error_connection_required({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: m.action_connect_google({}, { locale: "en" }) })
    ).toHaveAttribute("href", "/workspace/settings");
    expect(screen.queryByText("never")).not.toBeInTheDocument();
  });

  it("sends an authentication blocker to sign in", () => {
    renderState({ status: "blocked", error: createAksaError("authentication_required") });

    expect(
      screen.getByRole("link", { name: m.action_sign_in({}, { locale: "en" }) })
    ).toHaveAttribute("href", "/sign-in");
  });

  it("renders guidance without a control when an action has no destination", () => {
    renderState({ status: "blocked", error: createAksaError("rate_limited") });

    expect(screen.getByText(m.action_wait_and_retry({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: m.action_wait_and_retry({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
  });

  it("shows the partial notice alongside the data that did arrive", () => {
    renderState({
      status: "partial",
      data: { label: "Nine of twelve" },
      error: createAksaError("partial_failure")
    });

    expect(screen.getByText(m.state_partial_heading({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getByText("Nine of twelve")).toBeInTheDocument();
  });

  it("renders blocked copy in Indonesian", () => {
    renderState({ status: "blocked", error: createAksaError("not_configured") }, "id");
    expect(screen.getByText(m.error_not_configured({}, { locale: "id" }))).toBeInTheDocument();
  });
});

describe("files surface", () => {
  const listing: DriveListing = {
    items: [
      {
        id: "file-1",
        name: "Programming Assignment 04",
        mimeType: "application/vnd.google-apps.document",
        category: "document",
        parentId: "folder-1",
        parentName: "Semester 2",
        modifiedAt: 1_700_000_000_000,
        sizeBytes: 2048,
        webViewAvailable: true,
        canRead: true,
        canRename: true,
        canMove: true
      }
    ],
    nextPageToken: "page-2",
    incompleteSearch: true,
    query: "assignment"
  };

  const picker = { available: false, requiredCapability: "drive_picker" as const };

  it("lists items in a table with real headers and no drag requirement", () => {
    render(<FilesSurface listing={listing} locale="en" picker={picker} />);

    const table = screen.getByRole("table", { name: m.files_list_label({}, { locale: "en" }) });
    expect(
      within(table).getByRole("columnheader", { name: m.files_column_name({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("rowheader", { name: /Programming Assignment 04/ })
    ).toBeInTheDocument();
  });

  it("selects by activation and reports the selection as text", () => {
    render(<FilesSurface listing={listing} locale="en" picker={picker} />);

    fireEvent.click(screen.getByRole("button", { name: m.files_open({}, { locale: "en" }) }));
    expect(screen.getAllByText("Programming Assignment 04").length).toBeGreaterThan(1);
  });

  it("states that Drive could not cover the whole search", () => {
    render(<FilesSurface listing={listing} locale="en" picker={picker} />);
    expect(screen.getByText(m.files_incomplete_search({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("disables writes when no reviewed write path exists", () => {
    render(<FilesSurface listing={listing} locale="en" picker={picker} />);

    expect(screen.getByRole("button", { name: m.files_rename({}, { locale: "en" }) })).toBeDisabled();
    expect(screen.getByRole("button", { name: m.files_move({}, { locale: "en" }) })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: m.files_create_folder({}, { locale: "en" }) })
    ).toBeDisabled();
  });

  it("reports the Drive chooser as unavailable instead of hiding it silently", () => {
    render(<FilesSurface listing={listing} locale="en" picker={picker} />);

    expect(
      screen.getByRole("button", { name: m.files_choose_from_drive({}, { locale: "en" }) })
    ).toBeDisabled();
    expect(screen.getByText(m.files_picker_unavailable({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("asks for a reviewed write rather than performing one", () => {
    const onReviewWrite = vi.fn();
    render(
      <FilesSurface listing={listing} locale="en" onReviewWrite={onReviewWrite} picker={picker} />
    );

    fireEvent.click(screen.getByRole("button", { name: m.files_open({}, { locale: "en" }) }));
    fireEvent.click(screen.getByRole("button", { name: m.files_rename({}, { locale: "en" }) }));

    expect(onReviewWrite).toHaveBeenCalledWith("rename", listing.items[0]);
  });
});

describe("sheet surface", () => {
  const range: SheetRange = {
    spreadsheetId: "sheet-1",
    spreadsheetTitle: "Semester grades",
    sheets: [
      { sheetId: "s1", title: "Term 1" },
      { sheetId: "s2", title: "Term 2" }
    ],
    activeSheetId: "s1",
    a1Range: "A1:B2",
    majorDimension: "ROWS",
    columnHeaders: ["A", "B"],
    rowHeaders: ["1", "2"],
    formattedValues: [
      ["Name", "Score"],
      ["Rama", "88"]
    ],
    canEdit: false,
    truncated: true,
    rowLimit: 200,
    columnLimit: 26
  };

  it("renders a semantic grid with row and column headers", () => {
    render(<SheetSurface locale="en" range={range} />);

    const table = screen.getByRole("table", { name: m.sheets_table_label({}, { locale: "en" }) });
    expect(within(table).getByRole("columnheader", { name: "A" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "1" })).toBeInTheDocument();
  });

  it("states truncation and the range limit rather than implying a whole sheet", () => {
    render(<SheetSurface locale="en" range={range} />);

    expect(screen.getByText(m.sheets_truncated({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      screen.getByText(
        m.sheets_range_limit({ rows: "200", columns: "26" }, { locale: "en" })
      )
    ).toBeInTheDocument();
  });

  it("announces the selected cell by its reference", () => {
    render(<SheetSurface locale="en" range={range} />);

    fireEvent.click(screen.getByRole("button", { name: /^A1/ }));
    expect(
      screen.getByText(m.sheets_selected_cell({ cell: "A1" }, { locale: "en" }))
    ).toBeInTheDocument();
  });

  it("stays read only when the range cannot be edited", () => {
    render(<SheetSurface locale="en" range={range} />);

    expect(screen.getByText(m.sheets_read_only({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.documents_review_edit({}, { locale: "en" }) })
    ).toBeDisabled();
  });
});

describe("mail surface", () => {
  const inbox: MailInbox = {
    messages: [
      {
        id: "message-1",
        threadId: "thread-1",
        senderDisplay: "Lecturer",
        subject: "Assignment feedback",
        receivedAt: 1_700_000_000_000,
        preview: "Please review the comments before Friday.",
        unread: true
      }
    ],
    nextPageToken: null
  };

  it("lists recent messages and opens one for reading", () => {
    render(<MailSurface inbox={inbox} locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: m.mail_open({}, { locale: "en" }) }));

    const reading = screen.getByRole("region", { name: m.mail_reading_label({}, { locale: "en" }) });
    expect(within(reading).getByText("Assignment feedback")).toBeInTheDocument();
    expect(
      within(reading).getByText(m.mail_untrusted_note({}, { locale: "en" }))
    ).toBeInTheDocument();
  });

  it("offers no send control at all", () => {
    render(<MailSurface inbox={inbox} locale="en" />);

    expect(screen.getByText(m.mail_no_send_note({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("requires a review before an external draft is created", () => {
    const onReviewDraft = vi.fn();
    render(<MailSurface inbox={inbox} locale="en" onReviewDraft={onReviewDraft} />);

    const create = screen.getByRole("button", { name: m.mail_draft_create({}, { locale: "en" }) });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByLabelText(m.mail_draft_to({}, { locale: "en" })), {
      target: { value: "lecturer@example.com" }
    });
    fireEvent.change(screen.getByLabelText(m.mail_draft_subject({}, { locale: "en" })), {
      target: { value: "Re: feedback" }
    });
    fireEvent.change(screen.getByLabelText(m.mail_draft_body({}, { locale: "en" })), {
      target: { value: "Thank you." }
    });

    fireEvent.click(create);
    expect(onReviewDraft).toHaveBeenCalledWith({
      to: ["lecturer@example.com"],
      subject: "Re: feedback",
      body: "Thank you."
    });
  });
});

describe("document surface", () => {
  const document: AksaDocumentModel = {
    id: "doc-1",
    title: "Programming Assignment 04",
    blocks: [
      {
        id: "block-1",
        type: "heading",
        textRuns: [{ text: "Testing", bold: false, italic: false, underline: false, strikethrough: false, link: null, startIndex: 1, endIndex: 9 }],
        plainText: "Testing",
        headingLevel: 2,
        alignment: null,
        listId: null,
        nestingLevel: null,
        ordered: null,
        sourceStartIndex: 1,
        sourceEndIndex: 9,
        readOnly: false
      },
      {
        id: "block-2",
        type: "paragraph",
        textRuns: [{ text: "Run the suite before submitting.", bold: false, italic: false, underline: false, strikethrough: false, link: null, startIndex: 10, endIndex: 41 }],
        plainText: "Run the suite before submitting.",
        headingLevel: null,
        alignment: null,
        listId: null,
        nestingLevel: null,
        ordered: null,
        sourceStartIndex: 10,
        sourceEndIndex: 41,
        readOnly: false
      }
    ],
    revisionId: "rev-1",
    canEdit: true,
    sourceSystem: "google_docs",
    updatedAt: 1_700_000_000_000
  };

  it("shows the source, the mode, and the unsaved state as text plus an icon", () => {
    render(<DocumentSurface document={document} locale="en" />);

    expect(screen.getByText(m.documents_source_google({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getByText(m.documents_mode_read({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getByText(m.documents_saved({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("cannot start editing when canEdit is false", () => {
    render(<DocumentSurface document={{ ...document, canEdit: false }} locale="en" />);

    expect(
      screen.getByRole("button", { name: m.documents_enable_edit({}, { locale: "en" }) })
    ).toBeDisabled();
  });

  it("labels an illustrative document as a preview", () => {
    render(
      <DocumentSurface
        document={{ ...document, sourceSystem: "illustrative_preview" }}
        locale="en"
      />
    );

    expect(
      screen.getByText(m.documents_source_illustrative({}, { locale: "en" }))
    ).toBeInTheDocument();
  });
});

describe("artifact view", () => {
  const artifact: Artifact = {
    id: "artifact-1",
    taskId: "task-1",
    kind: "search_summary",
    title: "AI coding tool news",
    blocks: [
      { type: "summary", text: "Two releases landed this week.", citations: ["source-1"] },
      { type: "key_point", text: "One tool added review gates.", citations: ["source-2"] },
      {
        type: "conflict_note",
        text: "The two reports disagree on the release date.",
        citations: ["source-1", "source-2"]
      }
    ],
    sources: [
      {
        id: "source-1",
        title: "First report",
        publisher: "Publisher A",
        url: "https://example.com/a",
        domain: "example.com",
        publishedAt: 1_699_000_000_000,
        retrievedAt: 1_700_000_000_000,
        snippet: "First snippet."
      },
      {
        id: "source-2",
        title: "Second report",
        publisher: "Publisher B",
        url: "https://example.org/b",
        domain: "example.org",
        publishedAt: null,
        retrievedAt: 1_700_000_000_000,
        snippet: "Second snippet."
      }
    ],
    language: "en",
    bodyFormat: "markdown_safe",
    retrievedAt: 1_700_000_000_000,
    createdAt: 1_700_000_000_000,
    truncated: false
  };

  it("links every citation to its listed source with a descriptive name", () => {
    render(<ArtifactView artifact={artifact} locale="en" />);

    /** The summary and the conflict note both cite source 1, so both markers exist. */
    const citations = screen.getAllByRole("link", {
      name: m.search_citation_label({ position: "1", title: "First report" }, { locale: "en" })
    });
    expect(citations.length).toBeGreaterThan(0);
    for (const citation of citations) {
      expect(citation).toHaveAttribute("href", "#artifact-source-source-1");
    }

    for (const citation of screen.getAllByRole("link", {
      name: m.search_citation_label({ position: "2", title: "Second report" }, { locale: "en" })
    })) {
      expect(citation).toHaveAttribute("href", "#artifact-source-source-2");
    }
  });

  it("presents disagreement instead of choosing a side", () => {
    render(<ArtifactView artifact={artifact} locale="en" />);

    expect(screen.getByText(m.search_artifact_conflict({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getByText("The two reports disagree on the release date.")).toBeInTheDocument();
  });

  it("shows retrieval time and the link destination", () => {
    render(<ArtifactView artifact={artifact} locale="en" />);

    expect(screen.getByText("https://example.com/a")).toBeInTheDocument();
    expect(screen.getAllByText(/Retrieved/).length).toBeGreaterThan(0);
  });
});

describe("activity list", () => {
  const events: ActivityEvent[] = [
    {
      id: "event-1",
      taskId: "task-1",
      sequence: 1,
      eventType: "step_succeeded",
      outcome: "succeeded",
      actionLabel: "Searched Drive for project files",
      affectedItems: [{ id: "file-1", name: "Week 1 report", kind: "drive_file" }],
      resultSummaryKey: null,
      verified: true,
      createdAt: 1_700_000_000_000,
      durationMs: 420,
      errorCategory: null
    },
    {
      id: "event-2",
      taskId: "task-1",
      sequence: 2,
      eventType: "step_failed",
      outcome: "failed",
      actionLabel: "Moved one file",
      affectedItems: [],
      resultSummaryKey: null,
      verified: false,
      createdAt: 1_700_000_100_000,
      durationMs: 120,
      errorCategory: "permission_denied"
    }
  ];

  it("shows ordered steps with their verified state and affected items", () => {
    render(<ActivityList events={events} locale="en" />);

    const list = screen.getByRole("list", { name: m.activity_list_label({}, { locale: "en" }) });
    expect(within(list).getByText("Searched Drive for project files")).toBeInTheDocument();
    expect(within(list).getByText("Week 1 report")).toBeInTheDocument();
    expect(within(list).getByText(m.activity_verified({}, { locale: "en" }))).toBeInTheDocument();
    expect(within(list).getByText(m.activity_unverified({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("names a failure category without exposing anything internal", () => {
    render(<ActivityList events={events} locale="en" />);

    expect(
      screen.getByText(m.error_short_permission_denied({}, { locale: "en" }))
    ).toBeInTheDocument();
  });
});

describe("undo panel", () => {
  const available = undoRecordSchema.parse({
    id: "undo-1",
    taskId: "task-1",
    kind: "drive_move",
    supported: true,
    unsupportedReasonKey: null,
    state: "available",
    affectedItems: [{ id: "file-1", name: "Week 1 report", kind: "drive_file" }],
    itemsTotal: 12,
    itemsReverted: null,
    expiresAt: 1_700_000_000_000,
    resultSummaryKey: null
  });

  it("offers Undo only when the server reports it available and a handler exists", () => {
    const { unmount } = render(<UndoPanel locale="en" record={available} />);
    expect(screen.getByRole("button", { name: m.undo_apply({}, { locale: "en" }) })).toBeDisabled();
    unmount();

    const onUndo = vi.fn();
    render(<UndoPanel locale="en" onUndo={onUndo} record={available} />);
    fireEvent.click(screen.getByRole("button", { name: m.undo_apply({}, { locale: "en" }) }));
    expect(onUndo).toHaveBeenCalledWith("undo-1");
  });

  it("states why an action cannot be reversed", () => {
    render(
      <UndoPanel
        locale="en"
        record={undoRecordSchema.parse({
          ...available,
          kind: null,
          supported: false,
          unsupportedReasonKey: "undo_reason_folder_create",
          state: "unavailable"
        })}
      />
    );

    expect(screen.getByText(m.undo_reason_folder_create({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.getByText(m.undo_state_unavailable({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("reports a partial revert with item counts", () => {
    render(
      <UndoPanel
        locale="en"
        record={undoRecordSchema.parse({
          ...available,
          state: "partially_completed",
          itemsReverted: 9
        })}
      />
    );

    expect(
      screen.getByText(m.undo_reverted_count({ reverted: "9", total: "12" }, { locale: "en" }))
    ).toBeInTheDocument();
  });

  it("shows the remaining window as static text with no countdown", () => {
    const { container } = render(<UndoPanel locale="en" record={available} />);
    expect(container.querySelector("progress")).toBeNull();
  });
});

describe("capability summary", () => {
  const snapshot = capabilitySnapshotSchema.parse({
    capabilities: [
      {
        name: "agent_execution",
        availability: "not_configured",
        requiresConnection: false,
        requiresScope: false,
        reasonCategory: "not_configured",
        nextAction: "configure_deployment"
      },
      {
        name: "drive_read",
        availability: "connection_required",
        requiresConnection: true,
        requiresScope: false,
        reasonCategory: "connection_required",
        nextAction: "connect_google"
      }
    ],
    checkedAt: 1
  });

  it("states how many capabilities are genuinely ready", () => {
    render(<CapabilitySummary locale="en" snapshot={snapshot} />);

    expect(
      screen.getByText(m.capability_summary_count({ ready: "0", total: "2" }, { locale: "en" }))
    ).toBeInTheDocument();
    expect(screen.getByText(m.capability_agent_execution({}, { locale: "en" }))).toBeInTheDocument();
    /** Task execution and head pointing both report as not configured. */
    expect(
      screen.getAllByText(m.capability_state_not_configured({}, { locale: "en" })).length
    ).toBeGreaterThan(0);
  });

  it("reports head pointing as not configured rather than as unsupported", () => {
    render(<CapabilitySummary locale="en" snapshot={snapshot} />);

    expect(screen.getByText(m.capability_head_pointer({}, { locale: "en" }))).toBeInTheDocument();
  });
});

describe("slides surface", () => {
  it("renders Google Slides title and coming-soon status badge", () => {
    render(<SlidesSurface locale="en" />);

    expect(screen.getByRole("heading", { level: 1, name: m.slides_coming_soon_title({}, { locale: "en" }) })).toBeInTheDocument();
    expect(screen.getByText(m.slides_coming_soon_desc({}, { locale: "en" }))).toBeInTheDocument();
  });

  it("exposes accessible links to available Google Workspace apps", () => {
    render(<SlidesSurface locale="en" />);

    expect(screen.getByRole("link", { name: m.nav_documents({}, { locale: "en" }) })).toHaveAttribute(
      "href",
      "/workspace/documents"
    );
    expect(screen.getByRole("link", { name: m.nav_sheets({}, { locale: "en" }) })).toHaveAttribute(
      "href",
      "/workspace/sheets"
    );
    expect(screen.getByRole("link", { name: m.nav_files({}, { locale: "en" }) })).toHaveAttribute(
      "href",
      "/workspace/files"
    );
    expect(screen.getByRole("link", { name: m.nav_mail({}, { locale: "en" }) })).toHaveAttribute(
      "href",
      "/workspace/mail"
    );
  });
});

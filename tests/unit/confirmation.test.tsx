import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import {
  ILLUSTRATIVE_CONFIRMATION_PREFIX,
  ILLUSTRATIVE_TASK_ID,
  type Confirmation
} from "@/lib/contracts/confirmation";
import { ConfirmationDialog } from "@/components/workspace/confirmation-dialog";
import { ReviewPreview } from "@/components/workspace/review-preview";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

function confirmation(overrides: Partial<Confirmation> = {}): Confirmation {
  return {
    id: "confirmation-1",
    taskId: "task-1",
    action: "drive_move",
    scopeItems: [
      { id: "file-1", name: "Week 1 report", kind: "drive_file" },
      { id: "file-2", name: "Week 2 report", kind: "drive_file" }
    ],
    scopeItemsTotal: 12,
    destinationName: "Semester 2 submissions",
    changesExternalData: true,
    externalSystem: "google_drive",
    undoSupported: true,
    undoUnsupportedReasonKey: null,
    expiresAt: 1_700_000_000_000,
    canApprove: true,
    canEdit: true,
    canCancel: true,
    illustrative: false,
    ...overrides
  };
}

afterEach(() => cleanup());

describe("confirmation dialog", () => {
  it("states the action, the named items, the count, and the destination", () => {
    render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog", {
      name: m.confirmation_heading({}, { locale: "en" })
    });

    expect(
      within(dialog).getByText(m.confirmation_action_drive_move({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Week 1 report")).toBeInTheDocument();
    expect(
      within(dialog).getByText(m.confirmation_scope_count({ count: "12" }, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        m.confirmation_destination({ destination: "Semester 2 submissions" }, { locale: "en" })
      )
    ).toBeInTheDocument();
  });

  it("discloses that external data changes and names the system", () => {
    render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        m.confirmation_consequence_external(
          { system: m.external_system_google_drive({}, { locale: "en" }) },
          { locale: "en" }
        )
      )
    ).toBeInTheDocument();
  });

  it("states whether Undo will exist before the user approves", () => {
    const { unmount } = render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );
    expect(
      screen.getByText(m.confirmation_undo_supported({}, { locale: "en" }))
    ).toBeInTheDocument();
    unmount();

    render(
      <ConfirmationDialog
        confirmation={confirmation({
          action: "drive_create_folder",
          undoSupported: false,
          undoUnsupportedReasonKey: "undo_reason_folder_create"
        })}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );
    expect(
      screen.getByText(m.confirmation_undo_unsupported({}, { locale: "en" }))
    ).toBeInTheDocument();
  });

  it("offers approve, edit, and cancel", () => {
    const onDecision = vi.fn();
    render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={vi.fn()}
        onDecision={onDecision}
      />
    );

    for (const label of [
      m.confirmation_approve({}, { locale: "en" }),
      m.confirmation_edit({}, { locale: "en" }),
      m.confirmation_cancel({}, { locale: "en" })
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }

    fireEvent.click(screen.getByRole("button", { name: m.confirmation_cancel({}, { locale: "en" }) }));
    expect(onDecision).toHaveBeenCalledWith("cancel");
  });

  it("does not place initial focus on the confirming control", async () => {
    const { container } = render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    const approve = screen.getByRole("button", {
      name: m.confirmation_approve({}, { locale: "en" })
    });
    const body = container.querySelector(".aksa-dialog__body");

    await waitFor(() => expect(document.activeElement).toBe(body));
    expect(document.activeElement).not.toBe(approve);
  });

  it("cancels on Escape, which is the safe direction", () => {
    const onClose = vi.fn();
    render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={onClose}
        onDecision={vi.fn()}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("states that holding the pointer cannot approve on its own", () => {
    render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    expect(
      screen.getByText(m.confirmation_deliberate_note({}, { locale: "en" }))
    ).toBeInTheDocument();
  });

  it("hides controls the server did not allow", () => {
    render(
      <ConfirmationDialog
        confirmation={confirmation({ canApprove: false, canEdit: false })}
        locale="en"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: m.confirmation_approve({}, { locale: "en" }) })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: m.confirmation_edit({}, { locale: "en" }) })
    ).toBeDisabled();
  });

  it("renders in Indonesian", () => {
    render(
      <ConfirmationDialog
        confirmation={confirmation()}
        locale="id"
        onClose={vi.fn()}
        onDecision={vi.fn()}
      />
    );

    expect(
      screen.getByRole("dialog", { name: m.confirmation_heading({}, { locale: "id" }) })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.confirmation_approve({}, { locale: "id" }) })
    ).toBeInTheDocument();
  });
});

describe("illustrative review preview", () => {
  it("opens a labelled preview from the trigger", async () => {
    render(<ReviewPreview locale="en" />);

    fireEvent.click(screen.getByRole("button", { name: m.home_review_open({}, { locale: "en" }) }));

    const dialog = await screen.findByRole("dialog", {
      name: m.confirmation_heading({}, { locale: "en" })
    });
    expect(
      within(dialog).getByText(m.confirmation_illustrative_note({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText(m.illustrative_label({}, { locale: "en" })).length).toBeGreaterThan(0);
  });

  it("uses reserved preview identifiers so the server can refuse it", async () => {
    render(<ReviewPreview locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: m.home_review_open({}, { locale: "en" }) }));

    const dialog = await screen.findByRole("dialog", {
      name: m.confirmation_heading({}, { locale: "en" })
    });
    /** Twelve named items, matching the confirmation the real flow would show. */
    expect(within(dialog).getByText(/Week 12 report/)).toBeInTheDocument();
    expect(ILLUSTRATIVE_CONFIRMATION_PREFIX).toBe("illustrative-");
    expect(ILLUSTRATIVE_TASK_ID).toBe("illustrative-preview");
  });

  it("reports an honest unavailable result when the preview is confirmed", async () => {
    render(<ReviewPreview locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: m.home_review_open({}, { locale: "en" }) }));

    const dialog = await screen.findByRole("dialog", {
      name: m.confirmation_heading({}, { locale: "en" })
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: m.confirmation_approve({}, { locale: "en" }) })
    );

    expect(
      await within(dialog).findByText(m.error_not_configured({}, { locale: "en" }))
    ).toBeInTheDocument();
    /** No completed state and no Undo affordance follows a preview approval. */
    expect(
      within(dialog).queryByText(m.task_state_completed({}, { locale: "en" }))
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: m.undo_apply({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
  });

  it("closes on cancel, restores focus to the trigger, and records nothing", async () => {
    render(<ReviewPreview locale="en" />);

    const trigger = screen.getByRole("button", { name: m.home_review_open({}, { locale: "en" }) });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: m.confirmation_heading({}, { locale: "en" })
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: m.confirmation_cancel({}, { locale: "en" }) })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: m.confirmation_heading({}, { locale: "en" }) })
      ).not.toBeInTheDocument();
    });

    expect(document.activeElement).toBe(trigger);
    expect(screen.getByText(m.home_review_cancelled({}, { locale: "en" }))).toBeInTheDocument();
  });
});

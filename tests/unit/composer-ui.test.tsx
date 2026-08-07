import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import { createAksaError } from "@/lib/contracts/errors";
import { CommandProvider } from "@/components/workspace/command-context";
import { CommandComposer } from "@/components/workspace/command-composer";
import { ExampleCommands } from "@/components/workspace/example-commands";
import { PENDING_COMMAND_STORAGE_KEY } from "@/lib/client/state/pending-command";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

function renderComposer(locale: "en" | "id" = "en") {
  return render(
    <CommandProvider>
      <ExampleCommands locale={locale} />
      <CommandComposer locale={locale} />
    </CommandProvider>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => cleanup());

describe("command composer", () => {
  it("starts in the ready state with a labelled, editable field", () => {
    renderComposer();

    expect(screen.queryByText(m.task_state_idle({}, { locale: "en" }))).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.composer_submit({}, { locale: "en" }) })
    ).toBeDisabled();
  });

  it("offers no microphone control when the browser has no speech recognition", () => {
    renderComposer();

    expect(
      screen.queryByRole("button", { name: m.composer_start_listening({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(m.composer_voice_unsupported({}, { locale: "en" }))
    ).toBeInTheDocument();
  });

  it("fills the box from an example without running anything", () => {
    renderComposer();

    const example = m.example_find_project_files({}, { locale: "en" });
    fireEvent.click(screen.getByRole("button", { name: example }));

    expect(screen.getByRole("textbox")).toHaveValue(example);
    expect(screen.queryByText(m.task_state_idle({}, { locale: "en" }))).not.toBeInTheDocument();
    expect(
      screen.queryByText(m.composer_understanding_heading({}, { locale: "en" }))
    ).not.toBeInTheDocument();
  });

  it("picks up a command typed during onboarding and only fills the box", () => {
    window.sessionStorage.setItem(PENDING_COMMAND_STORAGE_KEY, "Open my latest assignment");
    renderComposer();

    expect(screen.getByRole("textbox")).toHaveValue(
      "Open my latest assignment"
    );
    /** Read once and cleared, so a reload does not resurrect it. */
    expect(window.sessionStorage.getItem(PENDING_COMMAND_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(m.task_state_idle({}, { locale: "en" }))).not.toBeInTheDocument();
  });

  it("shows what Aksa received and why it cannot run, without a task state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          outcome: "unavailable",
          understanding: {
            commandId: "command-12345678",
            receivedText: "Move the week 3 report into submissions",
            source: "text",
            locale: "en",
            receivedAt: 1,
            intentResolved: false
          },
          error: createAksaError("not_configured")
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    renderComposer();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Move the week 3 report into submissions" }
    });
    fireEvent.click(screen.getByRole("button", { name: m.composer_submit({}, { locale: "en" }) }));

    await waitFor(() => {
      expect(
        screen.getByText(m.composer_understanding_heading({}, { locale: "en" }))
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Move the week 3 report into submissions", {
        selector: "p.aksa-received-text"
      })
    ).toBeInTheDocument();
    expect(screen.getByText(m.error_not_configured({}, { locale: "en" }))).toBeInTheDocument();
    expect(
      screen.getByText(m.composer_understanding_note({}, { locale: "en" }))
    ).toBeInTheDocument();

    /** No task exists, so no task state is borrowed and no completed state appears. */
    expect(screen.queryByText(m.task_state_idle({}, { locale: "en" }))).not.toBeInTheDocument();
    expect(
      screen.queryByText(m.task_state_completed({}, { locale: "en" }))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: m.composer_cancel_task({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
  });

  it("treats an unexpected response shape as a failure rather than a result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ outcome: "completed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    renderComposer();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Move my files" }
    });
    fireEvent.click(screen.getByRole("button", { name: m.composer_submit({}, { locale: "en" }) }));

    await waitFor(() => {
      expect(screen.getByText(m.error_internal_error({}, { locale: "en" }))).toBeInTheDocument();
    });
    expect(screen.queryByText(m.task_state_idle({}, { locale: "en" }))).not.toBeInTheDocument();
  });

  it("reports a transport failure honestly", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    renderComposer();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Summarize a document" }
    });
    fireEvent.click(screen.getByRole("button", { name: m.composer_submit({}, { locale: "en" }) }));

    await waitFor(() => {
      expect(screen.getByText(m.error_unavailable({}, { locale: "en" }))).toBeInTheDocument();
    });
  });

  it("renders Indonesian composer copy", () => {
    renderComposer("id");

    expect(screen.queryByText(m.task_state_idle({}, { locale: "id" }))).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.composer_submit({}, { locale: "id" }) })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

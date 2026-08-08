import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import { PASSWORD_MIN_LENGTH, type AuthResult } from "@/lib/contracts/auth";
import { createAksaError } from "@/lib/contracts/errors";
import { AuthForm } from "@/components/auth/auth-form";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import type { HeadControlEngineFactory } from "@/lib/client/vision/head-control-context";
import { mapCameraPoseToScreenDelta } from "@/lib/client/vision/pointer-mapping";

vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

beforeEach(() => {
  window.sessionStorage.clear();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
});

afterEach(() => cleanup());

describe("account form", () => {
  it("uses persistent labels and autofill hints without asking for device permission", () => {
    render(
      <AuthForm
        action={async () => ({ outcome: "unavailable", error: createAksaError("not_configured") })}
        locale="en"
        mode="sign_in"
      />
    );

    const email = screen.getByLabelText(m.auth_email_label({}, { locale: "en" }));
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText(m.auth_password_label({}, { locale: "en" }))).toHaveAttribute(
      "autocomplete",
      "current-password"
    );
  });

  it("shows the password requirement before submission, not only after failure", () => {
    render(
      <AuthForm
        action={async () => ({ outcome: "unavailable", error: createAksaError("not_configured") })}
        locale="en"
        mode="sign_up"
      />
    );

    expect(
      screen.getByText(
        m.auth_password_requirement({ min: String(PASSWORD_MIN_LENGTH) }, { locale: "en" })
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText(m.auth_password_label({}, { locale: "en" }))).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
  });

  it("reports the honest boundary state instead of a fake sign in", async () => {
    render(
      <AuthForm
        action={async () => ({ outcome: "unavailable", error: createAksaError("not_configured") })}
        locale="en"
        mode="sign_in"
      />
    );

    fireEvent.change(screen.getByLabelText(m.auth_email_label({}, { locale: "en" })), {
      target: { value: "person@example.com" }
    });
    fireEvent.change(screen.getByLabelText(m.auth_password_label({}, { locale: "en" })), {
      target: { value: "correct horse battery" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: m.auth_submit_sign_in({}, { locale: "en" }) })
    );

    await waitFor(() => {
      expect(screen.getByText(m.error_not_configured({}, { locale: "en" }))).toBeInTheDocument();
    });
  });

  it("moves focus to the error summary and binds field errors to their inputs", async () => {
    const action = async (): Promise<AuthResult> => ({
      outcome: "invalid_input",
      fieldErrors: [
        { field: "email", messageKey: "auth_field_email_invalid" },
        { field: "password", messageKey: "auth_field_password_short" }
      ]
    });

    render(<AuthForm action={action} locale="en" mode="sign_in" />);

    fireEvent.click(
      screen.getByRole("button", { name: m.auth_submit_sign_in({}, { locale: "en" }) })
    );

    const summary = await screen.findByRole("alert");
    await waitFor(() => expect(document.activeElement).toBe(summary));

    expect(summary).toHaveTextContent(m.auth_error_summary_heading({}, { locale: "en" }));

    const email = screen.getByLabelText(m.auth_email_label({}, { locale: "en" }));
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).not.toBeNull();
  });

  it("renders the sign up form in Indonesian", () => {
    render(
      <AuthForm
        action={async () => ({ outcome: "unavailable", error: createAksaError("not_configured") })}
        locale="id"
        mode="sign_up"
      />
    );

    expect(screen.getByLabelText(m.auth_email_label({}, { locale: "id" }))).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.auth_submit_sign_up({}, { locale: "id" }) })
    ).toBeInTheDocument();
  });
});

describe("onboarding", () => {
  function advanceTo(title: string) {
    for (let step = 0; step < 12; step += 1) {
      if (screen.queryByRole("heading", { name: title }) !== null) {
        return;
      }
      const continueBtn = screen.queryByRole("button", { name: m.onboarding_continue({}, { locale: "en" }) });
      if (continueBtn) {
        fireEvent.click(continueBtn);
      } else {
        const nextBtn = screen.queryByRole("button", { name: m.onboarding_next({}, { locale: "en" }) });
        if (nextBtn) fireEvent.click(nextBtn);
      }
    }
  }

  it("starts at the welcome step with a single logo, Choose optional input methods title, and Step 1 of 4", () => {
    render(<OnboardingFlow locale="en" />);

    expect(
      screen.getByRole("heading", { name: m.onboarding_welcome_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(
      screen.getByText(m.onboarding_reassurance_km({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      screen.getByText(m.onboarding_progress({ current: "1", total: "4" }, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.onboarding_continue({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: m.onboarding_back({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
  });

  it("does not create text selection when programmatically focusing headings on phase transition", () => {
    render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));

    const heading = screen.getByRole("heading", { name: m.onboarding_head_explanation_title({}, { locale: "en" }) });
    expect(document.activeElement).toBe(heading);
    expect(window.getSelection()?.toString()).toBe("");
  });

  it("explains the camera before offering the permission control", () => {
    render(<OnboardingFlow locale="en" />);

    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    expect(
      screen.getByText(m.onboarding_head_explanation_desc({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });

  it("mirrors only the visible preview while retaining physical pointer direction", () => {
    const rendered = render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));

    expect(rendered.container.querySelector(".aksa-camera-preview--mirrored video.aksa-camera-preview")).not.toBeNull();
    expect(mapCameraPoseToScreenDelta(-8, 0, 50, 0, 1280, 720).x).toBeGreaterThan(0);
    expect(mapCameraPoseToScreenDelta(8, 0, 50, 0, 1280, 720).x).toBeLessThan(0);
  });

  it("groups calibration in one panel and keeps a single skip action in the footer", () => {
    render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_setup_title({}, { locale: "en" }));

    const card = document.querySelector(".aksa-onboarding-calibration-card");
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent(m.onboarding_calibration_tracking_required({}, { locale: "en" }));
    expect(card).toHaveTextContent(m.onboarding_head_setup_detail({}, { locale: "en" }));
    expect(card?.querySelector("button")).toBe(
      screen.getByRole("button", { name: m.onboarding_calibration_start({}, { locale: "en" }) })
    );
    expect(
      screen.getAllByRole("button", { name: m.onboarding_skip_head({}, { locale: "en" }) })
    ).toHaveLength(1);
  });

  it("reports a refused camera with single primary recovery and no duplicate fallback controls", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          Object.assign(new Error("denied"), { name: "NotAllowedError" })
        )
      }
    });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });

    render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));

    fireEvent.click(
      screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })
    );

    await waitFor(() => {
      expect(
        screen.getByText(m.onboarding_camera_denied({}, { locale: "en" }))
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: m.onboarding_try_camera_again({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: m.onboarding_continue_no_camera({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });

  it("reports a missing camera device rather than a refusal", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          Object.assign(new Error("missing"), { name: "NotFoundError" })
        )
      }
    });
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });

    render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    fireEvent.click(
      screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })
    );

    await waitFor(() => {
      expect(
        screen.getByText(m.onboarding_camera_unavailable({}, { locale: "en" }))
      ).toBeInTheDocument();
    });
  });

  it("does not report operational head control when model startup fails", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop } as unknown as MediaStreamTrack]
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) }
    });
    const engineFactory: HeadControlEngineFactory = () => ({
      initialize: vi.fn().mockResolvedValue(false),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      disable: vi.fn(),
      setNeutralBaseline: vi.fn()
    });

    render(<OnboardingFlow engineFactory={engineFactory} locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    fireEvent.click(
      screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })
    );

    await waitFor(() => {
      expect(
        screen.getByText(m.onboarding_camera_model_failed({}, { locale: "en" }))
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(m.onboarding_head_control_ready({}, { locale: "en" }))
    ).not.toBeInTheDocument();
    expect(stop).toHaveBeenCalled();
  });

  it("stops a camera stream that resolves after the user skips head control", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop } as unknown as MediaStreamTrack]
    } as unknown as MediaStream;
    let resolveStream: (stream: MediaStream) => void = () => undefined;
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => pendingStream) }
    });
    const engineFactory = vi.fn<HeadControlEngineFactory>(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      disable: vi.fn(),
      setNeutralBaseline: vi.fn()
    }));

    render(<OnboardingFlow engineFactory={engineFactory} locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    fireEvent.click(
      screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: m.onboarding_skip_head({}, { locale: "en" })
      }).at(-1)!
    );
    resolveStream(stream);

    await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
    expect(engineFactory).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: m.onboarding_voice_explanation_title({}, { locale: "en" })
      })
    ).toBeInTheDocument();
  });

  it("requires a secure connection before touching the camera", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });

    render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    fireEvent.click(
      screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })
    );

    await waitFor(() => {
      expect(
        screen.getByText(m.onboarding_camera_insecure({}, { locale: "en" }))
      ).toBeInTheDocument();
    });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("offers no microphone control when the browser has no speech recognition", () => {
    render(<OnboardingFlow locale="en" />);

    advanceTo(m.onboarding_voice_explanation_title({}, { locale: "en" }));
    expect(
      screen.getByText(m.onboarding_microphone_unsupported({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: m.onboarding_allow_microphone({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
  });

  it("keeps an editable transcript field even without recognition", () => {
    render(<OnboardingFlow locale="en" />);

    advanceTo(m.onboarding_voice_test_title({}, { locale: "en" }));
    const transcript = screen.getByLabelText(
      m.onboarding_voice_transcript_label({}, { locale: "en" })
    );
    fireEvent.change(transcript, { target: { value: "Open my latest assignment" } });
    expect(transcript).toHaveValue("Open my latest assignment");
  });

  it("keeps the workspace reachable via Finish later action", () => {
    render(<OnboardingFlow locale="en" />);

    expect(
      screen.getByRole("link", { name: m.onboarding_finish_later({}, { locale: "en" }) })
    ).toHaveAttribute("href", "/workspace");
  });

  it("resumes in the same tab at the last step reached", () => {
    const first = render(<OnboardingFlow locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    first.unmount();

    render(<OnboardingFlow locale="en" />);
    expect(
      screen.getByRole("heading", { name: m.onboarding_head_explanation_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });
});

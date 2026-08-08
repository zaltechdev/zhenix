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

  it("keeps the four sidebar labels stable in English and Indonesian", () => {
    const expectedEnglish = [
      m.onboarding_phase_welcome({}, { locale: "en" }),
      `${m.onboarding_phase_head_control({}, { locale: "en" })} · ${m.onboarding_phase_optional({}, { locale: "en" })}`,
      `${m.onboarding_phase_voice({}, { locale: "en" })} · ${m.onboarding_phase_optional({}, { locale: "en" })}`,
      m.onboarding_phase_first_task({}, { locale: "en" })
    ];
    const expectedIndonesian = [
      m.onboarding_phase_welcome({}, { locale: "id" }),
      `${m.onboarding_phase_head_control({}, { locale: "id" })} · ${m.onboarding_phase_optional({}, { locale: "id" })}`,
      `${m.onboarding_phase_voice({}, { locale: "id" })} · ${m.onboarding_phase_optional({}, { locale: "id" })}`,
      m.onboarding_phase_first_task({}, { locale: "id" })
    ];

    const labels = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".aksa-onboarding-rail__label")).map((label) =>
        label.textContent?.replace(/\s+/g, " ").trim()
      );

    render(<OnboardingFlow locale="en" />);
    expect(labels()).toEqual(expectedEnglish);
    cleanup();
    render(<OnboardingFlow locale="id" />);
    expect(labels()).toEqual(expectedIndonesian);
    expect(document.body.textContent).not.toMatch(/Part [12] of 2|Bagian [12] dari 2/);
  });

  it("lets every sidebar phase navigate directly without locking future steps", () => {
    render(<OnboardingFlow locale="en" />);

    const phaseButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".aksa-onboarding-rail__button")
    );
    expect(phaseButtons).toHaveLength(4);
    expect(phaseButtons.every((button) => !button.hasAttribute("disabled"))).toBe(true);

    fireEvent.click(phaseButtons[3]);
    expect(
      screen.getByRole("heading", { name: m.onboarding_first_task_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(phaseButtons[3]).toHaveAttribute("aria-current", "step");
  });

  it("opens Head Control directly without visible Part labels", () => {
    window.sessionStorage.setItem("aksa-onboarding-step", "6");
    render(<OnboardingFlow locale="en" />);

    fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".aksa-onboarding-rail__button")[1]);

    expect(
      screen.getByRole("heading", { name: m.onboarding_head_explanation_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Part [12] of 2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bagian [12] dari 2/)).not.toBeInTheDocument();
  });

  it("skips onboarding phases for input methods deselected on welcome", () => {
    render(<OnboardingFlow locale="en" />);

    fireEvent.click(
      screen.getByRole("heading", { name: m.onboarding_card_head({}, { locale: "en" }) }).closest("button")!
    );
    fireEvent.click(screen.getByRole("button", { name: m.onboarding_continue({}, { locale: "en" }) }));

    expect(
      screen.getByRole("heading", { name: m.onboarding_voice_task_title({}, { locale: "en" }) })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: m.onboarding_skip_voice({}, { locale: "en" }) }));
    expect(
      screen.getByRole("heading", { name: m.onboarding_first_task_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });

  it("keeps the accessibility launcher available during onboarding", () => {
    render(<OnboardingFlow locale="en" />);

    expect(
      screen.getByRole("button", { name: m.accessibility_widget_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
  });

  it("keeps the camera processing video mounted after changing onboarding phase", () => {
    const rendered = render(<OnboardingFlow locale="en" />);
    const controlVideo = rendered.container.querySelector("video.aksa-camera-control-video");

    fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".aksa-onboarding-rail__button")[2]);

    expect(controlVideo).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: m.onboarding_voice_task_title({}, { locale: "en" }) })
    ).toBeInTheDocument();
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

    expect(rendered.container.querySelector("video.aksa-camera-preview--mirrored")).not.toBeNull();
    expect(mapCameraPoseToScreenDelta(-8, 0, 50, 0, 1280, 720).x).toBeGreaterThan(0);
    expect(mapCameraPoseToScreenDelta(8, 0, 50, 0, 1280, 720).x).toBeLessThan(0);
  });

  it("places live calibration guidance inside the active camera preview", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop } as unknown as MediaStreamTrack]
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia }
    });
    const engineFactory: HeadControlEngineFactory = () => ({
      initialize: vi.fn().mockResolvedValue(true),
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      disable: vi.fn(),
      setNeutralBaseline: vi.fn()
    });

    const rendered = render(<OnboardingFlow engineFactory={engineFactory} locale="en" />);
    advanceTo(m.onboarding_head_explanation_title({}, { locale: "en" }));
    fireEvent.click(screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) }));

    await waitFor(() => {
      expect(rendered.container.querySelector(".aksa-camera-preview__calibration")).not.toBeNull();
    });
    const preview = rendered.container.querySelector(".aksa-camera-preview-container");
    expect(preview?.querySelector(".aksa-camera-preview__calibration")).not.toBeNull();
    expect(rendered.container.querySelector(".aksa-onboarding-calibration-card")).toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("keeps camera setup concise with one skip action", () => {
    render(<OnboardingFlow locale="en" />);
    fireEvent.click(document.querySelectorAll<HTMLButtonElement>(".aksa-onboarding-rail__button")[1]);

    const panel = document.querySelector(".aksa-onboarding-panel--head-control");
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveTextContent(m.onboarding_calibration_tracking_required({}, { locale: "en" }));
    expect(panel).not.toHaveTextContent(m.onboarding_head_setup_detail({}, { locale: "en" }));
    expect(screen.getByRole("button", { name: m.onboarding_allow_camera({}, { locale: "en" }) })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: m.onboarding_skip_head({}, { locale: "en" }) })
    ).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: m.onboarding_calibration_start({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
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
        name: m.onboarding_voice_task_title({}, { locale: "en" })
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

    advanceTo(m.onboarding_voice_task_title({}, { locale: "en" }));
    expect(
      screen.getByText(m.onboarding_microphone_unsupported({}, { locale: "en" }))
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: m.onboarding_allow_microphone({}, { locale: "en" }) })
    ).not.toBeInTheDocument();
  });

  it("keeps recognition feedback read-only", () => {
    render(<OnboardingFlow locale="en" />);

    advanceTo(m.onboarding_voice_task_title({}, { locale: "en" }));
    expect(document.querySelector("textarea")).toBeNull();
    expect(screen.queryByLabelText(m.onboarding_voice_transcript_label({}, { locale: "en" }))).toBeNull();
  });

  it("shows the Aksa demo without manual success controls", () => {
    render(<OnboardingFlow locale="en" />);

    advanceTo(m.onboarding_voice_task_title({}, { locale: "en" }));
    fireEvent.click(screen.getByRole("button", { name: m.onboarding_continue_text({}, { locale: "en" }) }));

    expect(screen.getByRole("group", { name: m.onboarding_voice_demo_project({}, { locale: "en" }) })).toBeInTheDocument();
    const includeSources = screen.getByRole("checkbox", {
      name: m.onboarding_voice_demo_include_sources({}, { locale: "en" })
    });
    expect(includeSources).toHaveAttribute("aria-checked", "false");
    fireEvent.click(includeSources);
    expect(includeSources).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(m.onboarding_voice_demo_primary_command({}, { locale: "en" }))).toBeInTheDocument();
    expect(screen.queryByText(m.onboarding_voice_demo_local({}, { locale: "en" }))).not.toBeInTheDocument();
    expect(screen.queryByText(m.onboarding_voice_demo_secondary_command({}, { locale: "en" }))).not.toBeInTheDocument();
    expect(screen.queryByText(m.onboarding_voice_task_success({}, { locale: "en" }))).not.toBeInTheDocument();
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

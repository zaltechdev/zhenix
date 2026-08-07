import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/paraglide/messages.js";
import { PASSWORD_MIN_LENGTH, type AuthResult } from "@/lib/contracts/auth";
import { createAksaError } from "@/lib/contracts/errors";
import { AuthForm } from "@/components/auth/auth-form";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

vi.mock("next/navigation", () => ({
  usePathname: () => "/onboarding",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() })
}));

beforeEach(() => {
  window.sessionStorage.clear();
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

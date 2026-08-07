import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "@/components/shared/button";
import { Divider } from "@/components/shared/divider";
import { FormField } from "@/components/shared/form-field";
import { IconButton } from "@/components/shared/icon-button";
import { TextInput } from "@/components/shared/text-input";

afterEach(() => cleanup());

describe("shared controls", () => {
  it("keeps button geometry while exposing loading state", () => {
    render(
      <Button loading size="lg" variant="primary">
        Save draft
      </Button>
    );

    const button = screen.getByRole("button", { name: "Save draft" });
    expect(button).toHaveClass("aksa-button--lg", "aksa-button--primary");
    expect(button.querySelector(".aksa-button__content")).toHaveTextContent("Save draft");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-loading", "true");
  });

  it("associates descriptions and errors with form controls", () => {
    render(
      <FormField
        controlId="email"
        description="Use your account email."
        error="Enter an email address."
        label="Email"
        required
      >
        <TextInput name="email" type="email" />
      </FormField>
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input.getAttribute("aria-describedby")).toContain("email-description");
    expect(input.getAttribute("aria-describedby")).toContain("email-error");
  });

  it("gives icon controls an accessible name and dividers a semantic role", () => {
    render(
      <>
        <IconButton aria-label="Open settings">+</IconButton>
        <Divider label="or" />
      </>
    );

    expect(screen.getByRole("button", { name: "Open settings" })).toBeInTheDocument();
    expect(screen.getByRole("separator")).toHaveTextContent("or");
  });
});

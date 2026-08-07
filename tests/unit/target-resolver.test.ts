import { describe, expect, it, beforeEach } from "vitest";
import { isEligibleTarget } from "@/lib/client/vision/target-resolver";

describe("Target Resolver Engine", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("identifies interactive button as eligible", () => {
    const btn = document.createElement("button");
    btn.textContent = "Click Me";
    document.body.appendChild(btn);

    expect(isEligibleTarget(btn)).toBe(true);
  });

  it("identifies interactive link with href as eligible", () => {
    const link = document.createElement("a");
    link.href = "/workspace";
    link.textContent = "Workspace";
    document.body.appendChild(link);

    expect(isEligibleTarget(link)).toBe(true);
  });

  it("rejects disabled button", () => {
    const btn = document.createElement("button");
    btn.disabled = true;
    document.body.appendChild(btn);

    expect(isEligibleTarget(btn)).toBe(false);
  });

  it("rejects aria-disabled element", () => {
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    div.setAttribute("aria-disabled", "true");
    document.body.appendChild(div);

    expect(isEligibleTarget(div)).toBe(false);
  });

  it("rejects Aksa pointer overlay elements", () => {
    const pointer = document.createElement("div");
    pointer.className = "aksa-pointer";
    document.body.appendChild(pointer);

    expect(isEligibleTarget(pointer)).toBe(false);
  });

  it("rejects non-interactive body paragraph text", () => {
    const p = document.createElement("p");
    p.textContent = "Just plain body text";
    document.body.appendChild(p);

    expect(isEligibleTarget(p)).toBe(false);
  });
});

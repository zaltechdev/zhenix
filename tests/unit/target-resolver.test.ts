import { describe, expect, it, beforeEach } from "vitest";
import {
  findNearestEligibleTarget,
  getEligibleTargetCandidates,
  isEligibleTarget
} from "@/lib/client/vision/target-resolver";

function setBounds(element: HTMLElement, left: number, top: number, width: number, height: number) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(left, top, width, height)
  });
}

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

  it("rejects generic tabindex containers", () => {
    const container = document.createElement("div");
    container.tabIndex = 0;
    document.body.appendChild(container);

    expect(isEligibleTarget(container)).toBe(false);
  });

  it("finds the nearest visible eligible target by rectangle distance", () => {
    const far = document.createElement("button");
    const near = document.createElement("a");
    near.href = "/workspace";
    setBounds(far, 300, 100, 44, 44);
    setBounds(near, 100, 100, 160, 44);
    document.body.append(far, near);

    expect(findNearestEligibleTarget({ x: 90, y: 120 })?.element).toBe(near);
  });

  it("never returns disabled or hidden controls as target candidates", () => {
    const disabled = document.createElement("button");
    disabled.disabled = true;
    const hidden = document.createElement("button");
    hidden.hidden = true;
    setBounds(disabled, 100, 100, 44, 44);
    setBounds(hidden, 160, 100, 44, 44);
    document.body.append(disabled, hidden);

    expect(getEligibleTargetCandidates({ x: 120, y: 120 })).toEqual([]);
  });
});

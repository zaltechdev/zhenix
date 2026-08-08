import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AksaPointer } from "@/components/workspace/aksa-pointer";
import type { DwellProgress } from "@/lib/client/vision/dwell-controller";

const idleDwell: DwellProgress = {
  state: "idle",
  progressRatio: 0,
  targetElement: null,
  activeTargetBounds: null
};

const dwelling: DwellProgress = {
  state: "dwelling",
  progressRatio: 0.6,
  targetElement: document.createElement("button"),
  activeTargetBounds: new DOMRect(100, 100, 44, 44)
};

function pointerProps() {
  return {
    position: { x: 200, y: 160 },
    lifecycleState: "active" as const,
    dwellProgress: idleDwell,
    hasTarget: false
  };
}

describe("AksaPointer", () => {
  it("renders the supplied official Aksa SVG without accepting pointer events", () => {
    const rendered = render(<AksaPointer {...pointerProps()} />);
    const overlay = rendered.container.querySelector(".aksa-pointer-overlay");
    const logo = rendered.container.querySelector("img");

    expect(overlay).not.toBeNull();
    expect(overlay).toHaveStyle({ pointerEvents: "none" });
    expect(logo).toHaveAttribute("src", expect.stringContaining("data:image/svg+xml"));
    expect(decodeURIComponent(logo?.getAttribute("src") ?? "")).toContain("Cursor-Highlight");
  });

  it("keeps a non-interactive contrast silhouette behind the official cursor", () => {
    const rendered = render(<AksaPointer {...pointerProps()} />);
    const contrast = rendered.container.querySelector(".aksa-pointer-overlay__contrast");

    expect(contrast).toHaveStyle({ pointerEvents: "none" });
    expect(contrast?.querySelector("img")).not.toBeNull();
  });

  it("shows controller dwell progress, including an empty ring at dwell start", () => {
    const rendered = render(
      <AksaPointer {...pointerProps()} dwellProgress={{ ...dwelling, progressRatio: 0 }} hasTarget />
    );
    expect(rendered.container.querySelector(".aksa-pointer-overlay__progress-ring")).not.toBeNull();
    expect(rendered.container.querySelector(".aksa-pointer-overlay__progress-bar")).toHaveStyle({
      strokeDashoffset: "100"
    });

    rendered.rerender(<AksaPointer {...pointerProps()} dwellProgress={dwelling} hasTarget />);
    expect(rendered.container.querySelector(".aksa-pointer-overlay__progress-bar")).toHaveStyle({
      strokeDashoffset: "40"
    });
  });

  it("clears the dwell ring when dwell is cancelled or the target unlocks", () => {
    const rendered = render(<AksaPointer {...pointerProps()} dwellProgress={dwelling} hasTarget />);
    expect(rendered.container.querySelector(".aksa-pointer-overlay__progress-ring")).not.toBeNull();

    rendered.rerender(<AksaPointer {...pointerProps()} dwellProgress={idleDwell} hasTarget={false} />);
    expect(rendered.container.querySelector(".aksa-pointer-overlay__progress-ring")).toBeNull();
  });

  it("exposes restrained target-acquired feedback", () => {
    const rendered = render(<AksaPointer {...pointerProps()} hasTarget />);
    expect(rendered.container.querySelector(".aksa-pointer-overlay")).toHaveClass(
      "aksa-pointer-overlay--target"
    );
  });

  it("plays a pop only when an actual activation key arrives", () => {
    const rendered = render(<AksaPointer {...pointerProps()} activationKey={0} />);
    expect(rendered.container.querySelector(".aksa-pointer-overlay")).not.toHaveClass(
      "aksa-pointer-overlay--activated"
    );

    rendered.rerender(<AksaPointer {...pointerProps()} activationKey={1} />);
    expect(rendered.container.querySelector(".aksa-pointer-overlay")).toHaveClass(
      "aksa-pointer-overlay--activated"
    );
  });

  it("suppresses the pop while retaining static dwell feedback in reduced motion", () => {
    const rendered = render(
      <AksaPointer {...pointerProps()} activationKey={1} dwellProgress={dwelling} hasTarget reducedMotion />
    );
    const overlay = rendered.container.querySelector(".aksa-pointer-overlay");

    expect(overlay).toHaveClass("aksa-pointer-overlay--reduced-motion");
    expect(overlay).not.toHaveClass("aksa-pointer-overlay--activated");
    expect(rendered.container.querySelector(".aksa-pointer-overlay__reduced-progress")).toHaveTextContent("60%");
  });

  it.each(["idle", "initializing", "paused", "disabled", "error"] as const)(
    "hides outside operational tracking state: %s",
    (lifecycleState) => {
      const rendered = render(<AksaPointer {...pointerProps()} lifecycleState={lifecycleState} />);
      expect(rendered.container.querySelector(".aksa-pointer-overlay")).toBeNull();
    }
  );
});

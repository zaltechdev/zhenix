import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VirtualCursorOverlay } from "@/components/workspace/virtual-cursor-overlay";
import type { VirtualCursorState } from "@/lib/client/vision/head-control-controller";

describe("VirtualCursorOverlay Component", () => {
  afterEach(() => {
    cleanup();
  });

  const mockActiveState: VirtualCursorState = {
    x: 200,
    y: 350,
    vx: 0,
    vy: 0,
    isVisible: true,
    isPhysicalMouseActive: false,
    status: "active",
    dwellState: "dwelling",
    dwellProgress: 0.5,
    hoverTarget: null,
    pose: { yaw: 0, pitch: 0, roll: 0, scale: 100 },
    baseline: { yaw: 0, pitch: 0, roll: 0, scale: 100 },
    lastClickTimestamp: null
  };

  it("renders when visible with correct translate3d coordinates", () => {
    render(<VirtualCursorOverlay cursorState={mockActiveState} size={40} />);

    const overlay = screen.getByTestId("virtual-cursor-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.transform).toContain("translate3d(180px, 330px, 0)");
  });

  it("does not render when isVisible is false", () => {
    const hiddenState = { ...mockActiveState, isVisible: false };
    const { container } = render(<VirtualCursorOverlay cursorState={hiddenState} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dwell progress arc when dwelling", () => {
    render(<VirtualCursorOverlay cursorState={mockActiveState} />);
    const progressBar = screen.getByTestId("cursor-progress-bar");
    expect(progressBar).toBeInTheDocument();
  });

  it("renders click ripple effect when click timestamp updates", () => {
    const clickingState = { ...mockActiveState, lastClickTimestamp: 12345 };
    render(<VirtualCursorOverlay cursorState={clickingState} />);
    const ripple = screen.getByTestId("cursor-click-ripple");
    expect(ripple).toBeInTheDocument();
  });
});

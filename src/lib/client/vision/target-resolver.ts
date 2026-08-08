/**
 * DOM target resolution for dwell, gesture, and semantic Target Assist.
 * Only controls that can be activated are eligible. Containers and body text
 * are deliberately excluded even when they happen to be focusable.
 */

import type { Vector2D } from "./pointer-mapping";

export interface TargetResolution {
  element: HTMLElement | null;
  bounds: DOMRect | null;
  isEligible: boolean;
}

export interface TargetRectangle {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TargetCandidate {
  element: HTMLElement;
  bounds: DOMRect;
  distancePx: number;
  /** Stable document order used only after a distance tie. */
  order: number;
}

const INTERACTIVE_TAGS = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "DETAILS", "SUMMARY"]);

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "switch",
  "menuitem",
  "tab",
  "option",
  "combobox",
  "textbox",
  "searchbox"
]);

const ELIGIBLE_TARGET_SELECTOR = [
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "details",
  "summary",
  "[role]",
  "[data-aksa-interactive]"
].join(", ");

/** Calculate Euclidean distance from a point to the nearest part of a rectangle. */
export function distanceToRectangle(point: Vector2D, rect: TargetRectangle): number {
  const horizontal = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const vertical = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(horizontal, vertical);
}

function hasUnavailableAncestor(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.hasAttribute("disabled") ||
      current.matches(":disabled") ||
      current.getAttribute("aria-disabled") === "true" ||
      current.getAttribute("aria-hidden") === "true" ||
      current.hasAttribute("hidden") ||
      current.hasAttribute("inert")
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

function isVisiblyInteractive(element: HTMLElement): boolean {
  if (!element.isConnected) {
    return false;
  }

  if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
  }

  return true;
}

function hasUsableRectangle(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Check whether one DOM element can be selected by Aksa head control. */
export function isEligibleTarget(element: Element | null): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  if (
    element.closest(".aksa-pointer-overlay") !== null ||
    element.closest(".aksa-pointer") !== null ||
    element.closest("[data-aksa-pointer]") !== null
  ) {
    return false;
  }

  if (hasUnavailableAncestor(element) || !isVisiblyInteractive(element)) {
    return false;
  }

  if (element.hasAttribute("data-aksa-interactive")) {
    return true;
  }

  if (element.tagName === "A") {
    return element.hasAttribute("href");
  }

  if (element.tagName === "INPUT" && (element as HTMLInputElement).type === "hidden") {
    return false;
  }

  if (INTERACTIVE_TAGS.has(element.tagName)) {
    return true;
  }

  const role = element.getAttribute("role");
  return role !== null && INTERACTIVE_ROLES.has(role.toLowerCase());
}

/** Return all visible, eligible interactive controls in deterministic DOM order. */
export function getEligibleTargetCandidates(
  pointer: Vector2D,
  scope: ParentNode | null = null
): TargetCandidate[] {
  if (typeof document === "undefined") {
    return [];
  }

  const searchRoot = scope ?? document;
  return Array.from(searchRoot.querySelectorAll(ELIGIBLE_TARGET_SELECTOR)).flatMap((element, order) => {
    if (!isEligibleTarget(element) || !hasUsableRectangle(element as HTMLElement)) {
      return [];
    }

    const target = element as HTMLElement;
    const bounds = target.getBoundingClientRect();
    return [
      {
        element: target,
        bounds,
        distancePx: distanceToRectangle(pointer, bounds),
        order
      }
    ];
  });
}

/**
 * Find the nearest eligible target. Rectangular distance intentionally makes
 * large accessible controls easier to acquire than their centres would.
 */
export function findNearestEligibleTarget(pointer: Vector2D): TargetCandidate | null {
  return (
    getEligibleTargetCandidates(pointer)
      .sort((left, right) =>
        left.distancePx === right.distancePx
          ? left.order - right.order
          : left.distancePx - right.distancePx
      )[0] ?? null
  );
}

/**
 * Resolve a direct hit target for existing pointer consumers. Target Assist
 * uses `getEligibleTargetCandidates` instead so near misses can be assisted.
 */
export function resolveTargetAtPoint(x: number, y: number): TargetResolution {
  if (typeof document === "undefined" || typeof document.elementFromPoint !== "function") {
    return { element: null, bounds: null, isEligible: false };
  }

  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return { element: null, bounds: null, isEligible: false };
  }

  let current: Element | null = document.elementFromPoint(x, y);
  while (current && current !== document.body && current !== document.documentElement) {
    if (isEligibleTarget(current)) {
      const element = current as HTMLElement;
      return { element, bounds: element.getBoundingClientRect(), isEligible: true };
    }
    current = current.parentElement;
  }

  return { element: null, bounds: null, isEligible: false };
}

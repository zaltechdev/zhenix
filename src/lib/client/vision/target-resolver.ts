/**
 * DOM hit testing & eligible target resolution engine.
 * Resolves Aksa pointer screen coordinates to real interactive DOM targets.
 */

export interface TargetResolution {
  element: HTMLElement | null;
  bounds: DOMRect | null;
  isEligible: boolean;
}

const INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "DETAILS", "SUMMARY"]);

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

/**
 * Check if a single DOM element is an eligible interactive target for Aksa pointer selection.
 */
export function isEligibleTarget(element: Element | null): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Exclude Aksa pointer overlay elements
  if (element.closest(".aksa-pointer") !== null || element.closest("[data-aksa-pointer]") !== null) {
    return false;
  }

  // Check disabled and hidden attributes
  if (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("aria-hidden") === "true" ||
    element.hasAttribute("hidden") ||
    element.hasAttribute("inert")
  ) {
    return false;
  }

  // Explicit Aksa interactive marker
  if (element.hasAttribute("data-aksa-interactive")) {
    return true;
  }

  // Interactive HTML tags
  if (INTERACTIVE_TAGS.has(element.tagName)) {
    if (element.tagName === "A" && !element.hasAttribute("href") && !element.hasAttribute("tabindex")) {
      return false;
    }
    return true;
  }

  // ARIA interactive roles
  const role = element.getAttribute("role");
  if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) {
    return true;
  }

  // Focusable elements with valid tabindex
  const tabIndex = element.getAttribute("tabindex");
  if (tabIndex !== null && !isNaN(Number(tabIndex)) && Number(tabIndex) >= 0) {
    return true;
  }

  return false;
}

/**
 * Resolve screen coordinates to the nearest eligible interactive DOM element.
 * Walks up the DOM hierarchy starting from `document.elementFromPoint(x, y)`.
 */
export function resolveTargetAtPoint(x: number, y: number): TargetResolution {
  if (typeof document === "undefined" || typeof document.elementFromPoint !== "function") {
    return { element: null, bounds: null, isEligible: false };
  }

  // Bounds check
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return { element: null, bounds: null, isEligible: false };
  }

  const rawElement = document.elementFromPoint(x, y);
  if (!rawElement) {
    return { element: null, bounds: null, isEligible: false };
  }

  let current: Element | null = rawElement;
  while (current && current !== document.body && current !== document.documentElement) {
    if (isEligibleTarget(current)) {
      const rect = current.getBoundingClientRect();
      return {
        element: current,
        bounds: rect,
        isEligible: true
      };
    }
    current = current.parentElement;
  }

  return { element: null, bounds: null, isEligible: false };
}

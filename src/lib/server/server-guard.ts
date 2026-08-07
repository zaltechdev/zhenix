/**
 * Runtime guard for modules that must never reach the browser bundle.
 *
 * The repository does not depend on the `server-only` package, so this keeps the
 * boundary enforced without adding a dependency. A Client Component that imports
 * a guarded module fails loudly on first evaluation instead of silently shipping
 * server code.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `${moduleName} is server-only. Move the call behind a Route Handler, a Server Action, or a Server Component.`
    );
  }
}

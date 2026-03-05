/**
 * Standalone navigation helper – kept in its own module so that page
 * components can import `navigate` without pulling in `app-shell.ts`
 * (which statically imports `app-nav.ts`), avoiding the circular-dependency
 * that caused `app-nav` to be registered twice as a custom element.
 */
export function navigate(path: string, data?: unknown): void {
  window.dispatchEvent(
    new CustomEvent('navigate', { detail: { path, data } }),
  );
}

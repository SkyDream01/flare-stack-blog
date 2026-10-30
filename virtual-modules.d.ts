// Modules that Vite plugins generate at build and dev time.
declare module "virtual:routed-first-segments" {
  /** Lowercased first path segments the route tree owns; see scripts/vite-routed-segments.ts. */
  export const ROUTED_FIRST_SEGMENTS: readonly string[];
}

import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export const ROUTED_SEGMENTS_MODULE_ID = "virtual:routed-first-segments";
const RESOLVED_ID = `\0${ROUTED_SEGMENTS_MODULE_ID}`;

/**
 * The lowercased first path segments the route tree owns, sorted and deduped,
 * read from the keys of `FileRoutesByFullPath` in the generated route tree.
 * The route tree itself pulls every route module, so it is parsed as text.
 *
 * The root catch-all `/$` is skipped: it is what the probe guard sits in front
 * of. A dynamic first segment such as `/$slug` throws, because a path-prefix
 * check cannot express it.
 */
export function routedFirstSegments(routeTreeSource: string): string[] {
  const block = /interface FileRoutesByFullPath \{([^}]*)\}/.exec(
    routeTreeSource,
  )?.[1];
  if (!block) throw new Error("FileRoutesByFullPath not found");
  const segments = new Set<string>();
  for (const [, fullPath] of block.matchAll(/^\s*'([^']*)':/gm)) {
    const first = fullPath!.split("/")[1] ?? "";
    if (first === "" || first === "$") continue;
    if (/[${}]/.test(first)) {
      throw new Error(`Dynamic first segment ${fullPath} needs a decision`);
    }
    segments.add(first.toLowerCase());
  }
  return [...segments].sort();
}

/**
 * Exposes `virtual:routed-first-segments`, a plain array literal of the first
 * segments the route tree routes, for the Worker's probe guard.
 *
 * The file is read in `load`, not at config time. TanStack's router generator
 * writes `routeTree.gen.ts` in its `configResolved` hook (and on every route
 * file change in dev), and `load` only runs after all `configResolved` hooks
 * have finished, so the module always sees a current file.
 */
export function routedFirstSegmentsPlugin(): Plugin {
  let routeTreePath = path.resolve("src/routeTree.gen.ts");
  return {
    name: "routed-first-segments",
    configResolved(config) {
      routeTreePath = path.resolve(config.root, "src/routeTree.gen.ts");
    },
    resolveId(id) {
      return id === ROUTED_SEGMENTS_MODULE_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      this.addWatchFile(routeTreePath);
      const segments = routedFirstSegments(readFileSync(routeTreePath, "utf8"));
      return `export const ROUTED_FIRST_SEGMENTS = ${JSON.stringify(segments)};`;
    },
    // Dev: when the generator rewrites the route tree, drop the cached module in
    // this environment (the Worker's graph is the `ssr` one) and hot-update it,
    // so its importers re-evaluate without restarting the dev server.
    hotUpdate(options) {
      if (path.resolve(options.file) !== routeTreePath) return undefined;
      const mod = this.environment.moduleGraph.getModuleById(RESOLVED_ID);
      if (!mod) return undefined;
      this.environment.moduleGraph.invalidateModule(mod);
      return [...options.modules, mod];
    },
  };
}

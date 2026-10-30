import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openAPIHandler } from "./openapi-handler";

// The Agent Skill documents how to connect, the order of work and the rules
// only; it takes every endpoint and field from the live OpenAPI document.
// These checks keep it that way, so an API change never needs a Skill change.

const skillDir = fileURLToPath(
  new URL("../../../.agents/skills/flare-stack-blog/", import.meta.url),
);

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesOf(path) : [path];
  });
}

const files = filesOf(skillDir).map((path) => relative(skillDir, path));
const markdown = files
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({ file: f, text: readFileSync(join(skillDir, f), "utf8") }));

const { response } = await openAPIHandler.handle(
  new Request("http://localhost/api/spec.json"),
  { prefix: "/api", context: {} as never },
);
if (!response) throw new Error("No route served /api/spec.json");
const doc = (await response.json()) as { paths: Record<string, unknown> };
const paths = Object.keys(doc.paths);

/** Every property, parameter and operation name the document defines. */
function namesIn(node: unknown, names = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) namesIn(child, names);
    return names;
  }
  if (node === null || typeof node !== "object") return names;
  const record = node as Record<string, unknown>;
  if (record.properties && typeof record.properties === "object") {
    for (const key of Object.keys(record.properties)) names.add(key);
  }
  if (typeof record.in === "string" && typeof record.name === "string") {
    names.add(record.name);
  }
  if (typeof record.operationId === "string") names.add(record.operationId);
  for (const child of Object.values(record)) namesIn(child, names);
  return names;
}

// Names the rules cannot be stated without. x-api-key: key handling says the
// key goes only in that header. saveToken: reading before each write and
// handling an Edit Conflict hinge on it. url: a key of the Skill's own config
// file, which the document happens to use as a field name too.
const ALLOWED = new Set(["x-api-key", "saveToken", "url"]);

// The OpenAPI document, whole or in parts, is the one place the Skill may
// send an agent to. Its subsets are queries on /api/spec.json.
const DOCUMENT_URLS = new Set(["/api/spec.json", "/api/spec/index.json"]);
const names = new Set([...namesIn(doc)].filter((n) => !ALLOWED.has(n)));

describe("the Agent Skill", () => {
  it("is invoked by the model and ships no scripts", () => {
    expect(files).toEqual(["SKILL.md"]);
    const skill = markdown[0]!.text;
    expect(skill).toMatch(/^---\nname: flare-stack-blog\ndescription: .+\n/);
    expect(skill).not.toMatch(/disable-model-invocation/);
  });

  it("names no API path but the OpenAPI document", () => {
    for (const { file, text } of markdown) {
      const apiPaths = [...text.matchAll(/\/api\/[\w./{}-]*/g)].map((m) =>
        m[0].replace(/[.]$/, ""),
      );
      expect(
        apiPaths.filter((p) => !DOCUMENT_URLS.has(p)),
        file,
      ).toEqual([]);
      for (const path of paths) {
        expect(text, `${file} names ${path}`).not.toContain(path);
      }
    }
  });

  it("restates no field, parameter or operation the document defines", () => {
    for (const { file, text } of markdown) {
      const code = [
        ...text.matchAll(/```[\s\S]*?```/g),
        ...text.replace(/```[\s\S]*?```/g, "").matchAll(/`([^`]+)`/g),
      ].map((m) => m[1] ?? m[0]);
      // Prose may say "title" or "tags"; code may not name a field.
      expect(
        code.filter((c) => names.has(c)),
        file,
      ).toEqual([]);
      // A camelCase field name is a shape wherever it appears.
      const camel = text.match(/\b[a-z]+[A-Z]\w*\b/g) ?? [];
      expect(
        camel.filter((w) => names.has(w)),
        file,
      ).toEqual([]);
    }
  });

  it("links only to files inside the Skill", () => {
    for (const { file, text } of markdown) {
      for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href!) || href!.startsWith("#")) {
          continue;
        }
        const target = normalize(join(dirname(file), href!.split("#")[0]!));
        expect(target.startsWith(".."), `${file} → ${href}`).toBe(false);
        expect(existsSync(join(skillDir, target)), `${file} → ${href}`).toBe(
          true,
        );
      }
    }
  });
});

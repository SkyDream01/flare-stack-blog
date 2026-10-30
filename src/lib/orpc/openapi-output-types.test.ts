import { describe, expect, it } from "vitest";
import { openAPIHandler } from "./openapi-handler";

// The OpenAPI document is how an agent learns the API, so a successful
// response must say what it carries. An operation without an output schema
// renders as `anyOf: [{}, {not: {}}]`, which says nothing.

type Schema = Record<string, unknown>;
type Operation = {
  parameters?: Array<{ name: string; in: string; schema?: Schema }>;
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: Schema }> }
  >;
};

const { response } = await openAPIHandler.handle(
  new Request("http://localhost/api/spec.json"),
  { prefix: "/api", context: {} as never },
);
if (!response) throw new Error("No route served /api/spec.json");
const doc = (await response.json()) as {
  paths: Record<string, Record<string, Operation>>;
};

const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({
    name: `${method.toUpperCase()} ${path}`,
    path,
    operation,
  })),
);

/** A schema that accepts anything, which is what an undeclared output becomes. */
function isUntyped(schema: Schema | undefined): boolean {
  if (!schema || Object.keys(schema).length === 0) return true;
  const alternatives = (schema.anyOf ?? schema.oneOf) as
    | Array<Schema>
    | undefined;
  return (
    alternatives?.some(
      (alternative) => Object.keys(alternative).length === 0,
    ) ?? false
  );
}

/** A schema no value satisfies, which is what an unconvertible zod type becomes. */
function isNeverValid(schema: unknown): boolean {
  return JSON.stringify(schema) === JSON.stringify({ not: {} });
}

/** Every property of a request body, walked into objects, as `name: schema`. */
function bodyProperties(
  schema: Schema | undefined,
  at = "",
): Array<[string, Schema]> {
  const properties = (schema?.properties ?? {}) as Record<string, Schema>;
  return Object.entries(properties).flatMap(([name, property]) => [
    [`${at}${name}`, property] as [string, Schema],
    ...bodyProperties(property, `${at}${name}.`),
  ]);
}

describe("OpenAPI responses of the admin operations", () => {
  const admin = operations.filter(({ path }) => path.startsWith("/admin/"));

  it("finds the admin operations", () => {
    expect(admin.length).toBeGreaterThan(50);
  });

  it.each(admin.map(({ name, operation }) => [name, operation] as const))(
    "%s declares what its 200 response carries",
    (_name, operation) => {
      const ok = operation.responses?.["200"];
      expect(ok).toBeDefined();
      const schema = ok?.content?.["application/json"]?.schema;
      if (ok?.content) {
        expect(isUntyped(schema)).toBe(false);
      } else {
        // An empty body is declared by its description, not by a schema.
        expect(ok?.description).toMatch(/empty/i);
      }
    },
  );
});

describe("OpenAPI inputs", () => {
  it("has no parameter or body field that no value satisfies", () => {
    const neverValid = operations.flatMap(({ name, operation }) => {
      const body = (
        operation as {
          requestBody?: { content?: Record<string, { schema?: Schema }> };
        }
      ).requestBody?.content?.["application/json"]?.schema;
      return [
        ...(operation.parameters ?? [])
          .filter((parameter) => isNeverValid(parameter.schema))
          .map((parameter) => `${name} ?${parameter.name}`),
        ...bodyProperties(body)
          .filter(([, schema]) => isNeverValid(schema))
          .map(([field]) => `${name} body.${field}`),
      ];
    });
    expect(neverValid).toEqual([]);
  });
});

describe("status filters", () => {
  function statusParameter(path: string) {
    const operation = doc.paths[path]?.get;
    return operation?.parameters?.find((p) => p.name === "status");
  }

  it("lists the statuses a post can have", () => {
    expect(statusParameter("/admin/posts")?.schema).toMatchObject({
      enum: ["draft", "published"],
    });
  });

  it("lists the statuses a comment can have", () => {
    expect(statusParameter("/me/comments")?.schema).toMatchObject({
      enum: ["published", "deleted"],
    });
  });
});

import { isProcedure, type Lazy, unlazy } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { openAPIHandler } from "./openapi-handler";
import { router } from "./router";

// A field an admin operation does not know must be refused, not dropped: a
// misspelt `save_token` used to strip silently and turn a guarded save into an
// unconditional one. The document says so with `additionalProperties: false`
// on every request body, which is what the zod schemas generate when strict.

type Schema = Record<string, unknown>;
type Operation = {
  parameters?: Array<{ name: string; in: string; schema?: Schema }>;
  requestBody?: { content?: Record<string, { schema?: Schema }> };
};

const { response } = await openAPIHandler.handle(
  new Request("http://localhost/api/spec.json"),
  { prefix: "/api", context: {} as never },
);
if (!response) throw new Error("No route served /api/spec.json");
const doc = (await response.json()) as {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
};

function resolve(schema: Schema | undefined): Schema | undefined {
  const ref = schema?.$ref;
  if (typeof ref !== "string") return schema;
  return doc.components?.schemas?.[ref.split("/").pop() ?? ""];
}

/** Whether the body refuses unknown fields, in every alternative it allows. */
function isClosed(schema: Schema | undefined): boolean {
  const resolved = resolve(schema);
  if (!resolved) return false;
  const alternatives = (resolved.anyOf ?? resolved.oneOf) as
    | Array<Schema>
    | undefined;
  if (alternatives) return alternatives.every(isClosed);
  return resolved.additionalProperties === false;
}

const adminBodies = Object.entries(doc.paths)
  .filter(([path]) => path.startsWith("/admin/"))
  .flatMap(([path, methods]) =>
    Object.entries(methods).flatMap(([method, operation]) =>
      Object.entries(operation.requestBody?.content ?? {}).map(
        ([mediaType, { schema }]) =>
          [`${method.toUpperCase()} ${path} (${mediaType})`, schema] as const,
      ),
    ),
  );

// Query parameters have no `additionalProperties` in the document, so the
// input schemas themselves are checked: every admin operation that takes input
// takes a strict object, and so refuses an unknown query parameter too.
async function adminInputs(node: unknown): Promise<Array<[string, unknown]>> {
  const { default: loaded } = await unlazy(node as Lazy<unknown>);
  if (isProcedure(loaded)) {
    const { route, inputSchema } = loaded["~orpc"];
    const path = route.path ?? "";
    return path.startsWith("/admin/") && inputSchema
      ? [[`${route.method} ${path}`, inputSchema]]
      : [];
  }
  const children = Object.values(loaded as Record<string, unknown>);
  return (await Promise.all(children.map(adminInputs))).flat();
}

type ZodDef = {
  type: string;
  innerType?: { _zod: { def: ZodDef } };
  options?: Array<{ _zod: { def: ZodDef } }>;
  catchall?: { _zod: { def: ZodDef } };
};

function isStrict(def: ZodDef): boolean {
  if (def.innerType) return isStrict(def.innerType._zod.def);
  if (def.options) return def.options.every((o) => isStrict(o._zod.def));
  return def.type === "object" && def.catchall?._zod.def.type === "never";
}

describe("admin operation inputs", async () => {
  const inputs = await adminInputs(router);

  it("finds the admin operations that take input", () => {
    expect(inputs.length).toBeGreaterThan(40);
  });

  it.each(inputs)("%s refuses unknown fields", (_name, schema) => {
    expect(isStrict((schema as { _zod: { def: ZodDef } })._zod.def)).toBe(true);
  });
});

describe("admin request bodies", () => {
  it("finds the admin request bodies", () => {
    expect(adminBodies.length).toBeGreaterThan(20);
  });

  it.each(adminBodies)("%s refuses unknown fields", (_name, schema) => {
    expect(isClosed(schema)).toBe(true);
  });
});

// A path id names one object, so the document says what the server takes: a
// whole number from 1, not any number.
const pathIds = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).flatMap(([method, operation]) =>
    (operation.parameters ?? [])
      .filter((parameter) => parameter.in === "path")
      .filter((parameter) => parameter.schema?.type !== "string")
      .map(
        (parameter) =>
          [
            `${method.toUpperCase()} ${path} {${parameter.name}}`,
            parameter.schema,
          ] as const,
      ),
  ),
);

describe("path ids", () => {
  it("finds the operations addressed by id", () => {
    expect(pathIds.length).toBeGreaterThan(30);
  });

  it.each(pathIds)("%s is a positive integer", (_name, schema) => {
    expect(schema).toMatchObject({ type: "integer", minimum: 1 });
  });
});

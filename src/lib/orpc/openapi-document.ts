import type { OpenAPI } from "@orpc/openapi";

// Forms of the generated OpenAPI document an agent can read on demand: an
// index of the operations, and a subset holding only the operations it needs
// with the components they reference.

type Document = OpenAPI.Document;
type Json = Record<string, unknown>;

const METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

const SCHEMA_REF = "#/components/schemas/";

/** Every operation of the document, in document order. */
export function operationsOf(doc: Document) {
  return Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation = item?.[method];
      return operation ? [{ path, method, operation }] : [];
    }),
  );
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `POST_NOT_FOUND` → `PostNotFound`, `friendLinks` → `FriendLinks`. */
function pascalCase(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join("");
}

/** The code and body of a declared error, from an error response's `oneOf`. */
function declaredError(variant: unknown) {
  if (!isRecord(variant) || !isRecord(variant.properties)) return undefined;
  const { defined, code } = variant.properties;
  if (!isRecord(defined) || defined.const !== true) return undefined;
  if (!isRecord(code) || typeof code.const !== "string") return undefined;
  return { code: code.const, body: JSON.stringify(variant) };
}

/** The schema of every error response that lists its errors in `oneOf`. */
function errorResponseSchemas(doc: Document) {
  return operationsOf(doc).flatMap(({ operation }) =>
    Object.entries(operation.responses ?? {}).flatMap(([status, response]) => {
      const schema = (response as OpenAPI.ResponseObject).content?.[
        "application/json"
      ]?.schema as Json | undefined;
      return Number(status) >= 400 && Array.isArray(schema?.oneOf)
        ? [{ operation, schema: schema as Json & { oneOf: Array<unknown> } }]
        : [];
    }),
  );
}

/**
 * Moves the body of each declared error to `components.schemas`, so the
 * operations that declare the same error share it; the generator writes it
 * out in full in every response that declares it. It is named after its code,
 * `PostNotFoundError`. A code whose body differs between operations (another
 * status or message) gets one per body, named after the feature of the first
 * operation that declares it: `CommentsNameRequiredError`.
 */
export function shareErrorSchemas(doc: Document): Document {
  const shared = structuredClone(doc);
  const responses = errorResponseSchemas(shared);

  // Each code's distinct bodies, with the feature that first declares each.
  const bodies = new Map<string, Map<string, string>>();
  for (const { operation, schema } of responses) {
    for (const variant of schema.oneOf) {
      const error = declaredError(variant);
      if (!error) continue;
      const ofCode = bodies.get(error.code) ?? new Map<string, string>();
      bodies.set(error.code, ofCode);
      if (!ofCode.has(error.body)) {
        ofCode.set(error.body, operation.operationId?.split(".")[0] ?? "");
      }
    }
  }

  const schemas = ((shared.components ??= {}).schemas ??= {}) as Json;
  const names = new Map<string, string>();
  for (const [code, ofCode] of bodies) {
    for (const [body, feature] of ofCode) {
      const prefix = ofCode.size > 1 ? pascalCase(feature) : "";
      const base = `${prefix}${pascalCase(code)}Error`;
      let name = base;
      for (let n = 2; name in schemas; n++) name = `${base}${n}`;
      schemas[name] = JSON.parse(body);
      names.set(body, name);
    }
  }

  for (const { schema } of responses) {
    schema.oneOf = schema.oneOf.map((variant) => {
      const error = declaredError(variant);
      return error
        ? { $ref: `${SCHEMA_REF}${names.get(error.body)}` }
        : variant;
    });
  }
  return shared;
}

/** Every `$ref` under `node`. */
function refsIn(node: unknown, refs = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) refsIn(child, refs);
  } else if (isRecord(node)) {
    if (typeof node.$ref === "string") refs.add(node.$ref);
    for (const child of Object.values(node)) refsIn(child, refs);
  }
  return refs;
}

/**
 * The document's `info` and every operation's id, summary and tags under its
 * path and method: what an agent needs to choose the operations to read.
 */
export function documentIndex(doc: Document): Document {
  const paths: NonNullable<Document["paths"]> = {};
  for (const { path, method, operation } of operationsOf(doc)) {
    const { operationId, summary, tags } = operation;
    // OpenAPI 3.1 makes responses optional; the types still require them.
    (paths[path] ??= {})[method] = {
      operationId,
      summary,
      tags,
    } as typeof operation;
  }
  return { openapi: doc.openapi, info: doc.info, paths };
}

export type DocumentSelection = {
  operationIds: ReadonlyArray<string>;
  tags: ReadonlyArray<string>;
};

export type DocumentSubset =
  | { found: true; document: Document }
  | { found: false; unknown: DocumentSelection };

/**
 * The operations named by id or tag, and every component they reference,
 * directly or through other components. The other components are left out,
 * except security schemes, which no operation references.
 */
export function documentSubset(
  doc: Document,
  selection: DocumentSelection,
): DocumentSubset {
  const operations = operationsOf(doc);
  const unknown = {
    operationIds: selection.operationIds.filter(
      (id) => !operations.some(({ operation }) => operation.operationId === id),
    ),
    tags: selection.tags.filter(
      (tag) =>
        !operations.some(({ operation }) => operation.tags?.includes(tag)),
    ),
  };
  if (unknown.operationIds.length > 0 || unknown.tags.length > 0) {
    return { found: false, unknown };
  }

  const paths: NonNullable<Document["paths"]> = {};
  for (const { path, method, operation } of operations) {
    const chosen =
      selection.operationIds.includes(operation.operationId ?? "") ||
      (operation.tags ?? []).some((tag) => selection.tags.includes(tag));
    if (chosen) (paths[path] ??= {})[method] = operation;
  }

  const all = (doc.components ?? {}) as Record<string, Json>;
  const used = new Set<string>();
  const pending = [...refsIn(paths)];
  for (let ref = pending.pop(); ref !== undefined; ref = pending.pop()) {
    const [, section, name] = /^#\/components\/([^/]+)\/(.+)$/.exec(ref) ?? [];
    const component = section && name ? all[section]?.[name] : undefined;
    if (used.has(ref) || component === undefined) continue;
    used.add(ref);
    pending.push(...refsIn(component));
  }
  // In the order of the whole document, so a subset reads the same way.
  const components: Record<string, Json> = {};
  for (const [section, entries] of Object.entries(all)) {
    for (const [name, component] of Object.entries(entries)) {
      const ref = `#/components/${section}/${name}`;
      if (section === "securitySchemes" || used.has(ref)) {
        (components[section] ??= {})[name] = component;
      }
    }
  }

  return {
    found: true,
    document: { openapi: doc.openapi, info: doc.info, paths, components },
  };
}

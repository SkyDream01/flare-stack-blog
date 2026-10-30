import { ORPCError } from "@orpc/client";
import {
  type OpenAPI,
  OpenAPIGenerator,
  type OpenAPIGeneratorGenerateOptions,
  type OpenAPIGeneratorOptions,
} from "@orpc/openapi";
import { type Context, lazy, unlazyRouter } from "@orpc/server";
import type { StandardHandlerPlugin } from "@orpc/server/standard";
import type { StandardResponse } from "@orpc/standard-server";
import {
  documentIndex,
  documentSubset,
  shareErrorSchemas,
} from "./openapi-document";

/** Where the document is served, under the handler's prefix. */
export const DOCUMENT_PATHS = {
  spec: "/spec.json",
  index: "/spec/index.json",
  docs: "/docs",
} as const;

/** The query `/spec.json` takes to answer a subset, each a comma-separated list. */
const SUBSET_PARAMS = ["operationIds", "tags"] as const;

type Documents = { full: OpenAPI.Document; index: OpenAPI.Document };
type PluginInit<T extends Context> = Parameters<
  NonNullable<StandardHandlerPlugin<T>["init"]>
>;
type AppRouter<T extends Context> = PluginInit<T>[1];

function jsonResponse(status: number, body: unknown): StandardResponse {
  return {
    status,
    headers: {},
    body: new File([JSON.stringify(body)], "spec.json", {
      type: "application/json",
    }),
  };
}

function badRequest(message: string) {
  return jsonResponse(400, new ORPCError("BAD_REQUEST", { message }).toJSON());
}

/**
 * Serves the OpenAPI document, its index and subsets of it, and an API
 * reference page that renders it. The document is generated on the first
 * request for it and kept for the life of the isolate.
 */
export class OpenAPIDocumentPlugin<
  T extends Context,
> implements StandardHandlerPlugin<T> {
  readonly #generator: OpenAPIGenerator;
  readonly #generateOptions: OpenAPIGeneratorGenerateOptions;
  readonly #docsTitle: string;
  #documents: Promise<Documents> | undefined;

  constructor(
    options: OpenAPIGeneratorOptions & {
      generateOptions: OpenAPIGeneratorGenerateOptions;
      docsTitle: string;
    },
  ) {
    const { generateOptions, docsTitle, ...generatorOptions } = options;
    this.#generator = new OpenAPIGenerator(generatorOptions);
    this.#generateOptions = generateOptions;
    this.#docsTitle = docsTitle;
  }

  init(...[options, appRouter]: PluginInit<T>) {
    // The generator lists loaded procedures before lazy ones; handing it the
    // whole router behind a single lazy keeps the document in the router's
    // own order. The generator resolves a lazy root, though Router's type has
    // no such case.
    const wholeRouter = lazy(async () => ({
      default: await unlazyRouter(appRouter),
    })) as unknown as AppRouter<T>;

    options.interceptors ??= [];
    options.interceptors.push(async (interception) => {
      const result = await interception.next();
      const { request, prefix = "" } = interception;
      if (result.matched || request.method !== "GET") return result;

      const pathname = request.url.pathname.replace(/\/$/, "");
      const server = new URL(prefix, request.url.origin).toString();
      const respond = (response: StandardResponse) => ({
        matched: true as const,
        response,
      });

      switch (pathname) {
        case `${prefix}${DOCUMENT_PATHS.spec}`: {
          const { full } = await this.#documentsOf(wholeRouter);
          return respond(
            request.url.searchParams.size === 0
              ? jsonResponse(200, withServer(full, server))
              : subsetResponse(full, request.url, prefix, server),
          );
        }
        case `${prefix}${DOCUMENT_PATHS.index}`: {
          if (request.url.searchParams.size > 0) {
            return respond(
              badRequest(`${request.url.pathname} takes no query.`),
            );
          }
          const { index } = await this.#documentsOf(wholeRouter);
          return respond(jsonResponse(200, withServer(index, server)));
        }
        case `${prefix}${DOCUMENT_PATHS.docs}`:
          return respond({
            status: 200,
            headers: {},
            body: new File(
              [
                docsHtml(
                  this.#docsTitle,
                  new URL(
                    `${prefix}${DOCUMENT_PATHS.spec}`,
                    request.url.origin,
                  ).toString(),
                ),
              ],
              "api-reference.html",
              { type: "text/html" },
            ),
          });
        default:
          return result;
      }
    });
  }

  #documentsOf(router: AppRouter<T>) {
    this.#documents ??= this.#generator
      .generate(router, this.#generateOptions)
      .then((generated) => {
        const full = shareErrorSchemas(generated);
        return { full, index: documentIndex(full) };
      })
      .catch((error: unknown) => {
        this.#documents = undefined;
        throw error;
      });
    return this.#documents;
  }
}

/**
 * The subset of `full` that the query of `url` asks for, or the error that
 * says what is wrong with the query.
 */
function subsetResponse(
  full: OpenAPI.Document,
  url: URL,
  prefix: string,
  server: string,
): StandardResponse {
  const params = url.searchParams;
  const unknown = [...new Set(params.keys())].filter(
    (key) => !(SUBSET_PARAMS as ReadonlyArray<string>).includes(key),
  );
  if (unknown.length > 0) {
    return badRequest(
      `${url.pathname} takes only ${SUBSET_PARAMS.join(" and ")}, not ${unknown.join(", ")}.`,
    );
  }
  const listOf = (key: string) =>
    params
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  const operationIds = listOf("operationIds");
  const tags = listOf("tags");
  if (operationIds.length === 0 && tags.length === 0) {
    return badRequest(
      "Name at least one operationId in operationIds or one tag in tags, separated by commas.",
    );
  }

  const index = `${prefix}${DOCUMENT_PATHS.index}`;
  const subset = documentSubset(full, { operationIds, tags });
  if (!subset.found) {
    const missing = [
      ...subset.unknown.operationIds.map((id) => `operationId ${id}`),
      ...subset.unknown.tags.map((tag) => `tag ${tag}`),
    ];
    return jsonResponse(
      404,
      new ORPCError("OPERATION_NOT_FOUND", {
        status: 404,
        message: `No operation has ${missing.join(", ")}. The operations, with their ids and tags, are listed in ${index}.`,
        data: subset.unknown,
      }).toJSON(),
    );
  }
  // The agent read the API-wide rules in the index; a subset says where they
  // are instead of repeating them.
  const { document } = subset;
  return jsonResponse(
    200,
    withServer(
      {
        ...document,
        info: {
          ...document.info,
          description: `Part of this API's document: the operations asked for and the components they reference. The API-wide rules are in info.description of ${index}.`,
        },
      },
      server,
    ),
  );
}

/** The document with the server it was asked from, which paths are relative to. */
function withServer(doc: OpenAPI.Document, url: string): OpenAPI.Document {
  const { openapi, info, servers: _, ...rest } = doc;
  return { openapi, info, servers: [{ url }], ...rest } as OpenAPI.Document;
}

/** The JSON of `value`, safe inside an inline script. */
function scriptJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026");
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** An API reference page that loads the document from `specUrl`. */
function docsHtml(title: string, specUrl: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      const scalarConfig = ${scriptJson({ url: specUrl })};
      Scalar.createApiReference("#app", scalarConfig);
    </script>
  </body>
</html>
`;
}

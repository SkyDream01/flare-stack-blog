import {
  SearchQuerySchema,
  SearchResultSchema,
  SearchVersionSchema,
} from "@/features/search/search.schema";
import * as SearchService from "@/features/search/service/search.service";
import { z } from "zod";
import { adminProcedure, publicProcedure } from "@/lib/orpc/procedure";

const search = publicProcedure
  .route({
    method: "GET",
    path: "/search",
    summary: "Search published posts",
    description:
      "Searches the title, summary, body, category and tags of published posts. Call GET /search/version first and pass what it returns as v; v is required.",
    tags: ["Search"],
  })
  .input(SearchQuerySchema)
  .output(z.array(SearchResultSchema))
  .handler(({ context, input }) => SearchService.search(context, input));

const version = publicProcedure
  .route({
    method: "GET",
    path: "/search/version",
    summary: "Get search index version",
    description:
      "The version of the search index, which changes whenever the index does. Pass it as v to GET /search.",
    tags: ["Search"],
  })
  .output(SearchVersionSchema)
  .handler(({ context }) => SearchService.getIndexVersion(context));

const rebuild = adminProcedure
  .route({
    method: "POST",
    path: "/admin/search/rebuild",
    summary: "Rebuild the search index",
    tags: ["Admin Search"],
  })
  .output(
    z.object({
      indexed: z.number().int().nonnegative().describe("Posts now indexed."),
      duration: z
        .number()
        .nonnegative()
        .describe("Time taken, in milliseconds."),
    }),
  )
  .handler(({ context }) => SearchService.rebuildIndex(context));

export default {
  search,
  version,
  rebuild,
};

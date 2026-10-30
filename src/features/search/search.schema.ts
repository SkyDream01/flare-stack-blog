import { z } from "zod";
import { NullableJsonContentSchema } from "@/features/posts/schema/json-content.schema";
import { pageLimitSchema } from "@/lib/orpc/pagination";

export const SearchQuerySchema = z.object({
  q: z.string().min(1).describe("The words to search for."),
  limit: pageLimitSchema(25)
    .optional()
    .default(10)
    .describe(
      "How many results to return, a whole number from 1 to 25. Defaults to 10.",
    ),
  v: z
    .string()
    .describe(
      "The search index version: read it from GET /search/version just before searching. Results are cached per version, so a search made with the current version is never answered from an older index. The search itself does not filter on it, but it is required.",
    ),
});

export const SearchResultSchema = z.object({
  post: z.object({
    id: z.number().int(),
    slug: z.string().describe("Slug of the live page at /post/{slug}."),
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
  }),
  score: z.number().describe("Always 0: results come ordered by relevance."),
  matches: z
    .object({
      title: z.string().nullable(),
      summary: z.string().nullable(),
      contentSnippet: z.string().nullable(),
    })
    .describe(
      "Excerpts around the matched words, as HTML: every field is always HTML-escaped (& < > \" ' as &amp; &lt; &gt; &quot; &#039;), whether or not it matched, and the matched words are wrapped in <mark></mark>, the only tags. Decode the entities to get the plain text. A text without a match shows its beginning; an empty text is null.",
    ),
});

export const SearchVersionSchema = z.object({
  version: z
    .string()
    .describe(
      "Changes whenever the search index does. Pass it as v when searching.",
    ),
});

const UpsertSearchDocSchema = z.object({
  id: z.number(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  contentJson: NullableJsonContentSchema.optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().nullable().optional(),
});

const DeleteSearchDocSchema = z.object({
  id: z.number(),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type UpsertSearchDocInput = z.infer<typeof UpsertSearchDocSchema>;
export type DeleteSearchDocInput = z.infer<typeof DeleteSearchDocSchema>;

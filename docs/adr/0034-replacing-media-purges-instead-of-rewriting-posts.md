# Replacing Media purges its cached copies instead of rewriting Posts

Replacing a **Media** file keeps its key, and every **Post** keeps the addresses it already has. Until now the replace pointed each draft that used the image at a new `?v=` address, which wrote the Post: it rotated its `saveToken` under other writers, gave a **Published Post** **Unpublished Changes**, and left the public page on the old file until the Post was published again. Now the replace writes no Post. The serving layer makes every address of the key answer with the new file:

- Each `/images/{key}` response carries a `media:{key}` Cache-Tag, and the replace purges it through `App.purgeCache` (ADR 0009), so the original and every transformed width go from Workers Caching at once.
- An image transform reads its source at `?original=true&v={R2 ETag}`. Cloudflare keeps transformed images by source URL and only a zone purge clears that (ADR 0007), so a new file gives the transform a new source. The ETag costs one R2 `head`, only when the edge has no copy.
- Browsers revalidate transformed images (`max-age=0, must-revalidate`, with an ETag per file version, width and format) instead of keeping them for a year as `immutable`, since the address now outlives the file. Originals already revalidated.

The Media record's own `url` still gets a new `?v=`, so a page that already shows it, the media library, loads the new file; an address with an older `v`, or none, serves the new file too.

**Considered Options**

- Resolving each image's current version at render time. Every surface that names an image (post pages, cards, feeds, Markdown reads, the editor) would need it, and the cached HTML and KV entries of each Post using the image would need invalidating.
- Rewriting the Public Content Snapshots as well. It would change published content without publishing.
- Keeping `immutable` for browsers. A visitor who had seen the image would keep the old file for a year.

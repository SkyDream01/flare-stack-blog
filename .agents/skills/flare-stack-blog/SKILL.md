---
name: flare-stack-blog
description: Operate a running Flare Stack Blog as Admin over its HTTP API.
disable-model-invocation: true
---

# Flare Stack Blog

Operate a deployed Flare Stack Blog instance as an Admin over its HTTP API. The OpenAPI specification (`/api/spec.json`) defines available endpoints, schemas, and parameters; this guide covers credentials, common authoring workflows, and domain rules.

## 1. Credentials

Configuration file path: `$XDG_CONFIG_HOME/flare-stack-blog/config.toml` (or `~/.config/flare-stack-blog/config.toml` if `XDG_CONFIG_HOME` is unset).

```toml
url = "https://example.com"
api_key = "fsb_..."
```

- `url`: Site origin (`scheme://host`), without a path or trailing slash.
- `api_key`: Admin API Key starting with `fsb_`.

If the file is missing or either field is empty, prompt the user for the site origin and Admin API Key, create the parent directory if needed, write the file with `0600` permissions, and proceed. If the user provides a new origin or key later, update the file.

**Security**:
- The key appears only in the `x-api-key` HTTP header. Keep it out of URLs, argv, logs, and user-facing text.

Do not proceed with API calls until both fields are resolved from the configuration file.

## 2. Contract

At the start of each session, fetch `{url}/api/spec.json` to inspect available operations:

1. **URL Construction**: Resolve target URLs using the base URL from the `servers` array combined with each route's `path`.
2. **Authentication**: Attach the `x-api-key` header to every request, even if an operation definition omits an explicit security declaration.
3. **Client fingerprint**: Send a browser `User-Agent` on every request, including `/api/spec.json`. A `403` whose body is Cloudflare Error 1010 / `browser_signature_banned` is the WAF blocking the HTTP client — retry with a browser `User-Agent` and the same API key.
4. **Schema Compliance**: Adhere strictly to each operation's HTTP method, path/query parameters, request body schema, and description.
5. **Admin Preference**: When both public and admin endpoints exist for the same entity (e.g. posts, tags, categories), always use the admin endpoint.

All callable operations are defined within the runtime OpenAPI specification. The bundled client already applies (1)–(3).

## 3. Common operations

Scripts live in `scripts/` beside this file. They read the config file and print `{ "http", "body" }`.

```bash
python scripts/fsb.py posts list
python scripts/fsb.py posts new
python scripts/fsb.py posts save ID \
  --title "..." --summary "..." --md draft.md \
  --category Cloudflare --tags "Cloudflare,Cloudflare Workers"
python scripts/fsb.py posts get ID --md
python scripts/fsb.py media upload photo.png
python scripts/fsb.py posts publish ID
```

`posts new` returns an existing empty **Draft Post** when one exists; fill that id. `fsb.py -h` lists the rest (tags, categories, unpublish, raw `request`). Use `request` only after reading the spec.

**Content (`contentJson`)**: TipTap / ProseMirror JSON, not Markdown and not a raw HTML string. Write a Markdown subset and encode it:

```bash
python scripts/tiptap.py encode draft.md
```

`posts save --md` does that encoding. `posts get ID --md` dumps the draft. PATCH `contentJson`; GET also returns `publicSnapshotContentJson` (the live snapshot, including generated code highlighting) — that is not the write field.

Markdown subset: headings 2–4, paragraphs, lists, quotes, fences, links, images, tables, `**bold**` `*italic*` `~~strike~~` `` `code` ``, `$inline math$`, `$$block math$$`. Run `tiptap.py -h` for the exact surface.

## 4. Domain Rules & Invariants

- **Publishing Intent**: Saving or updating a **Post** modifies the draft; a post only appears on the public site after being published to create or update its **Public Content Snapshot**. Follow the user's intent directly—publish if they ask to publish, keep as a draft if they ask for a draft, and proactively ask for clarification if their intent is unclear.
- **Media Protection**: Media referenced by any post cannot be deleted.
- **Execution & Reporting**: Quote error response bodies verbatim when an operation fails. Conclude each requested action with an HTTP status summary or a clear error report, using the domain terms below.

## Domain Glossary

**Post.** The editable content entity. Saving updates the draft; publication updates the public site.

**Draft Post.** A **Post** without a **Public Content Snapshot**. Editable in admin workflows; never visible on the public site.

**Published Post.** A **Post** with an active **Public Content Snapshot**. Immediately visible on the public site, in public listings, and in search indexing. Publication is immediate.

**Public Content Snapshot.** The published state read by readers and public caches. Publishing replaces it; unpublishing discards it.

**Post Revision.** A historical snapshot created automatically upon publish and immediately prior to restoring an earlier revision. Saving or autosaving a draft does not create a revision. Restoring a revision updates the draft post and leaves the live snapshot untouched until published again.

**Category.** An exclusive, non-hierarchical classification for **Posts** (a post has at most one category).

**Tag.** A reusable, non-hierarchical label grouping multiple **Posts**. Managed independently and associated with posts.

**Comment.** User-authored plain text attached to a post, visible immediately upon creation. Deletion retains a placeholder in the **Comment Thread** when replies exist.

**Muted User.** A user blocked by an Admin from creating comments. Remains a registered user with profile and friend-link capabilities. Admins cannot be muted.

**Friend Link.** An external site recommendation displayed on the public friend-links page once approved by an Admin.

**Media.** Uploaded image assets tracked by the CMS. Cannot be deleted while referenced by any post.

**System Config.** CMS-wide operational settings, including **Site Config** (branding and presentation) and notification settings (email, webhook endpoint).

**API Key.** A secret credential issued by an Admin granting programmatic access over the HTTP API. Issue and revoke keys in the admin dashboard.

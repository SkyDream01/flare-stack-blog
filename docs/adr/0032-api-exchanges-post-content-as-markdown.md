# The HTTP API exchanges Post content as Markdown

The editor stores TipTap JSON, but agents and external editors write Markdown, so each client converted on its own. The **Agent Skill** carried a second, regex-based converter that drifted from the editor schema and tied every skill to one release. Reads now take `contentFormat=markdown` and answer `contentMarkdown`; writes take either `contentJson` or `contentMarkdown`, and the server converts with the editor's own Markdown parser, the one Markdown paste uses. The conversion has fixed rules: a video link alone on a line is a video block, as when pasted, but only when written as a bare address (or in `<>`): `[text](address)` stays a link, which is how a link whose text is its address reads out, so it writes back unchanged; table cells hold one line, so merged cells and cells with several paragraphs or line breaks come back flattened; a Markdown write resets table column widths to equal; an image must be a web address or a **Media** path, and a local file path, which the server cannot upload, is refused; video title, cover and length are looked up on write and left empty when the lookup fails. A `contentJson` write follows the same image rule and may hold only the node and mark types of the editor schema, each with only the attributes the schema gives it (attributes older editors stored are accepted and dropped, and restoring a **Post Revision** drops them too), so a body that was stored always reads as Markdown and writes back unchanged; a body with nothing to write reads as `null`.

With content and API-wide rules (authentication, client fingerprint, drafts and publishing) defined by the OpenAPI document, the Agent Skill holds only how to connect, the order of work and its rules, with no scripts.

**Considered Options**

- Refusing a Markdown write that would lose what Markdown cannot express. The agent would then switch between two formats on the same Post.
- Markdown only when creating a Post. Editing an existing Post needs it too.
- Always answering both formats. Most reads would convert for nothing.

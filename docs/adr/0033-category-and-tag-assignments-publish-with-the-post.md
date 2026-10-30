# Category and Tag assignments publish with the Post

A **Post**'s **Category** and **Tags** are now part of its **Public Content Snapshot**: assigning them changes the draft, and the public site, search and the sidebar see them only when the Post is published. This replaces ADR 0008's single set of assignments, under which a Published Post being edited could show its new Tags beside its old content, the Agent Skill had to treat Category and Tags as an exception to "saving changes the draft", and **Unpublished Changes** could not be told apart from assignment changes that were already live. The public assignments are stored as relations rather than inside the snapshot JSON, so public listing, filtering and counting stay indexed queries; the migration fills them from the current assignments of Published Posts, so nothing changes on the public site when it ships.

The Categories and Tags themselves keep no draft: creating, renaming and deleting them take effect at once, as in the sibling real-estate CMS. A draft Category would let a Published Post refer to a Category the public site cannot show, and its name and filter would silently disappear. Deleting one asks for confirmation naming how many Published Posts lose it.

Pinning moves the other way, out of the snapshot: it orders the whole site, so the post list's pin switch takes effect at once, and the editor no longer offers it. Everything the editor changes now waits for publishing, and Unpublished Changes compare a fingerprint of the draft's content (title, summary, slug, content, publication date, cover, Category, Tags) with the one taken at publishing, so undoing an edit clears them.

**Considered Options**

- Drafts for Category and Tag definitions as well. Rejected for the dangling reference above; the definitions have only a name, so there is little to draft.
- Keeping one set of assignments and only labelling Category and Tags as live in the editor. The page would still mix states, and Unpublished Changes would need a hash that skips them.

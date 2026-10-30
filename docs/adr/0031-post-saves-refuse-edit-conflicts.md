# Post saves refuse Edit Conflicts

The admin editor autosaves a **Post** 1.5 seconds after typing stops, and API clients (the **Agent Skill**, external editors) write the same Posts, so the later save silently replaced the earlier one. Each Post now stores an opaque `saveToken` that every write replaces, tags and category included; pinning, which ADR 0033 took out of the draft, keeps it. So does a save that would change nothing (every stated field already holds its value, the same Tags are set again, a draft is unpublished): it writes nothing, so it cannot make an open editor meet an Edit Conflict it did not cause. A stated token that is stale still answers 409 for such a save. A save may state the token it read; the update is then conditional on it in one statement, which D1 runs atomically, and a mismatch answers 409 with nothing written. The admin editor and the Agent Skill always state it: on an **Edit Conflict** the editor stops autosaving and lets the Admin load the latest Post or overwrite it. A publish may state the token too, so what goes live is the draft that was read and approved. A save or publish that states no token still goes through, so existing scripts and external editors keep working.

This reverses the answer to #136, which left conflict detection to clients.

**Considered Options**

- `updatedAt` as the guard. It has one-second precision, so two autosaves can share it.
- Clients hash what they read and compare before writing. Read, compare and write are separate requests, so two writers can both pass.
- A required token. It would break every existing client, unlike System Config's `expectedRevision` (ADR 0025), which was introduced together with its only client.
- Naming it `version` or `revision`. The glossary keeps those words for **Public Content Snapshot** and **Post Revision**.

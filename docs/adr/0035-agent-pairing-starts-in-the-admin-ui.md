# Agent pairing starts in the admin UI

Connecting an **Agent Skill** meant an **Admin** created an **API Key** and pasted it into the agent's conversation, where it stays in the transcript. An Admin now generates a **Pairing Code** on the admin UI's Agent Skill tab and gives it to the agent; the agent exchanges it once for an ordinary **API Key** owned by that Admin, so the key itself never passes through the conversation. The code is eight characters, lives ten minutes, works once and is stored hashed; each Admin has at most one live code; only a signed-in Admin can generate one, never an API Key. The tab watches the code and shows which agent connected, with a button to revoke the key at once, which covers a code that leaked within its ten minutes. Pasting an API Key by hand still works.

**Considered Options**

- Device authorization (RFC 8628), as in `gh auth login`, including Better Auth's device authorization plugin: the agent asks the blog for a code and the Admin approves it, so nothing secret enters the conversation. It needs an endpoint anyone can call to open requests, which then needs abuse protection, it starts in the agent rather than on the guided tab, and the plugin issues a session rather than an **API Key**.
- A pairing that issues its own kind of credential or a key with a default expiry. **API Keys** already carry the Admin's permissions and are listed and revoked in one place; a second kind would split that.

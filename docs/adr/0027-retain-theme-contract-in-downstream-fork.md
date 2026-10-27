# Retain the Theme Contract in the downstream fork

This downstream fork syncs the upstream domain, data, admin, and deployment changes while retaining the Theme Contract and the `default`, `fuwari`, and `cuckoo` theme implementations.

Upstream ADR 0012 defines a single public presentation. That decision does not apply to this fork because theme selection and the Cuckoo presentation are explicit product requirements. Public routes continue to own routing and data loading, then delegate presentation to the build-selected theme. Themes do not own permissions, persistence, or domain workflows.

When syncing future upstream changes, preserve the theme registry, contracts, theme implementations, theme-specific Site Config fields, and the `@theme` build alias unless this decision is explicitly reopened.

As of the v3.1.0 sync, themes share the upstream Post renderer for headings, schema, table alignment and proportional column widths, while supplying their own image and code block components. Code block frames retain each theme's presentation and load the shared Mermaid diagram renderer only for Mermaid blocks. The local Markdown issue tracker remains the downstream issue tracker.

As of the v3.7.0 sync, all three themes implement the upstream GitHub and Sign-in Code flow through the Theme Contract, including resend cooldowns and the public-name step. The shared Name Gate enforces the same public-name requirement in every theme. Password forms and their obsolete theme contract entries are removed; legacy authentication routes redirect to sign-in.

# Retain the Theme Contract in the downstream fork

This downstream fork syncs the upstream domain, data, admin, and deployment changes while retaining the Theme Contract and the `default`, `fuwari`, and `cuckoo` theme implementations.

Upstream ADR 0012 defines a single public presentation. That decision does not apply to this fork because theme selection and the Cuckoo presentation are explicit product requirements. Public routes continue to own routing and data loading, then delegate presentation to the build-selected theme. Themes do not own permissions, persistence, or domain workflows.

When syncing future upstream changes, preserve the theme registry, contracts, theme implementations, theme-specific Site Config fields, and the `@theme` build alias unless this decision is explicitly reopened.

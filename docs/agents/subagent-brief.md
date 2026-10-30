# Subagent briefs

A brief is the only context a ticket's subagent gets. Build it from the preamble below plus the ticket-specific part: the issue number, file pointers, decisions already made, and the files other running tickets own.

## Model and effort

Pick by the ticket's complexity: security-critical or cross-cutting server work (handlers, migrations, auth) → opus/high; well-specified UI or bounded server work → sonnet/high; small mechanical changes → sonnet/medium. Run tickets that don't block each other in parallel, each with `isolation: "worktree"`.

## Preamble

Copy into every brief and fill the `<…>`:

- **Start**: run `git merge --ff-only <integration branch>` in the worktree, confirm `git log --oneline -1` shows `<sha>`, then `bun install`.
- **Conventions**: read AGENTS.md and GLOSSARY.md; Result pattern from `@/lib/errors`; Capitalized service aliases; every control from `src/components/ui`; match the surrounding code's comment density and naming.
- **Chinese copy**: formal written Chinese in a declarative tone, no 你; one term per concept (当前草稿, 已发布的版本, 已发布页面, 新版本, 历史版本), names in 「」; write `messages/en.json` too.
- **Checks**: `bun run check`, `bun run test:node`, `bun run i18n:verify` when messages change, and only the workerd test files the change touches: `bun run test --maxWorkers=1 <files>`. The lead runs the full suite once after merging; several parallel full suites exhaust the machine's memory.
- **Local app**: no dev server and no `bun run db:migrate:local` in a worktree. Visual checks run later in the main checkout through the `run-blog` skill.
- **Commits**: small conventional commits with no AI attribution or Co-Authored-By trailer; no push, no merge. A regenerated `src/lib/orpc/contract.generated.json` belongs in the commit.
- **Report** (in Chinese, concise): commits, what API clients and readers now see, tests added, anything unsettled.

## Acceptance

1. Merge each ticket branch into the integration branch with `--no-ff`. On a conflict in `contract.generated.json`, run `bun run check` to regenerate it; in description strings keep both sides' facts.
2. After the last merge: `bun run check`, `bun run i18n:verify`, `bun run i18n:prune-unused --check`, `bun run test:node`, the full `bun run test --maxWorkers=2` with nothing else running, then `bun run build`.
3. For UI changes, a subagent triggers each changed state through `run-blog` and screenshots it into the session scratchpad; the user reviews them before anything reaches `dev`.

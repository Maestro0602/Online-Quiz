Working Rules (v1.6)

Precedence
My in-message instruction overrides these rules for that message only.

Minimum
Do only what I ask. Nothing extra: no added code, files, features, background, alternatives, or suggestions. Applies to questions and tasks alike. If I want more, I'll say "deeper."

Scope
Working directory = project root for the whole session; all paths are relative to it. Don't run `pwd`/`ls`/`find` to locate it, and don't ask where it is. Don't read or edit anything outside it.
Never read or print secrets: `.env*`, keys, tokens, credential files.

Before touching files
Before creating, editing, or deleting a file:

1. Restate what I'm asking, in 1-3 sentences.
2. State the exact plan: which files, what changes.
3. Stop and wait for "yes" / "ok" / "proceed" / "go."

This restate is the only place restating is allowed.
If I correct you, restate the plan and wait again. If unclear, ask one short question instead of guessing.
If the work turns out to need anything outside the approved plan (another file, a different approach), stop and re-ask.

Commands: ask first
Don't run git, tests, builds, linters, or the dev server. Don't browse or explore the project. Don't create plan/task/walkthrough artifacts. Exception: I explicitly ask for it in that message.
If I ask for one command, do only that one. Don't chain extras (e.g. I ask for tests, you also run lint/build) unless asked separately.
Exact-term searches (old name/value for renames, a named symbol for tracing) are allowed without asking. Browsing unrelated files is not.
Never add any AI, Copilot, or bot attribution trailers, tags, or signatures (e.g. `Co-authored-by:`, `Generated with`, or assistant markers) to git commits or project files.

Renames & hardcoded → dynamic changes
When a change replaces hardcoded values (e.g. `'dog'`/`'cat'`) with IDs/lookups, or renames/restructures a field, type, or value:

* First search the project for every use of the old name/value/type, exact terms only.
* In the plan, list each affected file and what changes there (types, forms, filters, badges, mock/seed data, API calls, display code).
* Say where a new lookup table/constant would go.
* After approval, update everything in one pass. Nothing half-converted.
* Removing old values, imports, or code orphaned by the change itself is in scope.
* List anything you're unsure about separately as "unsure." Don't guess.

Data shape
Applies where a project models structured/persisted data (a DB, an API, saved records). For a script, game, or anything without a real data layer, use whatever fits that project.

* Persisted or user-selectable fixed options (species, status, role, tag, etc.) → a lookup table of `{ id: 1, name: "..." }` objects. Never hardcode them as plain strings.
* Code-only discriminants (union types, UI variants, config keys) may stay as types/constants. Don't force lookup tables onto them.
* Other records reference the lookup by id (`speciesId: 1`), never by name string.
* Ids: numeric, unique, stable. Never reuse a deleted id. Names are display-only.
* `tagIds`-style arrays are fine for many-to-many relations.
* Keep it DB-ready: one lookup array per table, one record per row, flat fields, no nested copies of lookup objects inside other records.
* Lookup tables live in their own file (e.g. `species.ts`), typed and exported.
* Apply this by default for any dynamic/id-based change, without asking.

Reading & editing

* Open only the file or line range the change needs. Need several files? Read them together, not one call at a time.
* Don't re-read a file to keep working or to verify an edit. Trust the edit tool's result; re-read only if the edit failed or something else changed the file.
* Never read lockfiles, `node_modules`, build output, `dist`, `.git`, or generated files. If library types from `node_modules` are needed, ask first.
* Minimal, targeted diffs only. Never rewrite or reprint a whole file for a small edit. No refactors, renames, reformatting, or cleanup I didn't ask for. No docstrings or type annotations unless asked. No extra features, abstractions, or dependencies beyond the request.
* Match the surrounding code's conventions (naming, style, patterns).
* No comments by default, and never ones narrating a change (`// now using X`, `// changed to Y`). If I ask for comments, the only form is a block above the function: what it does, what parameters it takes. That applies to that request only, not to every function after.

Output
Edit-workflow replies: no preamble, no restating my request, no apologies (just fix mistakes), no explanation/alternatives/next steps beyond what's asked.
After an approved change: make it, then a 1-2 sentence summary in plain sentences, no headers/bullets/tables.
Record changes made in each session point-by-point in FEATURE.md so features and updates are never forgotten.
One retry max on a failed approach, then stop and say what failed.
Large task (more than ~3 files or ~100 changed lines): one part at a time, wait before continuing.
Answers to questions follow Answer style below.

Questions (understanding code / flow)

* Start from what I name (file, function, route). If I named nothing, ask one short question instead of searching broadly.
* Locate by exact symbol search, then read only that function's line range. Batch reads. Never re-read.
* Follow calls only as deep as the question needs. Stop at library/framework boundaries and say "not traced: X".
* If tracing needs more than ~5 files, say so and ask before going deeper.
* Answer first (1-2 sentences), then the flow as a chain: A (file:line) → B (file:line) → C. Add detail only where it explains why.
* Reference code as file:line. Paste a snippet only if it's under ~10 lines and is the point.
* Separate what you read from what you inferred. Never guess behavior of code you didn't open.
* End with one line listing files/ranges read, so I can redirect. No next-step suggestions unless asked.
* "Full answer" means complete for the question asked, not exhaustive. I'll say "deeper" if I want more.

Answer style

* Plain, simple language. Short sentences. No jargon unless I used it first. Explain a term only if the answer depends on it.
* Lead with the direct answer in 1-2 sentences. Stop there if that's enough.
* No history, background, examples, or caveats I didn't ask for.
* Use the A → B → C flow chain only for "how does X work / trace X" questions, not for simple ones.
* Bullets or headers only when they make the answer shorter.
# Contributing to Focus First

Thanks for taking the time to contribute. This guide explains how to report
issues, propose changes, and get a pull request merged.

> [!important]
> **Licensing note.** Focus First is licensed under the [MIT License](LICENSE).
> By submitting a contribution (issue, code, or documentation) you agree that
> your contribution is provided under the same MIT License.

## Ways to contribute

- **Report a bug** — open an [issue](https://github.com/christian-luger-at/obsidian-focus-first/issues).
- **Request a feature** — open an issue describing the problem you want solved.
- **Improve the docs** — fixes to the README, DEV.md, or in-code docs are welcome.
- **Send code** — bug fixes and small, well-scoped features via pull request.

For anything larger than a small fix, please **open an issue first** so we can
agree on the approach before you invest time. This avoids PRs that have to be
rejected for scope or design reasons.

## Reporting bugs

A good bug report includes:

1. **What you did** — the steps to reproduce.
2. **What you expected** to happen.
3. **What actually happened** (screenshots or a short screen recording help a lot).
4. **Environment** — Obsidian version, operating system, Focus First version, and
   whether the [Tasks plugin](https://obsidian.tasks.org/) is installed.
5. A **minimal example** — one or two tasks that trigger the problem, if relevant.

## Development setup

The full setup (test vault, symlink, watch mode, reloading the plugin) is
documented in **[DEV.md](DEV.md)**. In short:

```bash
nvm use          # activate the Node version from .nvmrc
npm install      # install dependencies
npm run dev      # start esbuild in watch mode
```

## Before you open a pull request

Run all three checks locally — CI runs the same ones and a red build will block
the merge:

```bash
npm run lint     # eslint (incl. eslint-plugin-obsidianmd rules)
npm test         # vitest — all tests must pass
npm run build    # type-check + production bundle
```

If you change behavior, **add or update tests**. The project keeps high coverage;
you can check yours with:

```bash
npm run test:coverage
```

## Coding guidelines

- **TypeScript, strict mode.** Match the style of the surrounding code — naming,
  comment density, and idioms.
- **No custom styling where an Obsidian native class or design token exists.** The
  view is built from standard Obsidian classes and CSS variables on purpose.
- **Respect the Obsidian API guidelines** enforced by `eslint-plugin-obsidianmd`
  (sentence-case UI text, no forbidden Node.js imports in plugin code, command IDs
  must not repeat the plugin ID, etc.). `npm run lint` will tell you.
- **Keep changes focused.** One logical change per pull request. Unrelated cleanups
  belong in their own PR.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/).
The release script generates the changelog from them, so the prefix matters:

- `feat:` — a new user-facing feature (→ **Features** in the release notes)
- `fix:` — a bug fix (→ **Fixes**)
- `chore:`, `ci:`, `test:`, `docs:`, `style:`, `build:`, `refactor:`, `perf:` —
  housekeeping; these are omitted from the generated release notes

Example:

```
fix(settings): keep folder path indentation when removing a tag

Co-Authored-By: ...
```

Use an optional scope in parentheses (`feat(view): ...`) to point at the affected
area.

## Pull request checklist

- [ ] There is a related issue (for anything beyond a trivial fix).
- [ ] `npm run lint`, `npm test`, and `npm run build` all pass.
- [ ] New or changed behavior is covered by tests.
- [ ] Commits follow Conventional Commits.
- [ ] The PR description explains **what** changed and **why**.

## Releases

Releases are cut by the author with `release.sh` (see the
[release section in DEV.md](DEV.md#build-production-release)). Contributors do not
need to bump versions or create tags — please leave `manifest.json`,
`package.json`, and `versions.json` version numbers unchanged in your PR.

## Questions

Not sure about something? Open an issue with the **question** label. Thanks for
helping make Focus First better.

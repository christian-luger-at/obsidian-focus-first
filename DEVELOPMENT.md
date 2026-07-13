# Focus First Development Guide

This document explains how to activate code changes automatically in the plugin inside [Obsidian](https://obsidian.md).

## Prerequisites

### Node.js with nvm

This project uses **nvm** (Node Version Manager). Make sure you have nvm installed.

### 1. Create a test vault

If you do not already have a test vault, create one now (or open your existing test vault):

#### Option A: Using the Obsidian UI

1. Open Obsidian
2. Click the vault icon in the top left
3. Choose **Create new vault**
4. Enter a name (for example, "Plugin Test")
5. Choose a location (for example, `~/dev/obsidian-focus-first-vault/Plugin-Test`)
6. Click **Create**

#### Option B: Manual (existing vault)

If your test vault already exists, skip this step.

### 2. Link the plugin to Obsidian (symlink)

Create the plugin folder and add a symlink to the vault's plugin directory:

```bash
mkdir -p ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins

ln -s ~/dev/obsidian-focus-first ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins/focus-first
```

Verify that the symlink was created correctly:

```bash
ls -la ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins/focus-first
```

You should see something like this (macOS usually shows the full target path):

```bash
focus-first -> /Users/christian/dev/obsidian-focus-first
```

> [!tip]
> It is normal for `ls -la` to show the full path `/Users/...` — this is not a misconfiguration.

### 3. Install project dependencies (important)

Make sure the correct Node version is active and install dependencies:

```bash
nvm use # activate the Node version defined in .nvmrc
npm install # install all dependencies (esbuild, typescript, ...)
```

> [!important]
> `npm run dev` will fail if you do not run `npm install` first.

### 4. Start the development server (watch mode)

Now start the dev server (esbuild in watch mode):

```bash
nvm use
npm run dev
```

> [!tip]
> You can start the dev server before opening the vault; however, it is recommended to create the vault and symlink first so Obsidian loads the correct `main.js`.

This starts **esbuild in watch mode**, which automatically bundles your TypeScript files into `main.js` whenever you save.

### 5. Load the plugin in Obsidian

1. Open Obsidian with your test vault (if it is not already open)
2. Go to **Settings → Community plugins → Installed plugins**
3. Enable the "Focus First" plugin if it is disabled

### 6. Reload the plugin after code changes

After every change:

1. Save the file (Cmd+S)
2. Wait about 1-2 seconds for `npm run dev` to bundle the new `main.js`
3. Open the **Command Palette** with Cmd+P
4. Type `Reload` and choose **Reload plugins**

That’s it! Your updated plugin is now active.

Note: You can start the dev server before opening the vault; however, it is recommended to create the vault and symlink first so Obsidian loads the correct `main.js`.

## Folder structure

```bash
src/
  main.ts            # plugin entry point and lifecycle management
  settings.ts        # settings interface, defaults, SettingTab UI, path suggesters
  TaskView.ts        # custom Leaf View — the matrix panel (render orchestration)
  taskScanner.ts     # vault/folder task discovery via metadataCache; hide/future rules
  matrixClassifier.ts # Eisenhower matrix classification + "why here" reason
  taskSorting.ts     # pure sort/group/date-bucket logic
  taskRenderer.ts    # task row rendering + detail popover + row actions
  taskEmptyStates.ts # onboarding / no-matches / eliminate-hint panels
  taskDragDrop.ts    # quadrant drop target + re-tagging
  tasksFormat.ts     # Tasks-plugin line formatting (dates, priority, canonicalize)
  quickAdd.ts        # quick-add helpers + vault append
  quickAddModal.ts   # fallback quick-add dialog
  inboxSetupModal.ts # first-use inbox target dialog
  tasksPlugin.ts     # Tasks-plugin detection / create API bridge
  focusSection.ts    # focus-section selection shared by view + embed block
  focusDataBlock.ts  # `focus-first-tasks` code block (show-focus mode)
  wrappedTasksBlock.ts # `focus-first-tasks` code block (Tasks-query mode)
  i18n.ts            # EN/DE translations
  tests/             # one *.test.ts per module (Vitest)
    __mocks__/obsidian.ts   # minimal Obsidian API stubs for testing
```

## Build commands

| Command | Description |
| --- | --- |
| `npm run dev` | Watch mode for development (esbuild recompiles on changes) |
| `npm run build` | Production build with TypeScript type check and minification |
| `npm run lint` | Run ESLint with Obsidian-specific rules |
| `npm test` | Run all unit and integration tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode, re-runs on every file save |
| `npm run test:coverage` | Run tests and print a coverage report |

## Testing

Tests live in `src/tests/` and use [Vitest](https://vitest.dev). Because Obsidian is not available in a Node environment, a minimal stub is provided in `src/tests/__mocks__/obsidian.ts` and aliased via `vitest.config.ts`.

```bash
# Run once
npm test

# Watch mode during development
npm run test:watch

# Measure code coverage
npm run test:coverage
```

The coverage report shows statement, branch, function, and line coverage for all files in `src/` (except `main.ts` and `TaskView.ts`, which require a live Obsidian environment).

### What is tested

| File | Scope | What is covered |
| --- | --- | --- |
| `settings.test.ts` | Unit | `DEFAULT_SETTINGS` values and type contract |
| `settings.test.ts` | Integration | `FocusFirstSettingTab` renders without errors for both scope options |
| `settings.test.ts` | Integration | `onChange` callbacks for scope dropdown, folder input, urgency days, and quadrant tags |
| `settings.test.ts` | Integration | `saveSettings` is called with correct values; invalid urgency inputs are rejected |
| `settings.test.ts` | Integration | `loadSettings` merge logic — defaults, partial, and full overrides |
| `matrixClassifier.test.ts` | Unit | Urgency logic — due today, overdue, within/beyond threshold, no date |
| `matrixClassifier.test.ts` | Unit | Importance logic — priority in/not in list, no priority |
| `matrixClassifier.test.ts` | Unit | All four quadrant combinations (urgent × important) |
| `matrixClassifier.test.ts` | Unit | Manual tag override — all four tags, case-insensitive, first tag wins |
| `matrixClassifier.test.ts` | Integration | Completed tasks excluded, mixed task list, custom tag configuration |

### Adding new tests

1. Create a `*.test.ts` file inside `src/tests/`
2. Add any new Obsidian symbols your code uses to `src/tests/__mocks__/obsidian.ts`
3. Run `npm test` to verify

## Demo vault

A generator script produces a realistic product-management demo vault, so you can exercise the plugin against a large, varied dataset — handy for manual testing, screenshots, and demos.

```bash
node scripts/gen-demo-vault.mjs            # writes ./demo-vault
node scripts/gen-demo-vault.mjs my-vault   # or a custom output directory
```

It creates **400+ notes** organised with the [PARA](https://fortelabs.com/blog/para/) method — `0 Inbox`, `1 Projects`, `2 Areas` (incl. Products), `3 Resources` (Knowledge, Insights, People, Books, Meetings), `4 Archive`, plus `Maps` MOCs — all cross-linked with `[[wikilinks]]` and carrying YAML frontmatter. Meeting notes embed action items.

It also generates exactly **100 checkbox tasks** that exercise the classification:

| Dimension | Spread |
| --- | --- |
| Status | 70 open `[ ]`, 30 done `[x]` (with a `✅` date) |
| Due date | 20 overdue · 30 today/this week · 20 upcoming · 30 no date |
| Priority | balanced across 🔺⏫🔼🔽⏬, some none |
| Size | `#s` / `#m` / `#l` mixed, some none |
| Value | some `#highvalue` / `#lowvalue` (for the Value/Effort matrix) |

Notes:

- The RNG uses a fixed seed, so the structure is stable across runs; **due dates are relative to the day you run it**.
- The output directory (`demo-vault/`) and any zip are git-ignored — the vault never lands in a commit or a release build.
- To try it: open the generated folder as a vault in Obsidian, then symlink the plugin into it (see [step 2](#2-link-the-plugin-to-obsidian-symlink) above). To share it, zip the folder: `zip -r focus-first-demo-vault.zip demo-vault`.
- The generator lives at [`scripts/gen-demo-vault.mjs`](scripts/gen-demo-vault.mjs) — edit the content pools and distributions there. It currently emits only open/done tasks (no `#focus`, `#hide`, or cancelled states).

## Build production release

### 1. Bump the version

The version number lives in three places: `package.json`, `manifest.json`, and `versions.json`. You can bump it automatically or manually.

#### Option A — automated (`--bump`)

Pass `--bump patch|minor|major` to the release script (or use the matching npm shortcut). This runs `npm version <type>`, which bumps `package.json` and — via the existing `version-bump.mjs` hook — keeps `manifest.json` and `versions.json` in sync, then commits the result as `chore: bump version to vX.Y.Z`:

```bash
bash release.sh --bump patch   # 1.0.1 → 1.0.2 — bug fixes
bash release.sh --bump minor   # 1.0.1 → 1.1.0 — new features, backwards compatible
bash release.sh --bump major   # 1.0.1 → 2.0.0 — breaking changes
```

This requires a clean working tree (commit or stash any pending changes first). The script then continues straight into building (step 2). Combine with `--publish` (or use the `release:patch` / `release:minor` / `release:major` npm scripts below) to bump, build, and publish in one command.

#### Option B — manual

Update `manifest.json` and `package.json` by hand, then commit:

```bash
# Edit version in manifest.json and package.json (e.g. 1.0.0 → 1.1.0)
git add manifest.json package.json
git commit -m "chore: bump version to 1.1.0"
git push
```

### 2. Build and package

Run the release script — it runs all tests, builds the production bundle, and copies the three required files into `releases/v<version>/`:

```bash
npm run release
```

Output: `releases/v1.1.0/` containing `main.js`, `manifest.json`, `styles.css`.

### 3. Create a GitHub release

You have two options:

#### Option A — automated (`--publish`)

The release script can also tag, push, and publish the GitHub release for you. This is **optional**: omit `--publish` (or just run `npm run release`) to build locally only.

```bash
npm run release:publish
# equivalent to: bash release.sh --publish

# override the auto-generated notes with your own text:
bash release.sh --publish --notes "Adds collapsible settings sections"
```

**Release notes are generated automatically** from the [Conventional Commits](https://www.conventionalcommits.org/) since the previous tag: `feat:` commits become **Features**, `fix:` commits become **Fixes**, and non-conventional subjects go under **Other** (noise like `chore:` / `ci:` / `test:` / `docs:` is dropped). The script prints a preview before the publish confirmation. Pass `--notes "…"` to override.

To bump the version, build, and publish in a single command, use the combined shortcuts (these chain `--bump <type> --publish`):

```bash
npm run release:patch   # bug fixes
npm run release:minor   # new features
npm run release:major   # breaking changes
```

Before publishing, the script checks that:

- the [GitHub CLI](https://cli.github.com/) (`gh`) is installed and authenticated (`gh auth login`)
- the working tree is clean (the version-bump commit from step 1 must already be in place)
- the tag `<version>` doesn't already exist

It then asks for confirmation (`Publish X.Y.Z to GitHub? [y/N]`) before pushing the tag and creating the release — nothing is pushed without that confirmation, even with `--publish` set.

> [!important]
> The release tag must match the `version` in `manifest.json` **exactly, without a `v` prefix** (e.g. `1.1.0`, not `v1.1.0`). Obsidian's community-plugin store and the in-app auto-updater only recognise releases tagged this way. `release.sh` already tags without the prefix.

#### Option B — manual

```bash
# Create a git tag that exactly matches the manifest version — no "v" prefix
git tag 1.0.0
git push origin 1.0.0

# Create the GitHub release and attach the three plugin files
gh release create 1.0.0 \
  releases/v1.0.0/main.js \
  releases/v1.0.0/manifest.json \
  releases/v1.0.0/styles.css \
  --title "1.0.0" \
  --notes "Initial release with a basic implementation"
```

Either way, the release is now visible on GitHub with the three files as downloadable artifacts.

> [!tip]
> To install the release in Obsidian manually: download all three files and place them in `.obsidian/plugins/focus-first/` inside your vault.

## Submit the plugin to the Obsidian Community store

Getting the plugin into the in-app **Community Plugins** browser is a **one-time** pull request against Obsidian's registry. The store serves the very same GitHub release artifacts, so a single correctly-tagged release (see step 3 above — tag **without** the `v` prefix) covers both manual installs and the store.

### Before you submit — checklist

Submissions are checked by an automated bot **and** a human reviewer. Make sure:

- **`manifest.json`** sits in the repo root with a unique `id` (lowercase, hyphenated, no spaces, and must not contain `obsidian` or `plugin`), a `name` that doesn't start with "Obsidian", a concise `description` that doesn't start with the plugin name, plus `author`, `minAppVersion`, and `isDesktopOnly`.
- **`versions.json`** maps each released plugin version to its minimum Obsidian version.
- A **`LICENSE`** file and a **`README.md`** (what it does + how to use it) exist.
- No leftover sample-plugin code, no `console.log`, no obfuscated code — the source is public and reviewable.
- A **GitHub release** exists whose **tag equals the `manifest.json` version exactly, with no `v` prefix** (e.g. `1.0.0`), with `main.js`, `manifest.json`, and `styles.css` attached as assets.

Run `npm run lint` and `npm test`, then cut the release with `npm run release:publish` (or `release:patch` / `release:minor` / `release:major`).

### First-time submission (one-off)

1. Cut the release (above) so the tag and the three assets exist.
2. Fork [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases) and append your plugin to the **end** of `community-plugins.json`:

   ```json
   {
     "id": "focus-first",
     "name": "Focus First",
     "author": "Christian Luger",
     "description": "Prioritize your tasks with the Eisenhower matrix.",
     "repo": "christian-luger-at/obsidian-focus-first"
   }
   ```

   - `repo` is the `user/repo` slug — **not** a full URL.
   - Keep the JSON valid and don't reorder existing entries.
3. Open a **pull request** to `obsidianmd/obsidian-releases` and fill in the PR template (it asks you to confirm the checklist).
4. The **automated bot** validates the repo and release — fix anything it flags. Then a **maintainer reviews the code manually**; depending on the queue this can take days to a few weeks.
5. Once the PR is merged, the plugin shows up in **Settings → Community plugins → Browse** for everyone.

### Ongoing updates (after acceptance)

No further PR is ever needed. For each update:

1. Bump `manifest.json` **and** `versions.json` (the `--bump` flag does both).
2. Cut a new release tagged with the exact new version, no `v` prefix, with the three assets — e.g. `npm run release:patch` / `release:minor` / `release:major`.
3. Obsidian clients detect the new release automatically and offer the update.

> [!important]
> The plugin `id` is **permanent** once accepted — changing it later breaks users' saved settings and the update path. Double-check `id` (and that it's unique in `community-plugins.json`) before submitting.

## Additional resources

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian API Docs](https://docs.obsidian.md)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [Submit your plugin (official guide)](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [Community plugins registry (`obsidian-releases`)](https://github.com/obsidianmd/obsidian-releases)

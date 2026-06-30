# Focus First Development Guide

This document explains how to activate code changes automatically in the plugin inside [[Obsidian]].

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

ln -s ~/dev/obsidian-focus-first ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins/focus-first-matrix
```

Verify that the symlink was created correctly:

```bash
ls -la ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins/focus-first-matrix
```

You should see something like this (macOS usually shows the full target path):

```bash
focus-first-matrix -> /Users/christian/dev/obsidian-focus-first
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
  main.ts          # plugin entry point and lifecycle management
  settings.ts      # settings interface, defaults, and SettingTab UI
  TaskView.ts      # custom Leaf View — task list panel
  taskScanner.ts   # vault/folder task discovery via metadataCache
  i18n.ts          # EN/DE translations
  matrixClassifier.ts          # Eisenhower matrix classification logic
  tests/
    settings.test.ts           # unit & integration tests for settings
    matrixClassifier.test.ts   # unit & integration tests for matrix classifier
    __mocks__/obsidian.ts      # minimal Obsidian API stubs for testing
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
| `settings.test.ts` | Integration | `FokusFirstSettingTab` renders without errors for both scope options |
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

## Build production release

### 1. Bump the version

The version number lives in two places: `manifest.json` and `package.json`. Update both manually, then commit:

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

```bash
# Create a git tag matching the version
git tag v1.0.0
git push origin v1.0.0

# Create the GitHub release and attach the three plugin files
gh release create v1.0.0 \
  releases/v1.0.0/main.js \
  releases/v1.0.0/manifest.json \
  releases/v1.0.0/styles.css \
  --title "v1.0.0" \
  --notes "Initial release with a basic implementation"
```

The release is now visible on GitHub with the three files as downloadable artifacts.

> [!tip]
> To install the release in Obsidian manually: download all three files and place them in `.obsidian/plugins/focus-first-matrix/` inside your vault.

## Additional resources

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian API Docs](https://docs.obsidian.md)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)

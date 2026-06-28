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
  tests/
    settings.test.ts          # unit & integration tests for settings
    __mocks__/obsidian.ts     # minimal Obsidian API stubs for testing
```

## Build commands

- **`npm run dev`** – watch mode for development (esbuild recompiles on changes)
- **`npm run build`** – production build with TypeScript type check and minification
- **`npm run lint`** – run ESLint with Obsidian-specific rules
- **`npm test`** – run all unit and integration tests (Vitest)
- **`npm run test:watch`** – run tests in watch mode, re-runs on every file save

## Testing

Tests live in `src/tests/` and use [Vitest](https://vitest.dev). Because Obsidian is not available in a Node environment, a minimal stub is provided in `src/tests/__mocks__/obsidian.ts` and aliased via `vitest.config.ts`.

```bash
# Run once
npm test

# Watch mode during development
npm run test:watch
```

### What is tested

| File | Scope | What is covered |
|---|---|---|
| `settings.test.ts` | Unit | `DEFAULT_SETTINGS` values and type contract |
| `settings.test.ts` | Integration | `FokusFirstSettingTab` renders without errors for both scope options |
| `settings.test.ts` | Integration | `saveSettings` is called and captures each field change correctly |
| `settings.test.ts` | Integration | `loadSettings` merge logic — defaults, partial, and full overrides |

### Adding new tests

1. Create a `*.test.ts` file inside `src/tests/`
2. Add any new Obsidian symbols your code uses to `src/tests/__mocks__/obsidian.ts`
3. Run `npm test` to verify

## Build production release

When the plugin is ready:

```bash
npm run build
```

This creates the optimized `main.js`. Then:

1. Copy `main.js`, `manifest.json`, and optionally `styles.css` into a release directory
2. Create a GitHub release with these files as artifacts

## Additional resources

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian API Docs](https://docs.obsidian.md)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)

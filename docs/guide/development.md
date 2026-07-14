# Development

How to run the plugin from source and hack on it. For the full release and Community-store submission process, see [`DEVELOPMENT.md`](https://github.com/christian-luger-at/obsidian-focus-first/blob/main/DEVELOPMENT.md) in the repo.

## Prerequisites

- **Node.js** via [nvm](https://github.com/nvm-sh/nvm) (the version is pinned in `.nvmrc`).
- A test vault in Obsidian.

## Set up the dev loop

1. **Link the plugin into a test vault** with a symlink:

   ```bash
   mkdir -p ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins
   ln -s ~/dev/obsidian-focus-first \
     ~/dev/obsidian-focus-first-vault/Plugin-Test/.obsidian/plugins/focus-first
   ```

2. **Install dependencies** and start the watcher:

   ```bash
   nvm use
   npm install
   npm run dev   # esbuild in watch mode — rebuilds main.js on save
   ```

3. Enable **Focus First** under **Settings → Community plugins** in the test vault.
4. After a change, save, wait ~1–2 s for the rebuild, then run **Reload plugins** from the command palette.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Watch mode (esbuild recompiles on change). |
| `npm run build` | Production build with TypeScript type-check and minification. |
| `npm run lint` | ESLint with Obsidian-specific rules. |
| `npm test` | Run all unit/integration tests once (Vitest). |
| `npm run test:watch` | Tests in watch mode. |
| `npm run test:coverage` | Tests with a coverage report. |
| `npm run docs:dev` | Run this documentation site locally (VitePress). |

## Testing

Tests live in `src/tests/` and use [Vitest](https://vitest.dev). Because Obsidian isn't available in Node, a minimal stub is provided in `src/tests/__mocks__/obsidian.ts` and aliased via `vitest.config.ts`. Add any new Obsidian symbols your code uses to that stub.

## Demo vault

A generator script produces a realistic product-management demo vault (400+ notes, 100 varied tasks) to exercise the plugin against a large dataset:

```bash
node scripts/gen-demo-vault.mjs            # writes ./demo-vault
node scripts/gen-demo-vault.mjs my-vault   # or a custom output directory
```

It's PARA-structured and cross-linked; the tasks span statuses, due-date buckets, priorities, sizes, and `#highvalue`/`#lowvalue` tags. The output is git-ignored. See the [Demo vault section of `DEVELOPMENT.md`](https://github.com/christian-luger-at/obsidian-focus-first/blob/main/DEVELOPMENT.md#demo-vault) for details.

## Documentation

This site is built with [VitePress](https://vitepress.dev) from the `docs/` folder and deploys to GitHub Pages via `.github/workflows/docs.yml` on every push to `main`.

```bash
npm run docs:dev       # local preview at http://localhost:5173
npm run docs:build     # production build into docs/.vitepress/dist
npm run docs:preview   # serve the production build
```

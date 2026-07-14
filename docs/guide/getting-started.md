# Getting started

## Install the plugin

### From the Community Plugins browser

1. Open **Settings → Community plugins** in Obsidian.
2. Disable **Safe mode** if needed, then click **Browse**.
3. Search for "Focus First", click **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/christian-luger-at/obsidian-focus-first/releases).
2. Copy them into `<YourVault>/.obsidian/plugins/focus-first/`.
3. Reload Obsidian and enable **Focus First** under **Settings → Community plugins**.

## First steps

1. Enable the plugin under **Settings → Community plugins**.
2. Open the **Focus First** view via the ribbon icon or the command palette (`Open Focus First`).
3. Write tasks anywhere in your vault using standard Markdown checkboxes. Focus First understands the [Tasks plugin](https://obsidian.tasks.org/) syntax:

   ```markdown
   - [ ] Finish the quarterly report 📅 2026-07-02 🔺
   - [ ] Reply to client email #focus
   - [ ] Reorganize the archive folder ⏬
   ```

4. Open the Focus First view — your tasks are already sorted into the four quadrants.

## Compatibility

- Requires Obsidian **1.12.0** or later.
- Works on desktop and mobile.
- Works alongside the [Tasks plugin](https://obsidian.tasks.org/) — Focus First reads the same checkbox/due-date/priority syntax but doesn't require it (only the code block's [query mode](/guide/embedding) needs the Tasks plugin).

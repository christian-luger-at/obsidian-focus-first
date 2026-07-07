# Focus First

[![Version](https://img.shields.io/github/manifest-json/v/christian-luger-at/obsidian-focus-first?color=blue&label=version)](https://github.com/christian-luger-at/obsidian-focus-first/releases)
[![Obsidian minimum version](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.12.0-7c3aed)](https://obsidian.md)
[![License: source-available](https://img.shields.io/badge/license-source--available-lightgrey)](LICENSE)
[![Coverage](https://raw.githubusercontent.com/christian-luger-at/obsidian-focus-first/badges/coverage.svg)](https://github.com/christian-luger-at/obsidian-focus-first/actions/workflows/coverage.yml)
[![GitHub issues](https://img.shields.io/github/issues/christian-luger-at/obsidian-focus-first)](../../issues)

Stop guessing what to work on next. **Focus First** sorts your Obsidian tasks into the **Eisenhower matrix** — by urgency (due date) and importance (priority) — so the next right action is always obvious.

![Focus First view](docs/screen.gif)

It reads standard checkbox tasks from your vault (compatible with the [Tasks plugin](https://obsidian.tasks.org/) format — due dates, priorities, tags) and places each one automatically:

| | Urgent | Not urgent |
| --- | --- | --- |
| **Important** | 🔴 **Do** — handle now | 🔵 **Schedule** — plan for later |
| **Not important** | 🟠 **Delegate** — hand off if possible | ⚪ **Eliminate** — reconsider or drop |

No manual sorting needed — though you can still pin any task to a quadrant by hand.

## Features

- **Automatic classification** — tasks are sorted into quadrants based on their due date (urgency) and priority (importance), no setup needed beyond your existing Tasks-plugin workflow.
- **Manual quadrant tags** — add a tag like `#do` or `#eliminate` to any task to pin it to a quadrant, overriding the automatic logic.
- **Focus Tasks** — tag a task with `#focus` to pin it in a dedicated section above the matrix, so your top priorities never get buried.
- **Hide tasks** — tag a task with `#hide` (or use the hide button) to remove it from the matrix without completing it — useful for tasks you're not ready to act on yet.
- **Inline actions** — postpone a task's due date or change its priority straight from the view, without opening the note.
- **Future tasks** — tasks with a start (`🛫`) or scheduled (`⏳`) date still in the future aren't actionable yet; choose to show, dim, or hide them until their date arrives.
- **Drag & drop** — drag a task between quadrants to instantly re-tag it.
- **Search & filters** — search across all visible tasks, or filter by due-date bucket (overdue, today, this week, upcoming, no date).
- **Grouping & sorting** — group tasks within a quadrant by priority, due date, or alphabetically, with independently configurable primary/secondary sort order per quadrant.
- **Folder scope** — scan your entire vault or limit Focus First to a single folder (including sub-folders).
- **Adjustable font size** — scale the text size of the Focus First view independently of Obsidian's global font size.
- **Auto-refresh** — the view updates automatically whenever a task file changes.
- **Locale-aware dates** — due dates are formatted according to Obsidian's configured language.
- **English & German UI** — Focus First follows Obsidian's language setting.

## Getting started

1. Install the plugin (see below) and enable it under **Settings → Community plugins**.
2. Open the **Focus First** view via the ribbon icon or the command palette (`Open Focus First`).
3. Write tasks anywhere in your vault using standard Markdown checkboxes. Focus First understands the [Tasks plugin](https://obsidian.tasks.org/) syntax:

   ```markdown
   - [ ] Finish the quarterly report 📅 2026-07-02 🔺
   - [ ] Reply to client email #focus
   - [ ] Reorganize the archive folder ⏬
   ```

4. Open the Focus First view — your tasks will already be sorted into the four quadrants.

## How tasks are classified

A task is considered **urgent** if it has a due date that is today, overdue, or within the configured **urgency threshold** (default: 3 days — adjustable in settings, 0–364 days).

A task is considered **important** if it carries one of the priorities selected in **Important priorities** (default: 🔺 Highest and ⏫ High).

| Urgent | Important | Quadrant |
| --- | --- | --- |
| ✅ | ✅ | **Do** |
| ❌ | ✅ | **Schedule** |
| ✅ | ❌ | **Delegate** |
| ❌ | ❌ | **Eliminate** |

A task without a due date is never automatically urgent. A task without a priority (or with a priority not in your "important" list) is never automatically important — by default, only 🔺 and ⏫ count as important, while 🔼🔽⏬ do not.

### Overriding the automatic classification

Each quadrant has a configurable tag (defaults: `#do`, `#schedule`, `#delegate`, `#eliminate`). Adding that tag to a task always places it in the matching quadrant, regardless of its due date or priority. This is useful for tasks that don't fit the urgent/important model — for example, a low-priority task you've manually decided needs immediate attention.

## Embedding tasks in a note

A `focus-first-tasks` code block embeds a task list into any note — either a **Focus First section** (the focus list or one quadrant, matching the view exactly) or a **wrapped [Tasks-plugin](https://obsidian.tasks.org/) query** — each with an optional fallback message:

````markdown
```focus-first-tasks
show-focus do
empty-text 🎉 Nothing urgent and important
```
````

See **[docs/code-block.md](docs/code-block.md)** for both modes, all parameters, and more examples.

## Settings overview

| Section | What it controls |
| --- | --- |
| **Appearance** | Font size used throughout the Focus First view |
| **Task Sources** | Scan the entire vault, or limit to one folder (with sub-folders) |
| **Focus Task** | The tag used to pin tasks to the Focus Tasks section (default `#focus`) |
| **Hide Task** | The tag used to hide tasks from the matrix (default `#hide`) |
| **Future Tasks** | How to treat tasks whose start (`🛫`) or scheduled (`⏳`) date is still in the future: show, dim, or hide (default: show) |
| **Eisenhower Matrix** | Urgency threshold (days) and which priorities count as "important" |
| **Quadrants** | Per-quadrant accent color, manual override tag, sort order, and grouping |
| **Reset** | Restore every setting to its default value |

## Installing the plugin

### From the Community Plugins browser (once published)

1. Open **Settings → Community plugins** in Obsidian.
2. Disable **Safe mode** if needed, then click **Browse**.
3. Search for "Focus First" and click **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](../../releases).
2. Copy them into `<YourVault>/.obsidian/plugins/focus-first/`.
3. Reload Obsidian and enable **Focus First** under **Settings → Community plugins**.

## Compatibility

- Requires Obsidian **1.12.0** or later.
- Works on desktop and mobile.
- Works alongside the [Tasks plugin](https://obsidian.tasks.org/) — Focus First reads the same checkbox/due-date/priority syntax but doesn't require it (only the code block's query mode needs the Tasks plugin).

## Support

Found a bug or have a feature request? Please [open an issue](../../issues).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to report issues, set up the project, and open a pull request. Note that Focus First is **source-available**, not open source — please read the licensing note in the guide before sending code.

## License

© 2026 Christian Luger. Focus First is **source-available**: you may install, use, and privately modify it, but you may not redistribute it or publish modified versions. See [LICENSE](LICENSE) for the full terms.

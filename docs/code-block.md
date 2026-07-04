# The `focus-first-tasks` code block

A `focus-first-tasks` code block embeds a task list into any note. It has two modes, and parameters use a simple `key value` form (no colons).

## Show a Focus First section

Add a `show-focus` line to render exactly the tasks Focus First would show for one of its sections — the focus list or a single quadrant — as a plain checklist:

````markdown
```focus-first-tasks
show-focus do
empty-text 🎉 Nothing urgent and important
```
````

`show-focus` accepts `focus`, `do`, `schedule`, `delegate`, or `eliminate`. The tasks are selected with Focus First's own classification (so they match the view exactly, including your urgency threshold, important priorities, quadrant tags, and hide tag) and the list stays in sync as tasks change. When the section is empty, the optional `empty-text` message is shown. This mode does **not** require the Tasks plugin.

## Wrap a Tasks-plugin query

Without a `show-focus` line, everything except the `empty-text` line is passed straight to the [Tasks plugin](https://obsidian.tasks.org/) as a query, so the full [Tasks query syntax](https://publish.obsidian.md/tasks/Queries/About+Queries) is available and the result is rendered by Tasks itself:

````markdown
```focus-first-tasks
not done
tags include #focus
sort by priority

empty-text 🎉 Nothing to focus on right now
```
````

When the query matches no tasks, the `empty-text` message is shown instead. (The dedicated `show-focus` key never clashes with Tasks-plugin instructions such as `show tree`, so those keep working inside the query.)

> [!note]
> The query mode requires the **Tasks plugin** to be installed and enabled — it renders the Tasks plugin's own output. Without it, the block shows a short notice. (The `show-focus` mode works without the Tasks plugin.)

## Parameters

| Parameter | Mode | Description |
| --- | --- | --- |
| `show-focus <section>` | Section | Render a Focus First section: `focus`, `do`, `schedule`, `delegate`, or `eliminate`. |
| `empty-text <message>` | Both | Message shown when nothing matches (optional). |
| *(any other line)* | Query | Passed to the Tasks plugin as part of the query. |

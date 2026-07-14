# Embedding tasks in a note

Sometimes you don't want to open the Focus First view - you want its tasks to appear **inside a normal note**: a project page listing its own "Do" items, a daily note showing today's focus list, a dashboard, a weekly review.

A **`focus-first-tasks`** code block does exactly that. It has **two modes**, and its parameters use a simple `key value` form (no colons).

## Two modes at a glance

| Mode | Add this | Renders | Needs the Tasks plugin? |
| --- | --- | --- | --- |
| **Section** | a `show-focus …` line | one of Focus First's own sections (the focus list or a quadrant) as a live checklist | No |
| **Query** | anything else | a full [Tasks-plugin](https://obsidian.tasks.org/) query, rendered by Tasks | Yes |

Pick **section mode** to mirror what Focus First already computes; pick **query mode** when you need the full power of a Tasks query.

## Section mode: mirror a Focus First section

Add a `show-focus` line naming the section you want:

````markdown
```focus-first-tasks
show-focus do
empty-text 🎉 Nothing urgent and important
```
````

`show-focus` accepts one of:

| Value | Renders |
| --- | --- |
| `focus` | your [focus / today-plan](/guide/focus-size-filters#focus-tasks-today-plan) list |
| `do` | the **Do** quadrant (urgent + important) |
| `schedule` | the **Schedule** quadrant |
| `delegate` | the **Delegate** quadrant |
| `eliminate` | the **Eliminate** quadrant |

What makes this powerful:

- **It matches the view exactly.** The tasks are selected with Focus First's own [classification](/guide/classification): your urgency threshold, important priorities, quadrant tags, and hide tag all apply, so an embedded `do` list is precisely what the view's Do quadrant shows.
- **It stays in sync.** Edit, complete, or re-tag a task anywhere in your vault and the embedded list updates.
- **It renders like a real task list.** Tasks go through Obsidian's Markdown renderer, so they pick up the same formatting - including the Tasks plugin's rendering when it's enabled. Without the Tasks plugin they simply appear as a plain checklist.
- **Checking a box completes the real task** in its source note, not just in the embed.
- **`empty-text`** sets the message shown when the section is empty (optional).

::: tip A couple of ideas
- On a **project note**, embed `show-focus do` to keep the project's urgent-and-important tasks in front of you.
- In your **daily note**, embed `show-focus focus` so your today-plan travels with the day.
:::

## Query mode: wrap a Tasks-plugin query

Leave out `show-focus`, and every line except `empty-text` is passed straight to the [Tasks plugin](https://obsidian.tasks.org/) as a query. The full [Tasks query syntax](https://publish.obsidian.md/tasks/Queries/About+Queries) is available, and the result is rendered by Tasks itself:

````markdown
```focus-first-tasks
not done
tags include #focus
sort by priority

empty-text 🎉 Nothing to focus on right now
```
````

When the query matches nothing, `empty-text` is shown instead. The dedicated `show-focus` key never clashes with Tasks instructions such as `show tree`, so those keep working inside the query.

::: warning
Query mode needs the **Tasks plugin** installed and enabled - it renders the Tasks plugin's own output. Without it, the block shows a short notice. (Section mode works without the Tasks plugin.)
:::

## Parameters

| Parameter | Mode | Description |
| --- | --- | --- |
| `show-focus <section>` | Section | Render a Focus First section: `focus`, `do`, `schedule`, `delegate`, or `eliminate`. |
| `empty-text <message>` | Both | Message shown when nothing matches (optional). |
| *(any other line)* | Query | Passed to the Tasks plugin as part of the query. |

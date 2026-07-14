# FAQ & troubleshooting

## Do I need the Tasks plugin?

No. Focus First reads standard Markdown checkboxes and the Tasks-plugin *syntax* (due dates, priorities, tags), but it works on its own. The only feature that requires the Tasks plugin is the **query mode** of the [embedded code block](/guide/embedding#query-mode-wrap-a-tasks-plugin-query).

## Why is my task in "Eliminate"?

Eliminate means **not urgent and not important**. A task lands there when it has **no due date within the urgency threshold** *and* **no priority in your "important" list** (by default, only 🔺 and ⏫ count). Add a due date (`📅`) and/or a higher priority, or lower the urgency threshold, in [Settings → Classification](/guide/settings). See [How tasks are classified](/guide/classification).

## Everything landed in one quadrant / the matrix looks empty

- If **everything is in Eliminate**, none of your tasks have a due date or an important priority yet - add `📅` dates and `🔺`/`⏫` priorities.
- If the **view is empty**, check that: your tasks use top-level `- [ ]` checkboxes; the [folder scope](/guide/settings) includes them; completed and `#hide`-tagged tasks are excluded by design; and, if you use the "include subtasks" setting, indented tasks aren't being filtered out.

## A task has a due date but isn't marked urgent

Urgency is bounded by the **urgency threshold** (default 3 days). A task due further out than that counts as *not urgent* until its due date gets closer. Raise the threshold in [Settings → Classification](/guide/settings) if you want a longer horizon.

## A task disappeared - where did it go?

Most likely it's **completed**, **`#hide`-tagged/snoozed**, or a **future task** (`🛫`/`⏳` start date ahead) with the "hide" option on. See [Hide & snooze](/guide/focus-size-filters#hide-snooze-tasks) and [Future tasks](/guide/focus-size-filters#future-tasks).

## In Value/Effort, why is (almost) everything "high effort"?

Effort comes from [task size](/guide/focus-size-filters#task-size), and **un-sized tasks count as high effort** on purpose - so they can't masquerade as quick wins. Tag tasks with `#s` / `#m` / `#l` to place them properly. See [The Value/Effort matrix](/methods/value-effort).

## Does Focus First change my notes?

Only when you ask it to. Viewing and classifying never touch your files. Completing a task, toggling a tag (focus, hide, quadrant, size, value), postponing a due date, changing priority, or dragging between quadrants **writes to that task's line** in its source note - and each such action offers a quick **Undo**.

## How does the focus list decide the order?

By importance (priority, then due date) - so #1 is your "frog". You can **drag to reorder** and the manual order is remembered. Set a **daily target** (e.g. 6 for Ivy Lee, 3 for MITs) and a subtle line marks where the list runs past it. See [Daily-planning methods](/methods/daily-planning).

## How is it different on mobile?

Rows collapse to just the title; **tap a row** to reveal its due date, priority, size, and actions, and tap the title to open the note. The whole view scrolls as one page, and filtering is trimmed to the text search.

## How do I reset everything?

**Settings → Focus First → Reset** restores every setting to its default value.

## Still stuck?

[Open an issue](https://github.com/christian-luger-at/obsidian-focus-first/issues) with what you expected and what you saw - a screenshot and an example task line help a lot.

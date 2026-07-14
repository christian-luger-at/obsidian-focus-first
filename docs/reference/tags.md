# Tags & signifiers

Every tag and symbol Focus First reads or writes, in one place. **All of Focus First's own tags are configurable** in [Settings](/guide/settings) - the values below are the defaults.

## Focus First tags

| Tag | Default | What it does | Where |
| --- | --- | --- | --- |
| Focus | `#focus` | Adds a task to the [focus / today-plan](/guide/focus-size-filters#focus-tasks-today-plan) list above the matrix. | Tags |
| Hide | `#hide` | [Hides / snoozes](/guide/focus-size-filters#hide-snooze-tasks) a task; combine with a start date to "hide until". | Tags |
| Size - small | `#s` | Marks a task as **small** - low effort / a quick win. | Tags |
| Size - medium | `#m` | Marks a task as **medium**. | Tags |
| Size - large | `#l` | Marks a task as **large** - high effort. | Tags |
| Quadrant - do | `#do` | Pins a task to **Do**, overriding automatic classification. | Quadrants |
| Quadrant - schedule | `#schedule` | Pins a task to **Schedule**. | Quadrants |
| Quadrant - delegate | `#delegate` | Pins a task to **Delegate**. | Quadrants |
| Quadrant - eliminate | `#eliminate` | Pins a task to **Eliminate**. | Quadrants |
| High value | `#highvalue` | Forces **high value** in the [Value/Effort matrix](/methods/value-effort), overriding the value source. | Value / Effort |
| Low value | `#lowvalue` | Forces **low value** in the Value/Effort matrix. | Value / Effort |

::: tip
Quadrant tags apply in the **Eisenhower** preset; `#highvalue` / `#lowvalue` apply in the **Value/Effort** preset. Sizes drive both the quick-wins filter and the effort axis.
:::

## Tasks-plugin signifiers

Focus First reads the same [Tasks plugin](https://obsidian.tasks.org/) syntax, so these come for free (the Tasks plugin itself is **not** required to use them):

| Symbol | Meaning | Used for |
| --- | --- | --- |
| `📅 2026-07-02` | Due date | Urgency / the Eisenhower horizontal axis |
| `🛫 2026-07-02` | Start date | "Not actionable until" - [future tasks](/guide/focus-size-filters#future-tasks) & "hide until" |
| `⏳ 2026-07-02` | Scheduled date | Same as start, for scheduling |
| `🔺` | Highest priority | Importance / value |
| `⏫` | High priority | Importance / value |
| `🔼` | Medium priority | Importance / value |
| `🔽` | Low priority | Importance / value |
| `⏬` | Lowest priority | Importance / value |
| `✅ 2026-07-02` | Done date | Written when you complete a task (with the Tasks plugin) |
| `🔁 every week` | Recurrence | Handled by the Tasks plugin on completion |

By default only `🔺` and `⏫` count as **important** - you can change which priorities count in [Settings → Classification](/guide/settings).

## Checkbox states

| Markdown | State |
| --- | --- |
| `- [ ]` | Open - appears in the matrix |
| `- [x]` / `- [X]` | Completed - excluded from the matrix |
| `- [-]` | Cancelled - treated as completed |

## Example

A single task can combine several of these:

```markdown
- [ ] Draft the launch plan 🔺 📅 2026-07-02 #m #focus
```

That's an open task, **highest** priority (important), **due** July 2 (urgent), **medium** size, pinned to the **focus** list.

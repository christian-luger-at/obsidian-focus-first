# Recipes & workflows

Concrete, end-to-end ways to run a method with Focus First. Steal one and adapt it.

## A focused workday (Ivy Lee)

The [Ivy Lee method](/methods/daily-planning#the-ivy-lee-method): at most six tasks, ordered, one at a time.

1. In [Settings → Tags](/guide/settings), leave the daily focus target at **6**.
2. At the **end of each day**, tag tomorrow's six most important tasks with `#focus` (wherever they live in your vault).
3. In the focus section, **drag them into priority order** - the order is remembered.
4. Tomorrow, work strictly **top to bottom**. The subtle line at position 6 warns you if you over-commit.
5. Un-done tasks keep their `#focus` tag and roll into the next day.

## Eat the frog every morning

The [Eat the Frog](/methods/daily-planning#eat-the-frog) method: do the biggest task first.

1. Each morning, make sure your single most important/dreaded task is **#1** in the focus list (drag it to the top).
2. Do **#1 before anything else** - before email, before the easy wins.
3. Everything after the frog feels downhill.

::: tip
Set the daily focus target to **1** or **3** ([MITs](/methods/daily-planning#mits-most-important-tasks)) if you prefer a tiny, non-negotiable list over a full six.
:::

## Triage a backlog by payoff (Value/Effort)

When you're deciding *what to work on next*, not *what's due*:

1. Switch the header dropdown to the **[Value/Effort](/methods/value-effort)** matrix.
2. Make sure tasks have **sizes** (`#s`/`#m`/`#l`) - un-sized ones count as high effort. Set sizes fast from each task's popover.
3. Clear **Quick Wins** first (high value, low effort) for momentum.
4. **Schedule** the **Big Bets** deliberately - tag the next action `#focus`.
5. Ignore the **Time Sinks**; drop or shrink the **Fill-ins**.

## Fill a 15-minute gap with quick wins

1. Open **search** in the header and enable the **Small** size filter.
2. The matrix now shows only your `#s` tasks - pick one and knock it out.
3. Turn the filter off when you're back to deep work.

See [Focus, size & filters](/guide/focus-size-filters#search-filters).

## A weekly review

1. Switch to **Eisenhower** and read the **Schedule** quadrant - this is your important-but-not-urgent work. Promote the right items to next week by tagging them `#focus`.
2. Skim **Eliminate** and actually delete or drop what doesn't belong.
3. **Snooze** anything not relevant yet: `#hide` with a start date, e.g. hide until next Monday.
4. Fix classifications: add missing due dates and priorities so tasks land where they should.

## A project dashboard note

Keep a project's actionable tasks on the project note itself:

````markdown
```focus-first-tasks
show-focus do
empty-text 🎉 Nothing urgent for this project
```
````

This mirrors Focus First's **Do** quadrant, stays in sync, and lets you check tasks off in place. See [Embedding tasks in a note](/guide/embedding).

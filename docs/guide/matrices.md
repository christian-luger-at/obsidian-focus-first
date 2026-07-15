# The two matrices

Focus First is a 2×2 view whose axes you can switch from the **dropdown in the header**. Same auto-classification, same "why here" explanation - only the axis inputs and quadrant labels change.

::: tip New to these methods?
This page covers *how to use* the two matrices in Focus First. For *why they exist* and how to think with them, see **[The Eisenhower matrix](/methods/eisenhower)** and **[The Value / Effort matrix](/methods/value-effort)**.
:::

## Eisenhower (Urgency × Importance)

The default. Tasks are placed by **urgency** (due date) and **importance** (priority) - see [How tasks are classified](/guide/classification).

<figure class="shot">
  <img class="light-only doc-shot" src="/screens/eisenhower-matrix-light.png" alt="The Eisenhower matrix in Focus First, with the focus list above the four quadrants">
  <img class="dark-only doc-shot" src="/screens/eisenhower-matrix-dark.png" alt="The Eisenhower matrix in Focus First, with the focus list above the four quadrants">
  <figcaption>The Eisenhower matrix: the focus list on top, the four quadrants below.</figcaption>
</figure>

## Value / Effort

An Impact/Effort-style matrix for deciding where your energy goes.

<figure class="shot">
  <img class="light-only doc-shot" src="/screens/value-effort-matrix-light.png" alt="The Value/Effort matrix in Focus First: Quick Wins, Big Bets, Fill-ins and Time Sinks">
  <img class="dark-only doc-shot" src="/screens/value-effort-matrix-dark.png" alt="The Value/Effort matrix in Focus First: Quick Wins, Big Bets, Fill-ins and Time Sinks">
  <figcaption>The same view with Value/Effort axes: Quick Wins, Big Bets, Fill-ins and Time Sinks.</figcaption>
</figure>

**Value** comes from a configurable source:

- **Priority** (default) - value = importance, a zero-extra-input proxy.
- **Manual tag only** - value comes purely from a `#highvalue` tag.

An override tag (`#highvalue` / `#lowvalue`, configurable) always wins, in either mode. **Due date is deliberately never a value source** - that is urgency, not value.

**Effort** comes from [task size](/guide/focus-size-filters#task-size): the sizes you mark as "low effort" (default: small) count as low effort; **un-sized tasks count as high effort**, so they never masquerade as quick wins.

::: tip
Dragging a task onto a Value/Effort quadrant re-classifies it by writing both axes at once - the value override tag and the size tag for the target effort.
:::

You configure the value source, the override tags, and the low-effort sizes under **[Settings → Value / Effort](/guide/settings)**.

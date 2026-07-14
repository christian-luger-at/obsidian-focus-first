# The Value / Effort matrix

Also known as the **Impact/Effort matrix**. Where Eisenhower sorts by *deadline*, this sorts by **payoff versus cost**: the return you get for the energy you spend.

## The idea

Your time and energy are the scarce resource. So the useful question often isn't "what's due?" but **"where do I get the most value for the least effort?"** Plotting tasks on two axes (how much **value** they deliver, and how much **effort** they take) makes the smart moves obvious:

<svg class="ff-matrix" viewBox="0 0 560 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Value versus Effort matrix: Quick Wins (high value, low effort), Big Bets (high value, high effort), Fill-ins (low value, low effort), Time Sinks (low value, high effort).">
  <title>The Value / Effort matrix</title>
  <text class="axis" x="200" y="26" text-anchor="middle">Low effort</text>
  <text class="axis" x="422" y="26" text-anchor="middle">High effort</text>
  <text class="axis" x="20" y="125" text-anchor="middle" transform="rotate(-90 20 125)">High value</text>
  <text class="axis" x="20" y="287" text-anchor="middle" transform="rotate(-90 20 287)">Low value</text>
  <rect class="cell prime" x="95" y="50" width="210" height="150" rx="12"/>
  <text class="title" x="200" y="120" text-anchor="middle">Quick Wins</text>
  <text class="sub" x="200" y="142" text-anchor="middle">Do first</text>
  <rect class="cell" x="317" y="50" width="210" height="150" rx="12"/>
  <text class="title" x="422" y="120" text-anchor="middle">Big Bets</text>
  <text class="sub" x="422" y="142" text-anchor="middle">Plan &amp; resource</text>
  <rect class="cell" x="95" y="212" width="210" height="150" rx="12"/>
  <text class="title" x="200" y="282" text-anchor="middle">Fill-ins</text>
  <text class="sub" x="200" y="304" text-anchor="middle">Spare moments</text>
  <rect class="cell" x="317" y="212" width="210" height="150" rx="12"/>
  <text class="title" x="422" y="282" text-anchor="middle">Time Sinks</text>
  <text class="sub" x="422" y="304" text-anchor="middle">Avoid</text>
</svg>

|                | Low effort                 | High effort                    |
| -------------- | -------------------------- | ------------------------------ |
| **High value** | **Quick Wins** - do first  | **Big Bets** - plan & resource |
| **Low value**  | **Fill-ins** - spare moments | **Time Sinks** - avoid       |

## What each quadrant is really about

- **Quick Wins (high value, low effort)** - the best return on your time. Do these first: they build momentum and deliver visible progress fast.
- **Big Bets (high value, high effort)** - the projects that genuinely matter but can't be squeezed in. Don't start them casually; plan them, break them down, and give them real time.
- **Fill-ins (low value, low effort)** - fine to knock out when you have a spare five minutes, but never let them push out a Quick Win or a Big Bet. Many are also safe to drop.
- **Time Sinks (low value, high effort)** - the money pit. Lots of effort, little return. Avoid, shrink, or cut.

## How to use it

1. Clear the **Quick Wins** first - fast, motivating, high payoff.
2. Deliberately schedule the **Big Bets** rather than hoping they happen.
3. Use **Fill-ins** to fill gaps, not to feel busy.
4. Say no to **Time Sinks**.

## In Focus First

Switch the view's axes to Value/Effort from the header dropdown. Focus First derives the two axes from data you already have:

- **Value** = your task **priority** by default (or a manual `#highvalue` / `#lowvalue` tag). Due date is deliberately *not* value - that's urgency.
- **Effort** = your **[task size](/guide/focus-size-filters#task-size)** (`#s` / `#m` / `#l`). Un-sized tasks count as high effort so they can't masquerade as quick wins.

See **[The two matrices](/guide/matrices)** for the exact configuration, and **[Focus, size & filters](/guide/focus-size-filters)** for how to tag sizes. The **Small** size filter is a fast "just show me the quick wins" lens.

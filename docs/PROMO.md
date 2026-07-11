# Promotion kit

Ready-to-paste copy and a checklist for announcing Focus First. Replace
`docs/screen.gif` references with the final hero image/GIF before posting.

---

## One-liner

Stop guessing what to work on next — Focus First sorts your Obsidian tasks into
the Eisenhower matrix (by due date and priority), so the next right action is
always obvious.

---

## Obsidian Forum — "Share & showcase" / Reddit r/ObsidianMD

**Title:** Focus First — auto-sort your tasks into the Eisenhower matrix

I built a plugin that takes your existing checkbox tasks and places each one
into an Eisenhower matrix automatically, based on its due date (urgency) and
priority (importance) — no manual sorting.

![Focus First](https://raw.githubusercontent.com/christian-luger-at/obsidian-focus-first/main/docs/screen.gif)

Highlights:

- **Automatic classification** into Do / Schedule / Delegate / Eliminate, using
  the Tasks-plugin syntax you already write (📅 due dates, 🔺⏫ priorities).
- **Focus section** — pin your top tasks above the matrix with `#focus`.
- **Details on demand** — hover a task for a popover that explains *why* it
  landed in its quadrant, plus one-click complete / hide / postpone / re-prioritise.
- **Hide & snooze** — hide a task, or hide it until a date and have it reappear
  on its own.
- **Drag & drop** between quadrants, search & filters, per-quadrant grouping.
- Works with or without the Tasks plugin. Desktop + mobile. English & German.

Install from **Settings → Community plugins → Browse → "Focus First"**.

Repo (MIT): https://github.com/christian-luger-at/obsidian-focus-first

Feedback and feature ideas very welcome!

---

## LinkedIn

LinkedIn rewards a personal "build in public" story over a feature list. Keep
the first 1–2 lines as a strong hook (only ~140 chars show before "see more"),
use short paragraphs with whitespace, attach the GIF/screenshot, and put the
**link in the first comment** (posts with external links in the body get
throttled). End with a question to drive comments. 3–5 hashtags.

### German

> Ich verzettele mich ständig bei To-do-Listen. Also habe ich mir ein Werkzeug gebaut, das mir sagt, was wirklich zuerst dran ist.
>
> Das Ergebnis ist „Focus First", ein kostenloses Open-Source-Plugin für Obsidian.
>
> Es nimmt meine ganz normalen Aufgaben und sortiert sie automatisch in die Eisenhower-Matrix: dringend gegen wichtig. Kein manuelles Einsortieren, nur Fälligkeitsdatum und Priorität.
>
> Was mir dabei am meisten hilft:
> • Jede Aufgabe landet automatisch in einem von vier Feldern (Erledigen, Einplanen, Delegieren, Eliminieren)
> • Ein Klick zeigt, WARUM eine Aufgabe dort gelandet ist
> • „Ausblenden bis Datum": weg jetzt, kommt von selbst zurück, wenn es relevant wird
>
> Gebaut habe ich es abends nebenbei, mit viel Test-Abdeckung und in Deutsch und Englisch.
>
> Wenn du Obsidian nutzt und deine Aufgaben eher verwaltest als abarbeitest, probier es aus. Link in den Kommentaren.
>
> Wie entscheidest du, was du als Nächstes angehst?
>
> #Obsidian #Productivity #PKM #OpenSource #BuildInPublic

First comment: `Repo und Installation: https://github.com/christian-luger-at/obsidian-focus-first`

### English

> I keep over-managing my to-do lists instead of actually doing them. So I built a tool that tells me what to work on first.
>
> Focus First is a free, open-source Obsidian plugin. It drops your existing tasks into the Eisenhower matrix automatically, by due date and priority. No manual sorting.
>
> My favourite part: hover any task and it tells you *why* it landed in its quadrant. Plus "hide until a date" so things resurface on their own.
>
> If you use Obsidian, give it a try. Link in the comments.
>
> How do you decide what to work on next?
>
> #Obsidian #Productivity #PKM #OpenSource #BuildInPublic

First comment: `Repo and install: https://github.com/christian-luger-at/obsidian-focus-first`

Tips: attach the interaction GIF (hover → popover → drag); post Tue–Thu morning;
reply to comments in the first hour; don't spam the link more than once.

---

## Obsidian Hub — plugin entry

For https://github.com/obsidian-community/obsidian-hub (add under
`03 - Plugins/`). Follow the Hub's plugin note template; key fields:

- **Plugin name:** Focus First
- **Plugin ID:** focus-first
- **Author:** Christian Luger
- **Description:** Sorts your tasks into the Eisenhower matrix automatically, by
  due date and priority, so the next action is obvious.
- **Repo:** https://github.com/christian-luger-at/obsidian-focus-first

---

## Social card copy (1280×640)

- **Headline:** Focus First
- **Subhead:** Stop guessing what to work on next.
- **Body:** Your Obsidian tasks, sorted by the Eisenhower matrix.
- Left: the panel screenshot; right: headline + subhead on a calm background.

---

## Store description (needs a PR to obsidianmd/obsidian-releases)

The description shown in the in-app plugin browser lives in
`community-plugins.json` in the `obsidianmd/obsidian-releases` repo, not in this
repo's `manifest.json`. To update it, open a small PR there changing this
plugin's `description` to:

> Sort your tasks into the Eisenhower matrix — Do, Schedule, Delegate, Eliminate
> — automatically by due date and priority, so the next action is obvious.

---

## Manual checklist (can't be automated)

- [ ] Capture the hero PNG + interaction GIF (see the README screenshot proposal)
      and replace `docs/screen.gif`.
- [ ] Upload a **Social preview** image via GitHub → Settings → General → Social
      preview (CLI can't do this).
- [ ] Post to the Obsidian Forum "Share & showcase" and r/ObsidianMD.
- [ ] Post the release in the Obsidian Discord #updates channel.
- [ ] Submit the plugin to the Obsidian Roundup newsletter (obsidianroundup.org).
- [ ] Add the Hub entry (PR to obsidian-community/obsidian-hub).
- [ ] Open the obsidian-releases PR for the store description (above).
- [ ] Optional: short demo video / Bluesky/Mastodon post with #obsidianmd.

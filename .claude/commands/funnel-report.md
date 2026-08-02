# /funnel-report - Generate Application Funnel Sankey Diagram

Generate a self-contained HTML page showing your application funnel as a Sankey diagram: where applications end up (ghosted, rejected, hired, still open) and, for rejections, how far they got first. Built from `job_search_tracker.csv` and the `documents/applications/*/outcome.md` archive. The output is a single `.html` file — no server, no dependencies — that opens directly in a browser.

## Step 0: Parse Arguments

- No argument → output to `reports/funnel-report.html`
- A path argument (e.g. `/funnel-report ~/Desktop/funnel.html`) → use that path
- `--open` flag → after writing, tell the user to open the file (cannot open a browser directly)

Create `reports/` if it does not exist.

If `job_search_tracker.csv` does not exist or has zero rows, say so and stop — there is nothing to diagram yet.

---

## Step 1: Collect and Classify Each Application

Read `job_search_tracker.csv` and, for each row, look for a matching `documents/applications/<company>_<role>/outcome.md` (fuzzy match on company+role: lowercase, ignore punctuation).

For every row, derive two things:

**a) `furthest_stage`** — the deepest interview stage reached, from the outcome.md checklist (in order, deepest first: `Offer received` → **Offer**, `Final round`/`Case interview`/`Technical interview` → **Interviewing**, `Phone screen` → **Screening**). Take the highest ticked box. No outcome.md, or no boxes ticked → `None`.
  - If no outcome.md exists at all, fall back to the tracker `status` column as a coarse proxy: `interview` → **Interviewing**, `offer` → **Offer**, anything else → `None`. Do not guess finer than that without the archive — this is a documented limitation, not a gap to fill in.

**b) `resolution`** — from the outcome.md `Status` field if present, else the tracker `status` column: `hired`, `offer_declined`, `no_response` (also matches `no response`), `open` (still `applied`/`interview`/`offer`/`in_progress`, no final status yet), or `rejected` (also folds in `interview_only` and `withdrawn` — a stalled process that never converted reads the same in a funnel as an explicit rejection).

Then assign each row to exactly one Sankey path:

| resolution | path |
|---|---|
| `no_response` | Applied → **Ghosted** (terminal) |
| `hired` | Applied → **Hired** (terminal) |
| `offer_declined` | Applied → **Offer** (terminal — offer was extended, then declined) |
| `open`, `furthest_stage` = None | Applied → **Active** (terminal — applied, nothing else known yet) |
| `open`, `furthest_stage` = Screening/Interviewing/Offer | Applied → **that stage node** (terminal — still in play at that stage) |
| `rejected`, `furthest_stage` = None | Applied → **Rejected** (terminal, direct — no stage reached) |
| `rejected`, `furthest_stage` = Screening/Interviewing/Offer | Applied → **that stage node** → **Rejected** |

A stage node (Screening / Interviewing / Offer) can therefore carry two kinds of rows at once — some terminate there (still active), some flow onward to Rejected — same as `Offer` can be reached via `offer_declined` (terminal) or via a later rejection (passthrough). Sum both when sizing the node; only draw the onward ribbon for the passthrough portion.

**No fabrication:** every row lands in exactly one bucket from the table above. Never invent a stage that wasn't recorded, and never guess `furthest_stage` beyond the tracker-status fallback in (a).

---

## Step 2: Compute Node and Link Sizes

- **Nodes:** `Applied` (root, count = total rows) plus every terminal/passthrough node from Step 1 that has at least one row (omit empty nodes — don't draw a zero-width node). Order the middle column by descending count (largest at top), matching a typical funnel read.
- **Links:** one link `Applied → X` per middle node (width = rows landing there, whether terminal or passthrough+terminal combined), plus one link `X → Rejected` per stage node that has a passthrough portion (width = just the passthrough count, not the node's full count).
- `Rejected` only appears as a node if at least one row resolves to it (directly or via passthrough).

---

## Step 3: Generate the HTML

Write a single self-contained HTML file. CSS inline in a `<style>` block. Draw the Sankey as **hand-generated inline SVG** — no charting library, no CDN, no external requests of any kind. The page must render fully offline on every open.

**Escaping (required):** HTML-escape `& < > " '` in every value interpolated into the page, including node/link labels and any `title`/tooltip text.

### Layout

```
┌───────────────────────────────────────────────────┐
│  🔀 Application Funnel      Generated: DATE        │
├─────────────┬───────────────────────┬──────────────┤
│             │  Ghosted   ▓▓▓▓▓▓▓▓▓  │              │
│             │  Screening ▓          │              │
│  Applied    │  Interviewing ▓▓      │  Rejected    │
│  (N)        │  Offer     ▓          │              │
│             │  Hired     ▓▓         │              │
│             │  Active    ▓▓▓        │              │
├─────────────┴───────────────────────┴──────────────┤
│  Legend + counts                                    │
└───────────────────────────────────────────────────┘
```

Three columns: `Applied` (single node, full height) on the left, the middle nodes from Step 2 stacked with small gaps between them, `Rejected` (single node, if present) on the right. Draw each link as a smooth cubic-Bezier ribbon between node edges (control points at the horizontal midpoint), width proportional to its row count, filled with a gradient from the source node's color to the target node's color at ~55% opacity so overlapping ribbons stay legible.

### Colour palette (CSS custom properties)

- `Applied` (root): `#64748b` (slate)
- `Active`: `#3b82f6` (blue)
- `Screening`: `#14b8a6` (teal)
- `Interviewing`: `#f59e0b` (amber)
- `Offer`: `#8b5cf6` (purple)
- `Hired`: `#22c55e` (green)
- `Ghosted`: `#a855f7` (violet)
- `Rejected`: `#ef4444` (red)

### Design spec

- **Font:** system-ui stack, no web fonts
- **Node bars:** solid fill in the node's colour, rounded corners, with a `<text>` label (name + count) beside or inside the bar depending on width — keep labels readable against the background, not squeezed into thin bars
- **Minimum node/link thickness:** give any node or link with count > 0 a visible minimum thickness (e.g. 4px) even if its true proportional size would round to nothing — sparse data (a handful of applications) must still show every path
- **Every SVG chart element** (the whole diagram, and/or each node/ribbon) has an `aria-label` or `<title>` describing what it represents, for accessibility
- **Legend:** small colour-swatch + label list below the diagram, one entry per node that appears
- **Responsive:** usable at 700px+ width; the SVG scales via `viewBox` rather than a fixed pixel size
- **Footer:** "Generated by Claude Code · ai-job-search · {ISO date}"

---

## Step 4: Write and Confirm

Write the complete HTML to the output path using the Write tool.

Then present:

> **Funnel diagram generated:** `<output path>`
>
> Open it in any browser — no server needed.
>
> **Summary:**
> - Total applications: N
> - Ghosted: N · Rejected: N · Hired: N · Still active: N
> - Of the applications that reached at least one interview stage, N were eventually rejected
>
> Re-run `/funnel-report` any time after adding new entries via `/outcome` to refresh the diagram.

---

## Design Principles

- **Self-contained.** One file, fully offline — the Sankey is inline SVG, no CDN or external requests of any kind.
- **Data-only.** This command reads and renders; it never writes to the tracker or archive.
- **Idempotent.** Re-running overwrites the previous report at the same path — no accumulation.
- **Graceful on sparse data.** With only a few rows, every node and link still gets a visible minimum thickness — never suppress a path just because its count is small.
- **No fabrication.** Every row's path comes directly from its recorded status and outcome.md stage checkboxes. Never infer a stage or outcome that wasn't recorded; the tracker-status fallback in Step 1 is a documented approximation, not a guess.

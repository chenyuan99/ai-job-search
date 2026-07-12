---
name: swelist-search
version: 1.0.0
description: >
  Use this skill to search tech internship and new-graduate software engineering
  job listings aggregated by SWE List (swelist.com) — a community tool that
  tracks positions from the SimplifyJobs GitHub repositories (Summer Internships
  and New-Grad-Positions). Covers SWE, data science, AI/ML, product management,
  quant finance, and hardware engineering roles posted globally. Trigger phrases:
  find tech internships, software engineering internship, new grad jobs, SWE
  internship search, entry-level tech roles, search swelist, internship listings,
  new graduate positions.
context: fork
allowed-tools: Bash(bun run .agents/skills/swelist-search/cli/src/cli.ts *)
---

# swelist Search Skill

Search tech **internship** and **new-graduate** job listings from the
[SWE List](https://swelist.com) community aggregator. Data is sourced from two
GitHub repositories maintained by SimplifyJobs and the Pitt Computer Science Club:

- [Summer2026-Internships](https://github.com/SimplifyJobs/Summer2026-Internships) —
  Summer 2026 internships (software engineering, data science, AI/ML, PM, quant, hardware)
- [New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) —
  Full-time new-graduate roles in SWE, quant, and PM

Both repos are updated daily by Simplify (career-page monitoring) and community
contributors. This skill fetches the raw markdown directly from GitHub — **no API
key, no authentication, zero runtime dependencies**.

> ⚠️ **Personal use only.** This skill fetches public GitHub raw content from
> SimplifyJobs/Pitt CSC community repositories. Keep query volume low and use this
> skill for personal job searching only.

## ⚠️ Scope: internships and new-grad roles only

This skill covers **internship and entry-level new-graduate positions** in tech.
It does not cover experienced-hire or senior roles. For broader job coverage use
`freehire-search` (global tech roles) or a regional portal skill.

## When to use this skill

- Find summer internships in software engineering, data science, or AI/ML
- Discover new-grad (entry-level full-time) tech positions
- Filter by role type (internship vs new-grad) and recency
- Get the apply link for a specific posting

## Commands

### Search listings

```bash
bun run .agents/skills/swelist-search/cli/src/cli.ts search [-q "<keywords>"] [flags]
```

Key flags:
- `--query, -q <text>` — keywords to filter by title or company (case-insensitive substring match)
- `--role <type>` — `internship` (default) | `newgrad` | `all`
- `--jobage <days>` — posted within N days (uses the listing's relative age)
- `--location <text>` — filter by location substring (case-insensitive)
- `--limit <n>` / `-n <n>` — max results to return. Default 25.
- `--format json|table|plain` — default `json`

### Fetch job detail

```bash
bun run .agents/skills/swelist-search/cli/src/cli.ts detail <id> [--format json|plain]
```

`id` is the `id` field from a search result (a URL-safe identifier derived from
company + role). Returns the full job record for that ID.

## Usage examples

```bash
# Software engineering internships, table view
bun run .agents/skills/swelist-search/cli/src/cli.ts search -q "software engineer" --format table

# New-grad roles, limit 20
bun run .agents/skills/swelist-search/cli/src/cli.ts search --role newgrad --limit 20 --format table

# All ML/AI internships posted in the last 7 days
bun run .agents/skills/swelist-search/cli/src/cli.ts search -q "machine learning" --jobage 7 --format table

# Internships in New York
bun run .agents/skills/swelist-search/cli/src/cli.ts search --location "New York" --format table

# Full detail for a specific posting
bun run .agents/skills/swelist-search/cli/src/cli.ts detail google-software-engineer-intern-abc123 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing a result's `id` to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

Search JSON is `{ "meta": { "count", "page", "total" }, "results": [...] }`; each
result carries `id`, `title`, `company`, `location`, `date`, `deadline` (null), and
`url`. Missing values are `null`. All errors are written to **stderr** as
`{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Data freshness

The SimplifyJobs repos are updated daily by automated monitoring and community
submissions. Positions are tracked with a relative age (`1d`, `2d`, `1mo`, etc.);
this skill converts relative ages to approximate absolute dates at fetch time.
Closed/inactive positions are excluded (they live in separate `README-Inactive.md`
files that this skill does not fetch).

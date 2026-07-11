#!/usr/bin/env bun
// Self-contained CLI for searching SWE List job listings from the SimplifyJobs
// GitHub repositories. No external CLI framework and zero runtime dependencies,
// so it runs anywhere `bun` is available with nothing installed.
//
// Data sources (public GitHub raw files, no API key required):
//   Summer 2026 Internships — https://github.com/SimplifyJobs/Summer2026-Internships
//   New-Grad Positions      — https://github.com/SimplifyJobs/New-Grad-Positions
//
// Override data source URLs for testing:
//   SWELIST_INTERNSHIP_URL=<url>
//   SWELIST_NEWGRAD_URL=<url>

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

// Short-flag aliases.
const ALIAS: Record<string, string> = { q: "query", n: "limit" }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-")) {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = ALIAS[name] ?? name
    const next = argv[i + 1]
    // A flag with no following value (or another flag next) is a boolean.
    let value: string | boolean = true
    if (next !== undefined && !next.startsWith("-")) {
      value = next
      i++
    }
    flags[key] = value
  }
  return flags
}

type FlagValue = string | boolean | string[] | undefined

function stringFlag(raw: FlagValue): string | undefined {
  if (typeof raw === "string") return raw
  return undefined
}

const HELP = `swelist-cli — search SWE List tech internship and new-grad job listings

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [flags] [--format json|table|plain]
  bun run src/cli.ts detail <id> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>   Keywords to filter by title or company (substring, case-insensitive).
  --role <type>        internship (default) | newgrad | all
  --jobage <days>      Posted within N days (approximate, based on listing age).
  --location <text>    Filter by location substring (case-insensitive).
  --page <n>           1-indexed page. Default 1.
  --limit, -n <n>      Max results per page. Default 25.
  --format <fmt>       json (default) | table | plain.

DETAIL
  <id>                 The id field from a search result.

EXAMPLES
  bun run src/cli.ts search -q "software engineer" --format table
  bun run src/cli.ts search --role newgrad --limit 20 --format table
  bun run src/cli.ts search -q "machine learning" --jobage 7 --format table
  bun run src/cli.ts search --location "New York" --format table
  bun run src/cli.ts detail google-software-engineer-intern-ab12cd34 --format plain

Data from SimplifyJobs/Summer2026-Internships and SimplifyJobs/New-Grad-Positions
(public GitHub, updated daily). Personal use only.
`

const VALID_ROLES = new Set(["internship", "newgrad", "all"])

function parseIntFlag(name: string, raw: FlagValue): number | null {
  const val = parseInt(raw as string, 10)
  if (isNaN(val)) {
    process.stderr.write(
      JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n",
    )
    return null
  }
  return val
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    // Validate numeric flags
    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    // Validate --role
    const rawRole = stringFlag(flags.role) ?? "internship"
    if (!VALID_ROLES.has(rawRole)) {
      process.stderr.write(
        JSON.stringify({
          error: `--role must be internship, newgrad, or all, got "${rawRole}"`,
          code: "BAD_ARG",
        }) + "\n",
      )
      return 1
    }

    const opts: SearchOpts = {
      query: stringFlag(flags.query),
      role: rawRole as SearchOpts["role"],
      jobage: flags.jobage ? Math.max(1, parseInt(flags.jobage as string, 10)) : 9999,
      location: stringFlag(flags.location),
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? Math.max(1, parseInt(flags.limit as string, 10)) : 25,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = { id, format: fmt === "plain" ? "plain" : "json" }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))

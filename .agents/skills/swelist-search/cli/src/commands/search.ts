import {
  fetchMarkdown,
  parseReadme,
  writeError,
  internshipUrl,
  newgradUrl,
  type JobResult,
  type RoleType,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  role: RoleType
  jobage: number // max age in days; 9999 = unlimited
  location?: string
  limit: number
  page: number
  format: "json" | "table" | "plain"
}

function matchesQuery(job: JobResult, query: string): boolean {
  const q = query.toLowerCase()
  return (
    job.title.toLowerCase().includes(q) ||
    (job.company ?? "").toLowerCase().includes(q)
  )
}

function matchesLocation(job: JobResult, location: string): boolean {
  return (job.location ?? "").toLowerCase().includes(location.toLowerCase())
}

function matchesAge(job: JobResult, maxDays: number): boolean {
  if (maxDays >= 9999) return true
  if (!job.date) return true // unknown age — include by default
  const posted = new Date(job.date).getTime()
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000
  return posted >= cutoff
}

// ---- renderers ----

function shortDate(date: string | null): string {
  return date ? date.slice(0, 10) : "—"
}

interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "ID", width: Math.max(2, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 40, cell: (r) => r.title },
    { header: "COMPANY", width: 24, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 22, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
    { header: "TYPE", width: 10, cell: (r) => r.role_type },
  ]
  const row = (cells: string[]) =>
    cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")

  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)} [${r.role_type}]`,
      `  id: ${r.id}`,
      `  ${r.url}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const now = new Date()
    const allJobs: JobResult[] = []

    const sources: Array<{ url: string; role: Exclude<RoleType, "all"> }> = []

    if (opts.role === "internship" || opts.role === "all") {
      sources.push({ url: internshipUrl(), role: "internship" })
    }
    if (opts.role === "newgrad" || opts.role === "all") {
      sources.push({ url: newgradUrl(), role: "newgrad" })
    }

    for (const source of sources) {
      const md = await fetchMarkdown(source.url)
      if (md === null) {
        // 404 from GitHub — skip this source gracefully
        continue
      }
      const jobs = parseReadme(md, source.role, now)
      allJobs.push(...jobs)
    }

    // Apply filters
    let filtered = allJobs
    if (opts.query) {
      filtered = filtered.filter((j) => matchesQuery(j, opts.query!))
    }
    if (opts.location) {
      filtered = filtered.filter((j) => matchesLocation(j, opts.location!))
    }
    if (opts.jobage < 9999) {
      filtered = filtered.filter((j) => matchesAge(j, opts.jobage))
    }

    // Deduplicate by id (same posting in both sources is theoretically possible)
    const seen = new Set<string>()
    const deduped = filtered.filter((j) => {
      if (seen.has(j.id)) return false
      seen.add(j.id)
      return true
    })

    const total = deduped.length
    const startIdx = (opts.page - 1) * opts.limit
    const page = deduped.slice(startIdx, startIdx + opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(page) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(page) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count: page.length, page: opts.page, total }, results: page }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}

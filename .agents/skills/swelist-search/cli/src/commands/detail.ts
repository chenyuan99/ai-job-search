import {
  fetchMarkdown,
  parseReadme,
  writeError,
  internshipUrl,
  newgradUrl,
  type JobResult,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const now = new Date()
    const sources: Array<{ url: string; role: "internship" | "newgrad" }> = [
      { url: internshipUrl(), role: "internship" },
      { url: newgradUrl(), role: "newgrad" },
    ]

    let found: JobResult | null = null

    for (const source of sources) {
      if (found) break
      const md = await fetchMarkdown(source.url)
      if (md === null) continue
      const jobs = parseReadme(md, source.role, now)
      const match = jobs.find((j) => j.id === opts.id)
      if (match) found = match
    }

    if (!found) {
      writeError(`job not found: "${opts.id}"`, "NOT_FOUND")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        found.title,
        `${found.company ?? "—"} · ${found.location ?? "—"}`,
        found.date ? `Posted: ${found.date}` : "",
        `Type: ${found.role_type}`,
        "",
        `URL: ${found.url}`,
        `id: ${found.id}`,
      ].filter((l, i) => i < 3 || l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(found, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

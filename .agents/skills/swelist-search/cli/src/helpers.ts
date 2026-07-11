// Data source: two public GitHub repositories maintained by SimplifyJobs /
// Pitt CSC, fetched as raw markdown (which embeds HTML tables). No API key or
// authentication required — these are public files.
//
// The two sources are:
//   INTERNSHIP_URL — Summer 2026 internships
//   NEWGRAD_URL    — New-grad full-time positions
//
// Both are overridable via env vars for testing (SWELIST_INTERNSHIP_URL,
// SWELIST_NEWGRAD_URL).

export const DEFAULT_INTERNSHIP_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md"
export const DEFAULT_NEWGRAD_URL =
  "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md"

export type RoleType = "internship" | "newgrad" | "all"

export function internshipUrl(): string {
  return (process.env.SWELIST_INTERNSHIP_URL ?? "").trim() || DEFAULT_INTERNSHIP_URL
}

export function newgradUrl(): string {
  return (process.env.SWELIST_NEWGRAD_URL ?? "").trim() || DEFAULT_NEWGRAD_URL
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "swelist-search-skill/1.0 (+https://github.com/SimplifyJobs)"

/**
 * Fetch a raw GitHub markdown file. Returns the text body.
 * Throws on network failure; returns null on 404.
 */
export async function fetchMarkdown(url: string): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/plain" },
      redirect: "follow",
    })
  } catch (e) {
    throw new Error(
      `could not reach ${url} (${e instanceof Error ? e.message : String(e)})`,
    )
  }
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`)
  }
  return response.text()
}

/** A job listing in the portal-skill contract shape. */
export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  deadline: string | null
  url: string
  /** Which source repo this came from */
  role_type: RoleType
}

// ---------------------------------------------------------------------------
// HTML table parsing
// ---------------------------------------------------------------------------

/** Strip all HTML tags from a string. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "")
}

/** Decode common HTML entities. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => {
      const cp = parseInt(d, 10)
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
    })
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h: string) => {
      const cp = parseInt(h, 16)
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
    })
}

/**
 * Extract all `<td>...</td>` cell contents from a `<tr>...</tr>` string.
 * Returns raw inner HTML for each cell.
 */
export function parseTdCells(trHtml: string): string[] {
  const cells: string[] = []
  // Match <td ...>...</td> — handle nested tags by tracking depth
  const tdRe = /<td(?:\s[^>]*)?>[\s\S]*?<\/td>/gi
  let m: RegExpExecArray | null
  while ((m = tdRe.exec(trHtml)) !== null) {
    // Strip the outer <td ...> and </td>
    const inner = m[0].replace(/^<td(?:\s[^>]*)?>/i, "").replace(/<\/td>$/i, "")
    cells.push(inner)
  }
  return cells
}

/**
 * Extract the first `href` from an HTML snippet that is NOT a simplify.jobs/p/ link.
 * This gives us the direct ATS application URL.
 */
export function extractApplyUrl(cellHtml: string): string | null {
  const hrefRe = /href="([^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(cellHtml)) !== null) {
    const href = m[1]
    // Skip simplify.jobs/p/ autofill links — we want the direct ATS URL
    if (!href.includes("simplify.jobs/p/")) {
      return href
    }
  }
  return null
}

/**
 * Convert a relative age string to an approximate YYYY-MM-DD date.
 * Uses the provided `now` date (or today) as the reference point.
 * Returns null for unrecognized formats.
 */
export function ageToDate(age: string, now: Date = new Date()): string | null {
  const s = age.trim().toLowerCase()
  let days = 0

  const dayMatch = s.match(/^(\d+)d$/)
  const weekMatch = s.match(/^(\d+)w$/)
  const moMatch = s.match(/^(\d+)mo$/)
  const yearMatch = s.match(/^(\d+)y$/)

  if (s === "0d" || s === "0") {
    days = 0
  } else if (dayMatch) {
    days = parseInt(dayMatch[1], 10)
  } else if (weekMatch) {
    days = parseInt(weekMatch[1], 10) * 7
  } else if (moMatch) {
    days = parseInt(moMatch[1], 10) * 30
  } else if (yearMatch) {
    days = parseInt(yearMatch[1], 10) * 365
  } else {
    return null
  }

  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * A simple djb2-like hash of a string, returning the first 8 hex digits.
 * Used to generate stable IDs.
 */
export function shortHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  }
  return h.toString(16).padStart(8, "0").slice(0, 8)
}

/**
 * Convert a string to a URL-safe slug: lowercase, keep alphanumerics and spaces,
 * replace sequences of non-alphanumeric chars with a single hyphen, trim hyphens.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

/**
 * Generate a stable ID for a job from its company, title, and URL.
 */
export function makeId(company: string, title: string, url: string): string {
  const compSlug = slugify(company)
  const titleSlug = slugify(title)
  const hash = shortHash(`${company}|${title}|${url}`)
  return `${compSlug}-${titleSlug}-${hash}`.replace(/-{2,}/g, "-")
}

/**
 * Extract the company name text from the Company cell HTML.
 * Handles: <strong><a href="...">Company</a></strong> and plain text.
 * Returns null for continuation rows (↳).
 */
export function parseCompanyCell(cellHtml: string): string | null {
  const text = decodeEntities(stripTags(cellHtml)).trim()
  if (text === "↳" || text === "") return null
  return text || null
}

/**
 * Parse the Location cell. Handles plain text and <details>/<summary> multi-location.
 * Returns the first location (or the summary text if multi-location).
 */
export function parseLocationCell(cellHtml: string): string | null {
  // For multi-location: <details><summary><strong>4 locations</strong></summary>...</details>
  // Return the summary text like "4 locations"
  const summaryMatch = cellHtml.match(/<summary>([\s\S]*?)<\/summary>/i)
  if (summaryMatch) {
    return decodeEntities(stripTags(summaryMatch[1])).trim() || null
  }
  const text = decodeEntities(stripTags(cellHtml)).trim()
  return text || null
}

/**
 * Check if a row's title indicates the listing is closed (🔒 icon).
 */
export function isClosed(title: string): boolean {
  return title.includes("🔒")
}

/**
 * Parse the HTML tables inside a SimplifyJobs README markdown file.
 * Returns an array of parsed job rows, including the source role_type.
 *
 * Table structure (columns by index):
 *   0: Company  1: Role/Title  2: Location  3: Application  4: Age
 */
export function parseReadme(
  markdown: string,
  roleType: Exclude<RoleType, "all">,
  now: Date = new Date(),
): JobResult[] {
  const results: JobResult[] = []
  let lastCompany = ""

  // Find all <tr>...</tr> blocks (including those that span multiple lines)
  // We skip the header rows by checking if the first cell is a <th>
  const trRe = /<tr>([\s\S]*?)<\/tr>/gi
  let m: RegExpExecArray | null

  while ((m = trRe.exec(markdown)) !== null) {
    const trInner = m[1]

    // Skip header rows (contain <th> elements)
    if (/<th/i.test(trInner)) continue

    const cells = parseTdCells(trInner)
    // Expect exactly 5 columns: Company, Role, Location, Application, Age
    if (cells.length < 4) continue

    const [companyCell, roleCell, locationCell, applicationCell] = cells
    const ageCell = cells[4] ?? ""

    // Parse company (handle ↳ continuation)
    const companyParsed = parseCompanyCell(companyCell)
    if (companyParsed !== null) {
      lastCompany = companyParsed
    }
    const company = lastCompany || null

    // Parse role/title
    const titleRaw = decodeEntities(stripTags(roleCell)).trim()
    if (!titleRaw) continue

    // Skip closed listings (🔒 in the title)
    if (isClosed(titleRaw)) continue
    // Strip emoji flags from titles (🎓, 🛂, 🔥, 🇺🇸 etc.) — keep readable text
    const title = titleRaw.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim()

    // Parse location
    const location = parseLocationCell(locationCell)

    // Extract apply URL
    const url = extractApplyUrl(applicationCell)
    // Skip rows with no apply link (closed or malformed)
    if (!url) continue

    // Parse age → date
    const ageText = decodeEntities(stripTags(ageCell)).trim()
    const date = ageToDate(ageText, now)

    const id = makeId(company ?? "", title, url)

    results.push({
      id,
      title,
      company: company || null,
      location,
      date,
      deadline: null,
      url,
      role_type: roleType,
    })
  }

  return results
}

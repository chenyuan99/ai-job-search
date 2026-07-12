import { describe, test, expect } from "bun:test"
import {
  stripTags,
  decodeEntities,
  parseTdCells,
  extractApplyUrl,
  ageToDate,
  makeId,
  slugify,
  shortHash,
  parseCompanyCell,
  parseLocationCell,
  isClosed,
  parseReadme,
} from "../src/helpers"

// ---------------------------------------------------------------------------
// stripTags
// ---------------------------------------------------------------------------
describe("stripTags", () => {
  test("removes simple tags", () => {
    expect(stripTags("<strong>Hello</strong>")).toBe("Hello")
  })

  test("removes tags with attributes", () => {
    expect(stripTags('<a href="https://example.com">Link</a>')).toBe("Link")
  })

  test("leaves plain text unchanged", () => {
    expect(stripTags("No tags here")).toBe("No tags here")
  })

  test("handles self-closing tags", () => {
    expect(stripTags("Before<br/>After")).toBe("BeforeAfter")
  })
})

// ---------------------------------------------------------------------------
// decodeEntities
// ---------------------------------------------------------------------------
describe("decodeEntities", () => {
  test("decodes &amp;", () => {
    expect(decodeEntities("Ship &amp; iterate")).toBe("Ship & iterate")
  })

  test("decodes &lt; and &gt;", () => {
    expect(decodeEntities("&lt;div&gt;")).toBe("<div>")
  })

  test("decodes &nbsp;", () => {
    expect(decodeEntities("Hello&nbsp;World")).toBe("Hello World")
  })

  test("decodes numeric decimal entities", () => {
    expect(decodeEntities("Caf&#233;")).toBe("Café")
  })

  test("decodes numeric hex entities", () => {
    expect(decodeEntities("Caf&#xE9;")).toBe("Café")
  })

  test("leaves unknown entities unchanged", () => {
    expect(decodeEntities("&unknown;")).toBe("&unknown;")
  })
})

// ---------------------------------------------------------------------------
// parseTdCells
// ---------------------------------------------------------------------------
describe("parseTdCells", () => {
  test("extracts cells from a simple row", () => {
    const tr = "<tr><td>Alpha</td><td>Beta</td><td>Gamma</td></tr>"
    const cells = parseTdCells(tr)
    expect(cells).toHaveLength(3)
    expect(cells[0]).toBe("Alpha")
    expect(cells[1]).toBe("Beta")
    expect(cells[2]).toBe("Gamma")
  })

  test("handles cells with HTML content", () => {
    const tr = `<tr><td><strong><a href="https://example.com">Acme</a></strong></td><td>Engineer</td></tr>`
    const cells = parseTdCells(tr)
    expect(cells).toHaveLength(2)
    expect(cells[0]).toContain("Acme")
    expect(cells[1]).toBe("Engineer")
  })

  test("returns empty array for no cells", () => {
    expect(parseTdCells("<tr></tr>")).toHaveLength(0)
  })

  test("handles cells with attributes on td", () => {
    const tr = `<tr><td align="center">Cell</td></tr>`
    const cells = parseTdCells(tr)
    expect(cells).toHaveLength(1)
    expect(cells[0]).toBe("Cell")
  })
})

// ---------------------------------------------------------------------------
// extractApplyUrl
// ---------------------------------------------------------------------------
describe("extractApplyUrl", () => {
  test("extracts the direct ATS URL, skipping simplify.jobs/p/ links", () => {
    const cellHtml = `<div align="center">
      <a href="https://boards.greenhouse.io/acme/jobs/123?utm_source=Simplify&ref=Simplify"><img src="apply.png" alt="Apply"></a>
      <a href="https://simplify.jobs/p/abc-def-123?utm_source=GHList"><img src="simplify.png" alt="Simplify"></a>
    </div>`
    expect(extractApplyUrl(cellHtml)).toBe(
      "https://boards.greenhouse.io/acme/jobs/123?utm_source=Simplify&ref=Simplify",
    )
  })

  test("returns null when only simplify.jobs/p/ links are present", () => {
    const cellHtml = `<a href="https://simplify.jobs/p/abc123">Apply</a>`
    expect(extractApplyUrl(cellHtml)).toBeNull()
  })

  test("returns null for empty cell", () => {
    expect(extractApplyUrl("")).toBeNull()
    expect(extractApplyUrl("<div></div>")).toBeNull()
  })

  test("accepts non-greenhouse ATS links", () => {
    const cellHtml = `<a href="https://jobs.ashbyhq.com/company/123/application?utm_source=Simplify">Apply</a>`
    expect(extractApplyUrl(cellHtml)).toBe(
      "https://jobs.ashbyhq.com/company/123/application?utm_source=Simplify",
    )
  })
})

// ---------------------------------------------------------------------------
// ageToDate
// ---------------------------------------------------------------------------
describe("ageToDate", () => {
  const NOW = new Date("2026-07-11T00:00:00Z")

  test("0d returns today", () => {
    expect(ageToDate("0d", NOW)).toBe("2026-07-11")
  })

  test("1d subtracts one day", () => {
    expect(ageToDate("1d", NOW)).toBe("2026-07-10")
  })

  test("7d subtracts 7 days", () => {
    expect(ageToDate("7d", NOW)).toBe("2026-07-04")
  })

  test("1mo subtracts ~30 days", () => {
    expect(ageToDate("1mo", NOW)).toBe("2026-06-11")
  })

  test("2mo subtracts ~60 days", () => {
    expect(ageToDate("2mo", NOW)).toBe("2026-05-12")
  })

  test("1w subtracts 7 days", () => {
    expect(ageToDate("1w", NOW)).toBe("2026-07-04")
  })

  test("1y subtracts ~365 days", () => {
    expect(ageToDate("1y", NOW)).toBe("2025-07-11")
  })

  test("unrecognized format returns null", () => {
    expect(ageToDate("yesterday", NOW)).toBeNull()
    expect(ageToDate("", NOW)).toBeNull()
    expect(ageToDate("abc", NOW)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// slugify + shortHash + makeId
// ---------------------------------------------------------------------------
describe("slugify", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world")
  })

  test("collapses consecutive non-alphanumerics", () => {
    expect(slugify("A & B")).toBe("a-b")
  })

  test("trims leading/trailing hyphens", () => {
    expect(slugify("  Hello  ")).toBe("hello")
  })

  test("handles empty string", () => {
    expect(slugify("")).toBe("")
  })
})

describe("shortHash", () => {
  test("returns 8 hex characters", () => {
    const h = shortHash("test")
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })

  test("is deterministic", () => {
    expect(shortHash("Google|Software Engineer Intern|https://example.com")).toBe(
      shortHash("Google|Software Engineer Intern|https://example.com"),
    )
  })

  test("differs for different inputs", () => {
    expect(shortHash("Google|Intern|https://a.com")).not.toBe(
      shortHash("Apple|Intern|https://a.com"),
    )
  })
})

describe("makeId", () => {
  test("combines company slug + title slug + hash", () => {
    const id = makeId("Google", "Software Engineer Intern", "https://example.com")
    expect(id).toMatch(/^google-software-engineer-intern-[0-9a-f]{8}$/)
  })

  test("is stable across calls with same inputs", () => {
    const id1 = makeId("Acme Corp", "Backend Engineer", "https://acme.com/jobs/1")
    const id2 = makeId("Acme Corp", "Backend Engineer", "https://acme.com/jobs/1")
    expect(id1).toBe(id2)
  })

  test("differs for different companies", () => {
    const id1 = makeId("Google", "SWE Intern", "https://example.com")
    const id2 = makeId("Apple", "SWE Intern", "https://example.com")
    expect(id1).not.toBe(id2)
  })
})

// ---------------------------------------------------------------------------
// parseCompanyCell
// ---------------------------------------------------------------------------
describe("parseCompanyCell", () => {
  test("extracts company name from anchor", () => {
    const cell = `<strong><a href="https://simplify.jobs/c/Google">Google</a></strong>`
    expect(parseCompanyCell(cell)).toBe("Google")
  })

  test("returns null for continuation row (↳)", () => {
    expect(parseCompanyCell("↳")).toBeNull()
    expect(parseCompanyCell("<td>↳</td>")).toBeNull()
  })

  test("handles plain text company", () => {
    expect(parseCompanyCell("Acme Corp")).toBe("Acme Corp")
  })

  test("returns null for empty cell", () => {
    expect(parseCompanyCell("")).toBeNull()
    expect(parseCompanyCell("  ")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseLocationCell
// ---------------------------------------------------------------------------
describe("parseLocationCell", () => {
  test("returns plain location text", () => {
    expect(parseLocationCell("San Francisco, CA")).toBe("San Francisco, CA")
  })

  test("extracts summary for multi-location <details>", () => {
    const cell = `<details><summary><strong>4 locations</strong></summary>NYC<br>Chicago, IL</details>`
    expect(parseLocationCell(cell)).toBe("4 locations")
  })

  test("returns null for empty cell", () => {
    expect(parseLocationCell("")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isClosed
// ---------------------------------------------------------------------------
describe("isClosed", () => {
  test("detects 🔒 in title", () => {
    expect(isClosed("Software Engineer Intern 🔒")).toBe(true)
  })

  test("returns false for open listing", () => {
    expect(isClosed("Software Engineer Intern")).toBe(false)
    expect(isClosed("Software Engineer Intern 🎓")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseReadme — integration test on fixture HTML
// ---------------------------------------------------------------------------
describe("parseReadme", () => {
  const NOW = new Date("2026-07-11T00:00:00Z")

  // A minimal README fragment that mimics the SimplifyJobs table format
  const FIXTURE = `
# Summer 2026 Internships

<table>
<thead>
<tr>
<th>Company</th>
<th>Role</th>
<th>Location</th>
<th>Application</th>
<th>Age</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong><a href="https://simplify.jobs/c/Google?utm_source=GHList&utm_medium=company">Google</a></strong></td>
<td>Software Engineer Intern</td>
<td>Mountain View, CA</td>
<td><div align="center"><a href="https://careers.google.com/jobs/123?utm_source=Simplify&ref=Simplify"><img src="apply.png" alt="Apply"></a> <a href="https://simplify.jobs/p/abc-123?utm_source=GHList"><img src="simplify.png" alt="Simplify"></a></div></td>
<td>2d</td>
</tr>
<tr>
<td>↳</td>
<td>Data Engineer Intern</td>
<td>NYC</td>
<td><div align="center"><a href="https://careers.google.com/jobs/456?utm_source=Simplify"><img src="apply.png" alt="Apply"></a></div></td>
<td>5d</td>
</tr>
<tr>
<td><strong><a href="https://simplify.jobs/c/Acme?utm_source=GHList&utm_medium=company">Acme Corp</a></strong></td>
<td>Backend Engineer Intern 🔒</td>
<td>Remote</td>
<td><div align="center"><a href="https://simplify.jobs/p/closed-job?utm_source=GHList"><img src="simplify.png" alt="Simplify"></a></div></td>
<td>10d</td>
</tr>
</tbody>
</table>
`

  test("parses open listings and skips closed ones", () => {
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    // Google SWE and Google Data are open; Acme is closed (🔒) — should be skipped
    expect(jobs).toHaveLength(2)
  })

  test("inherits company name for continuation rows", () => {
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    expect(jobs[0].company).toBe("Google")
    expect(jobs[0].title).toBe("Software Engineer Intern")
    expect(jobs[1].company).toBe("Google")
    expect(jobs[1].title).toBe("Data Engineer Intern")
  })

  test("extracts correct apply URL (not simplify.jobs/p/)", () => {
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    expect(jobs[0].url).toContain("careers.google.com")
    expect(jobs[1].url).toContain("careers.google.com")
  })

  test("converts relative age to YYYY-MM-DD", () => {
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    expect(jobs[0].date).toBe("2026-07-09") // 2d before 2026-07-11
    expect(jobs[1].date).toBe("2026-07-06") // 5d before 2026-07-11
  })

  test("sets role_type from argument", () => {
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    expect(jobs.every((j) => j.role_type === "internship")).toBe(true)
  })

  test("missing values are null", () => {
    // Both jobs have location, so test deadline (always null)
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    expect(jobs[0].deadline).toBeNull()
  })

  test("generates stable unique IDs", () => {
    const jobs = parseReadme(FIXTURE, "internship", NOW)
    const ids = jobs.map((j) => j.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

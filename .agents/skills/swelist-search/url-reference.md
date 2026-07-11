# swelist-search URL Reference

## Data Sources

swelist.com is an email-alert service for tech internship/new-grad postings, not a
searchable API. The underlying job data comes from two public GitHub repositories
maintained by SimplifyJobs and Pitt CSC:

| Source | URL | Content |
|--------|-----|---------|
| Summer 2026 Internships | `https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md` | HTML tables embedded in markdown |
| New-Grad Positions | `https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md` | HTML tables embedded in markdown |

Both files are fetched directly (unauthenticated, public GitHub raw content).

## HTML Table Format

Each README contains one or more HTML tables (embedded in markdown) with these columns:

```html
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
  <td><strong><a href="https://simplify.jobs/c/CompanySlug?utm_source=GHList&utm_medium=company">Company Name</a></strong></td>
  <td>Software Engineer Intern</td>
  <td>San Francisco, CA</td>
  <td><div align="center">
    <a href="https://boards.greenhouse.io/...?utm_source=Simplify&ref=Simplify"><img src="..." alt="Apply"></a>
    <a href="https://simplify.jobs/p/UUID?utm_source=GHList"><img src="..." alt="Simplify"></a>
  </div></td>
  <td>3d</td>
</tr>
```

### Company continuation rows (↳)

When a company has multiple roles, subsequent rows use `<td>↳</td>` for the company
cell and inherit the parent company name:

```html
<tr>
  <td>↳</td>
  <td>Data Engineer Intern</td>
  <td>NYC</td>
  <td>...</td>
  <td>5d</td>
</tr>
```

### Multi-location rows

Some rows use a `<details>` element for multiple locations:

```html
<td><details><summary><strong>4 locations</strong></summary>NYC<br>Chicago, IL<br>...</details></td>
```

### Closed listings (🔒)

Closed roles have a locked icon in the title. This skill skips rows where the
Application column contains no valid apply href (the link is removed when closed),
or where the title includes "🔒".

## Age → Date conversion

The `Age` column holds a relative string (`0d`, `1d`, `3d`, `1mo`, `2mo`, `1y`, etc.).
Conversion at fetch time:
- `Nd` → subtract N calendar days from today
- `Nmo` or `Nw` → approximate (30 days per month, 7 days per week)
- Unrecognized → `null`

## Apply URL extraction

The Application cell contains two links:
1. Direct ATS link (Greenhouse, Workday, Ashby, etc.) — use this as `url`
2. Simplify autofill link — secondary, not used as primary URL

Extraction: first `<a href="...">` inside the Application `<td>` where the href is
NOT a `simplify.jobs/p/` link (i.e., the direct ATS link).

## ID generation

Each row gets a stable `id` derived from the company name and role title:
```
slugify(company) + "-" + slugify(title) + "-" + shortHash(company + "|" + title + "|" + url)
```
where `slugify` lowercases, replaces spaces/punctuation with hyphens, collapses
consecutive hyphens, and `shortHash` is the first 8 hex characters of a djb2 hash.
This keeps the ID stable across fetches for the same posting.

## robots.txt

`https://swelist.com/robots.txt` does not contain standard `Disallow` rules. The
raw GitHub content URLs (raw.githubusercontent.com) are public and free to fetch
without restriction — they are the same URLs anyone's browser uses to view the
files. GitHub's ToS applies; per-user, low-volume fetching (one fetch per run)
is well within its scope.

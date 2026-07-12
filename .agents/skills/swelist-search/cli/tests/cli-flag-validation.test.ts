import { describe, test, expect } from "bun:test"
import { runCLI } from "./helpers"

// These assert on validation error codes that are emitted BEFORE any network
// call, so the suite is network-free: flag validation happens before fetch().

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr)
  } catch {
    return {}
  }
}

describe("swelist CLI flag validation", () => {
  describe("numeric flag validation", () => {
    for (const name of ["jobage", "page", "limit"]) {
      test(`--${name} non-numeric exits 1 with BAD_ARG`, async () => {
        const result = await runCLI(["search", `--${name}`, "foo"])
        expect(result.exitCode).not.toBe(0)
        const err = parsedStderr(result.stderr)
        expect(err.code).toBe("BAD_ARG")
        expect(err.error).toMatch(new RegExp(name))
      })
    }

    test("valid integers produce no BAD_ARG", async () => {
      // Pass a no-network env override so the search doesn't hit GitHub
      // The flag validation happens before fetch, so a BAD_ARG would appear
      // regardless of whether the network call succeeds.
      const result = await runCLI(["search", "--jobage", "7", "--page", "1", "--limit", "1"])
      expect(parsedStderr(result.stderr).code).not.toBe("BAD_ARG")
    })
  })

  describe("--role validation", () => {
    test("invalid --role exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "--role", "senior"])
      expect(result.exitCode).not.toBe(0)
      const err = parsedStderr(result.stderr)
      expect(err.code).toBe("BAD_ARG")
    })

    test("valid --role internship produces no BAD_ARG", async () => {
      const result = await runCLI(["search", "--role", "internship"])
      expect(parsedStderr(result.stderr).code).not.toBe("BAD_ARG")
    })

    test("valid --role newgrad produces no BAD_ARG", async () => {
      const result = await runCLI(["search", "--role", "newgrad"])
      expect(parsedStderr(result.stderr).code).not.toBe("BAD_ARG")
    })

    test("valid --role all produces no BAD_ARG", async () => {
      const result = await runCLI(["search", "--role", "all"])
      expect(parsedStderr(result.stderr).code).not.toBe("BAD_ARG")
    })
  })

  describe("detail argument validation", () => {
    test("missing id exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("NO_ID")
    })
  })

  describe("command dispatch", () => {
    test("unknown command exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["frobnicate"])
      expect(result.exitCode).not.toBe(0)
      expect(parsedStderr(result.stderr).code).toBe("BAD_CMD")
    })

    test("no command prints USAGE and exits 1", async () => {
      const result = await runCLI([])
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toMatch(/USAGE/)
    })
  })
})

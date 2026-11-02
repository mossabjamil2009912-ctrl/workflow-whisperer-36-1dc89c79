import { describe, it, expect } from "vitest";
import { needsUpdate } from "./app-update";

describe("needsUpdate", () => {
  it("no update when versions match", () => expect(needsUpdate("1", "1", false)).toBe("none"));
  it("no update when server unreachable", () => expect(needsUpdate("1", null, false)).toBe("none"));
  it("update when a newer version is published", () => expect(needsUpdate("1", "2", false)).toBe("update"));
  it("does not loop after one failed attempt", () => expect(needsUpdate("1", "2", true)).toBe("failed"));
});

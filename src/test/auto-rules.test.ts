import { describe, it, expect } from "vitest";
import { applyAutoRules, emptyRule, type CatItem, type QLine } from "@/lib/auto-rules";

const base = { unit: "حبة", specs: [], kind: "item", active: true };
const items: CatItem[] = [
  { ...base, key: "INV8", name: "إنفرتر 8 كيلو", price: 500, category: "inverters" },
  { ...base, key: "INV50", name: "إنفرتر 50 كيلو", price: 3000, category: "inverters" },
  { ...base, key: "INV12", name: "إنفرتر 12 كيلو", price: 800, category: "inverters" },
  { ...base, key: "PV720", name: "لوح 720 وات", price: 100, category: "panels" },
  { ...base, key: "PV595", name: "لوح 595 وات", price: 90, category: "panels" },
  { ...base, key: "SURGE", name: "مانعة صواعق", price: 40, category: "other", auto_rules: [{ ...emptyRule(), scope: "custom", type: "com", inv_kw: [50, 125], panel_keys: ["PV720"], panels_min: 40 }] },
  { ...base, key: "RESONLY", name: "صنف سكني", price: 5, category: "other", auto_rules: [{ ...emptyRule(), scope: "res" }] },
  { ...base, key: "PERPV", name: "مشبك", price: 1, category: "other", auto_rules: [{ ...emptyRule(), scope: "all", qty_mode: "per_panels", per: 10 }] },
];
const L = (key: string, qty = 1): QLine => ({ key, name: key, unit: null, price: 1, qty, specs: [] });
const run = (lines: QLine[], type: "res" | "com" | null = null) => applyAutoRules(lines, items, () => null, type);
const keys = (ls: QLine[]) => ls.filter((l) => l.auto).map((l) => l.key);

describe("auto-add rules", () => {
  it("surge arrester added with a 50 kW inverter and 40 × 720W panels", () => {
    expect(keys(run([L("INV50"), L("PV720", 40)], "com"))).toContain("SURGE");
  });
  it("surge arrester not added with a 12 kW inverter", () => {
    expect(keys(run([L("INV12"), L("PV720", 40)], "com"))).not.toContain("SURGE");
  });
  it("surge arrester not added with fewer than 40 panels", () => {
    expect(keys(run([L("INV50"), L("PV720", 39)], "com"))).not.toContain("SURGE");
  });
  it("surge arrester not added with 595W panels", () => {
    expect(keys(run([L("INV50"), L("PV595", 60)], "com"))).not.toContain("SURGE");
  });
  it("all-residential item appears in a residential quote only", () => {
    expect(keys(run([L("INV8")], "res"))).toContain("RESONLY");
    expect(keys(run([L("INV50")], "com"))).not.toContain("RESONLY");
  });
  it("per-panels quantity: one per 10 panels, rounded up", () => {
    expect(run([L("PV595", 25)], "res").find((l) => l.key === "PERPV")?.qty).toBe(3);
  });
});

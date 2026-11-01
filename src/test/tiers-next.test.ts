import { describe, it, expect } from "vitest";
import { tieredOptions, optionsForCom, inverterChoices, dailyProduction, PRESETS } from "@/components/QuoteBuilder";

describe("business three choices are the very next size", () => {
  for (const v of [4000, 6000, 10000, 20000]) {
    it(`monthly ${v} kWh: nothing in the same family lies between`, () => {
      const t = tieredOptions("com", "kwh", v)!;
      const r = dailyProduction(t.rec);
      const fam = PRESETS.filter((p) => p.group === t.rec.group).map(dailyProduction);
      if (t.low && t.low.group === t.rec.group) expect(fam.some((d) => d > dailyProduction(t.low!) && d < r)).toBe(false);
      if (t.high && t.high.group === t.rec.group) expect(fam.some((d) => d < dailyProduction(t.high!) && d > r)).toBe(false);
      if (t.low) expect(dailyProduction(t.low)).toBeLessThan(r);
      if (t.high) expect(dailyProduction(t.high)).toBeGreaterThan(r);
    });
  }
});

describe("inverter size and phase choice", () => {
  it("sizes are listed smallest first and each covers the need", () => {
    const ic = inverterChoices(optionsForCom("kwh", 4000));
    expect(ic.length).toBeGreaterThan(0);
    expect(ic.map((c) => c.kw)).toEqual([...ic.map((c) => c.kw)].sort((a, b) => a - b));
  });
  it("home-range values have no inverter question", () => expect(inverterChoices(optionsForCom("kwh", 150))).toEqual([]));
});

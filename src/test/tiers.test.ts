import { describe, it, expect } from "vitest";
import { tieredOptions, optionsForResBill, optionsForCom, dailyProduction, tiersFrom, PRESETS } from "@/components/QuoteBuilder";

describe("three independence choices", () => {
  it("recommended = the right system", () => expect(tieredOptions("res", "bill", 300000)!.rec).toBe(optionsForResBill(300000)[0]));
  it("1.6 kW and 6.2 kW home systems: recommended only", () => {
    for (const p of PRESETS.filter((x) => x.type !== "com" && /^إنفرتر (1\.6|6\.2) /.test(x.group))) {
      const t = tiersFrom([p])!; expect(t.low).toBeUndefined(); expect(t.high).toBeUndefined();
    }
  });
  it("300 kWh/month (screenshot case): no 1.6 kW 'less' next to a 6.2 kW recommendation", () => {
    const t = tieredOptions("com", "kwh", 300)!; expect(t.low).toBeUndefined(); expect(t.high).toBeUndefined();
  });
  it("less/more always use the same inverter as recommended", () => {
    for (const p of PRESETS) {
      const t = tiersFrom([p])!;
      if (t.low) { expect(t.low.group).toBe(p.group); expect(dailyProduction(t.low)).toBeLessThan(dailyProduction(p)); }
      if (t.high) { expect(t.high.group).toBe(p.group); expect(dailyProduction(t.high)).toBeGreaterThan(dailyProduction(p)); }
    }
  });
  it("largest system on an inverter has no 'more'", () => {
    const g = PRESETS.filter((p) => p.group === "إنفرتر 8 كيلو");
    const top = [...g].sort((a, b) => dailyProduction(b) - dailyProduction(a))[0]!;
    expect(tiersFrom([top])!.high).toBeUndefined();
  });
  it("diesel uses same rule", () => expect(tieredOptions("com", "diesel", 270)!.rec).toBe(optionsForCom("diesel", 270)[0]));
});

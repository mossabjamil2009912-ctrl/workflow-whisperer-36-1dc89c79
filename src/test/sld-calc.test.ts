import { describe, it, expect } from "vitest";
import { design, breaker } from "@/lib/sld-calc";

describe("SLD sizing", () => {
  it("matches the reference 80 kW / 153 panel diagram", () => {
    const d = design({ kw: 80, invCount: 1, three: true, panels: 153, batKwh: 192 });
    expect(d.strings).toBe(9);
    expect(d.perString).toBe(17);
    expect(d.voc).toBe(824);
    expect(d.acBreaker).toBe(160);
    expect(d.batCount).toBe(12);
    expect(d.batI).toBe(156);
  });
  it("keeps single-phase strings under 500 V", () => {
    const d = design({ kw: 6.2, invCount: 1, three: false, panels: 10, batKwh: 10 });
    expect(d.voc * 1.15).toBeLessThanOrEqual(500);
  });
  it("rounds breakers up to a standard size with 25% margin", () => {
    expect(breaker(115)).toBe(160);
    expect(breaker(20)).toBe(25);
  });
});

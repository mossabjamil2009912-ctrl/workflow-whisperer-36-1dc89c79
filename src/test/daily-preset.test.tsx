import { describe, it, expect } from "vitest";
import { optionsForResBill, optionsForCom, dailyProduction, DEFAULT_KWH_PRICE } from "@/components/QuoteBuilder";

const titles = (ps: { title: string }[]) => ps.map((p) => p.title);

describe("kWh price", () => {
  it("default is 290 YER", () => expect(DEFAULT_KWH_PRICE).toBe(290));
});

describe("residential bill — bot resNearest on Excel ranges", () => {
  it("50,000 at 290 → need 5.75 → 6.2 kW 4 panels (range 5)", () => expect(titles(optionsForResBill(50000))).toEqual(["6.2 كيلو — بطارية 5.12 كيلو — 4 ألواح 720W"]));
  it("50,000 at 250 → need 6.67 → same 6.2 kW 4 panels (range 7.5)", () => expect(titles(optionsForResBill(50000, 250))).toEqual(["6.2 كيلو — بطارية 5.12 كيلو — 4 ألواح 720W"]));
  it("price changes the result: 130,000 at 290 → 14.9 → range 13; at 250 → 17.3 → range 21", () => {
    expect(titles(optionsForResBill(130000, 290))[0]).toContain("5 ألواح"); 
    expect(titles(optionsForResBill(130000, 250))[0]).toContain("6 ألواح"); 
  });
  it("tie returns both systems (range 2.5): 21,750 at 290 → 2.5", () => expect(optionsForResBill(21750)).toHaveLength(2));
  it("8 kW never below need: 32 kWh/day → 8 kW 9 panels (35.6)", () => expect(titles(optionsForResBill(32 * 30 * 290))[0]).toContain("9 ألواح"));
  it("above 106.9 → commercial", () => expect(optionsForResBill(110 * 30 * 290).every((p) => p.type === "com")).toBe(true));
});

describe("commercial — bot comInvOptions + comLookup", () => {
  it("150 kWh/month (5/day) fits home range → treated as residential (6.2 kW 4 panels)", () => {
    expect(titles(optionsForCom("kwh", 150))).toEqual(titles(optionsForResBill(150 * 290)));
  });
  it("above 106.9/day → commercial, smallest covering", () => {
    const o = optionsForCom("kwh", 3300);
    expect(o.length).toBeGreaterThan(0);
    expect(o.every((p) => p.type === "com" && dailyProduction(p) >= 110)).toBe(true);
  });
  it("bill uses the kWh price: 43,500 at 290 = 150 kWh", () => expect(titles(optionsForCom("bill", 43500))).toEqual(titles(optionsForCom("kwh", 150))));
  it("diesel litres ÷ 0.27", () => expect(titles(optionsForCom("diesel", 270))).toEqual(titles(optionsForCom("kwh", 1000))));
  it("every option covers the need", () => { for (const p of optionsForCom("kwh", 3300)) expect(dailyProduction(p)).toBeGreaterThanOrEqual(110); });
});


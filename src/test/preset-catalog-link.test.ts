import { describe, it, expect } from "vitest";
import { catalogKeyFor } from "@/components/QuoteBuilder";

describe("ready-made systems use catalog prices", () => {
  it("links 720W panel to the catalog item", () => {
    expect(catalogKeyFor({ name: "الواح طاقة شمسية ماركة سنتك ان تايب قدرة اللوح: 720وات وجهين", price: 130, specs: [] })).toBe("PV_SUNTECH_720");
  });
  it("links Fidus battery to the catalog item", () => {
    expect(catalogKeyFor({ name: "بطارية ليثيوم بايلونتك 16 كيلو فيدوس IP65", price: 1800, specs: ["الموديل: Fidus-FB-L-16-PRO"] })).toBe("BAT_FIDUS_16K");
  });
});

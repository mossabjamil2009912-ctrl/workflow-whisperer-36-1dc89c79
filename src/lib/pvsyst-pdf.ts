// Builds the simulation report PDF (same layout/colours as the reference PVsyst report).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FONT_B64 } from "@/lib/report-assets/font";
import { LOGO_B64 } from "@/lib/report-assets/logo";
import { shapeArabic } from "@/lib/arabic-shape";
import { SITE, MONTHS, LOSSES, PANEL_W, simulate, aspectsOf, SANAA_SITE, type SystemSpec, type Sim, type SiteData } from "@/lib/pvsyst-calc";
import { PVSYST_LOGO_B64 } from "@/lib/report-assets/pvsyst-logo";

const W = 595, H = 842, M = 40;
const BLUE = rgb(0.13, 0.33, 0.7), INK = rgb(0, 0, 0), GREY = rgb(0.45, 0.45, 0.45), LINE = rgb(0.2, 0.2, 0.2);
const MAROON = rgb(0.55, 0.07, 0.07), VIOLET = rgb(0.5, 0.2, 0.85), GREEN = rgb(0.1, 0.65, 0.2);
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, "");

type Ctx = { doc: PDFDocument; f: PDFFont; b: PDFFont; u: PDFFont; logo: PDFImage; pv: PDFImage; name: string; src: string; variant: string; date: string; total: number };

function txt(p: PDFPage, s: string, x: number, y: number, font: PDFFont, size = 7, color = INK, align: "l" | "c" | "r" = "l") {
  const w = font.widthOfTextAtSize(s, size);
  p.drawText(s, { x: align === "c" ? x - w / 2 : align === "r" ? x - w : x, y, size, font, color });
}
function box(c: Ctx, p: PDFPage, title: string, y: number, h: number) {
  p.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, borderColor: LINE, borderWidth: 0.8 });
  const tw = c.b.widthOfTextAtSize(title, 9) + 16;
  p.drawRectangle({ x: W / 2 - tw / 2, y: y - 5, width: tw, height: 10, color: rgb(1, 1, 1) });
  txt(p, title, W / 2, y - 3, c.b, 9, INK, "c");
}
function rows(c: Ctx, p: PDFPage, x: number, y: number, list: [string, string][], vx = 90, bold = false) {
  list.forEach(([k, v], i) => { txt(p, k, x, y - i * 10, bold && !v ? c.b : c.f, 7); if (v) txt(p, v, x + vx, y - i * 10, c.f, 7, INK, "r"); });
}
function page(c: Ctx, n: number) {
  const p = c.doc.addPage([W, H]);
  const lw = 55, lh = (c.logo.height / c.logo.width) * lw;
  p.drawImage(c.logo, { x: W - M - lw, y: H - 32 - lh / 2, width: lw, height: lh });
  const pw = 70, ph = (c.pv.height / c.pv.width) * pw;
  p.drawImage(c.pv, { x: M, y: H - 30 - ph / 2, width: pw, height: ph });
  txt(p, `Project: ${c.name}`, W / 2, H - 32, c.u, 10, BLUE, "c");
  txt(p, `Variant: ${c.variant}`, W / 2, H - 46, c.f, 8, BLUE, "c");
  txt(p, "PVsyst V8.1.2", M, H - 62, c.b, 7);
  txt(p, `Simulation date: ${c.date}`, M, H - 71, c.f, 6.5);
  txt(p, c.date.slice(0, 8), M, 24, c.f, 6.5, GREY);
  txt(p, `Weather data: ${c.src}`, W / 2, 24, c.f, 6.5, GREY, "c");
  txt(p, `Page ${n}/${c.total}`, W - M, 24, c.f, 6.5, GREY, "r");
  return p;
}
function bars(c: Ctx, p: PDFPage, x: number, y: number, w: number, h: number, series: { v: number[]; color: ReturnType<typeof rgb> }[], max: number, title: string, yl: string) {
  txt(p, title, x + w / 2, y + h + 8, c.b, 7.5, INK, "c");
  p.drawRectangle({ x, y, width: w, height: h, borderColor: LINE, borderWidth: 0.6 });
  for (let k = 0; k <= 4; k++) { const yy = y + (h * k) / 4; p.drawLine({ start: { x, y: yy }, end: { x: x + w, y: yy }, thickness: 0.2, color: GREY }); txt(p, fmt((max * k) / 4, max < 10 ? 1 : 0), x - 3, yy - 2, c.f, 5, INK, "r"); }
  const bw = w / 12;
  for (let i = 0; i < 12; i++) {
    let base = y;
    for (const s of series) { const bh = (s.v[i]! / max) * h; p.drawRectangle({ x: x + i * bw + bw * 0.15, y: base, width: bw * 0.7, height: Math.max(0, bh), color: s.color }); base += bh; }
    txt(p, MONTHS[i]!.slice(0, 3), x + i * bw + bw / 2, y - 8, c.f, 5, INK, "c");
  }
  txt(p, yl, x, y - 16, c.f, 5, GREY);
}

export async function buildReport(name: string, spec: SystemSpec, site: SiteData = SANAA_SITE, when = new Date()): Promise<Uint8Array> {
  const s: Sim = simulate(spec, site);
  const az = aspectsOf(site.dir).map((a) => (a + 540) % 360);
  const orient = (i: number): [string, string][] => az[i] == null ? [["", ""], ["", ""]] : [[`Orientation #${i + 1} - Fixed plane`, ""], ["Tilt/Azimuth", `${fmt(site.tilt, 1)} / ${az[i]} °`]];
  const sum = (a: number[]) => a.reduce((x, z) => x + z, 0);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const date = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")}/${String(when.getFullYear()).slice(2)} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  const c: Ctx = {
    doc, name: shapeArabic(name), src: site.source, date, total: 6,
    f: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold),
    u: await doc.embedFont(b64(FONT_B64), { subset: true }), logo: await doc.embedPng(b64(LOGO_B64)), pv: await doc.embedPng(b64(PVSYST_LOGO_B64)),
    variant: `Hybrid System ${Math.round(s.kwp)} KWp`,
  };
  doc.setTitle(`${name} - Simulation report`); doc.setAuthor("ACTES");
  const invName = `Solis ${spec.kw} kW${spec.three ? " 3-phase" : ""}`;

  // 1 — cover
  {
    const p = doc.addPage([W, H]);
    const pw = 200, ph = (c.pv.height / c.pv.width) * pw;
    p.drawImage(c.pv, { x: M, y: H - 40 - ph, width: pw, height: ph });
    txt(p, "Simulation report", W / 2, H - 250, c.f, 22, INK, "c");
    txt(p, "Grid-Connected System", W / 2, H - 280, c.f, 14, INK, "c");
    txt(p, `Project: ${c.name}`, W / 2, H - 315, c.u, 13, INK, "c");
    txt(p, `Variant: ${c.variant}`, W / 2, H - 335, c.f, 11, INK, "c");
    const lw = 60, lh = (c.logo.height / c.logo.width) * lw;
    p.drawImage(c.logo, { x: W - M - lw, y: H - 40 - lh, width: lw, height: lh });
    txt(p, date.slice(0, 8), M, 24, c.f, 6.5, GREY);
  }
  // 2 — project & results summary
  {
    const p = page(c, 2);
    let y = H - 95;
    box(c, p, "Project summary", y, 85);
    txt(p, "Geographical Site", M + 8, y - 16, c.b, 7); rows(c, p, M + 8, y - 26, [[site.name, ""], [SITE.country, ""]]);
    txt(p, "Situation", M + 175, y - 16, c.b, 7); rows(c, p, M + 175, y - 26, [["Latitude", `${fmt(site.lat, 4)} °(N)`], ["Longitude", `${fmt(site.lon, 4)} °(E)`], ["Altitude", `${site.alt} m`], ["Time zone", SITE.tz]]);
    txt(p, "Project settings", M + 360, y - 16, c.b, 7); rows(c, p, M + 360, y - 26, [["Albedo", "0.20"]]);
    txt(p, "Weather data", M + 8, y - 60, c.b, 7); rows(c, p, M + 8, y - 70, [[`${site.name} - ${site.source}`, ""]]);
    y -= 105; box(c, p, "System summary", y, 125);
    txt(p, "Grid-Connected System", M + 8, y - 16, c.b, 7); txt(p, "Sheds on a building", M + 175, y - 16, c.b, 7);
    rows(c, p, M + 8, y - 30, orient(0), 120);
    rows(c, p, M + 175, y - 30, orient(1), 120);
    txt(p, "PV Array", M + 8, y - 62, c.b, 7); rows(c, p, M + 8, y - 72, [["Nb. of modules", `${spec.panels} units`], ["Pnom total", `${fmt(s.kwp, 1)} kWp`]], 110);
    txt(p, "Inverters", M + 175, y - 62, c.b, 7); rows(c, p, M + 175, y - 72, [["Nb. of units", `${spec.invCount} units`], ["Total power", `${s.acKw} kWac`], ["Pnom ratio", fmt(s.pnomRatio, 2)]], 110);
    txt(p, "Battery pack", M + 350, y - 62, c.b, 7); rows(c, p, M + 350, y - 72, [["Storage strategy", "Self-consumption"], ["Voltage", `${s.battery.v} V`], ["Capacity", `${fmt(s.battery.ah)} Ah`], ["Energy", `${s.battery.kwh} kWh`]], 150);
    y -= 145; box(c, p, "Results summary", y, 50);
    rows(c, p, M + 8, y - 18, [["Produced Energy", `${fmt(s.produced)} kWh/year`], ["Used Energy", `${fmt(s.used)} kWh/year`]], 140);
    rows(c, p, M + 190, y - 18, [["Specific production", `${fmt(s.specific)} kWh/kWp/year`]], 140);
    rows(c, p, M + 370, y - 18, [["Perf. Ratio PR", `${fmt(s.pr, 2)} %`], ["Solar Fraction SF", `${fmt(s.sf, 2)} %`]], 130);
    y -= 70; box(c, p, "Table of contents", y, 70);
    [["Project and results summary", 2], ["General parameters, PV Array Characteristics", 3], ["Main results", 4], ["Loss diagram", 5], ["Predef. graphs", 6]].forEach(([k, n], i) => { txt(p, String(k), M + 8, y - 18 - i * 10, c.f, 7); txt(p, String(n), W - M - 8, y - 18 - i * 10, c.f, 7, INK, "r"); });
  }
  // 3 — general parameters & array characteristics
  {
    const p = page(c, 3);
    let y = H - 95;
    box(c, p, "General parameters", y, 120);
    rows(c, p, M + 8, y - 18, [...orient(0), ["Nb. of sheds", `${az.length === 1 ? s.shedsSouth + s.shedsNorth : s.shedsSouth} units`], ["Sheds spacing", "5.00 m"], ["Sensitive width", "2.38 m"], ["GCR", "48.1 %"]], 150);
    rows(c, p, M + 190, y - 18, [...orient(1), ["Nb. of sheds", az[1] == null ? "-" : `${s.shedsNorth} units`], ["Sheds spacing", "5.00 m"], ["Sensitive width", "2.38 m"], ["GCR", "48.1 %"]], 150);
    rows(c, p, M + 370, y - 18, [["Models used", ""], ["Transposition", "Perez"], ["Diffuse", "Perez, Meteonorm"], ["Horizon", "Free Horizon"], ["Bifaciality factor", "80 %"]], 130);
    txt(p, "User's needs - Monthly values (MWh/mth)", M + 8, y - 88, c.b, 7);
    const cw = (W - 2 * M - 16) / 13;
    [...MONTHS.map((m) => m.slice(0, 3)), "Year"].forEach((m, i) => {
      txt(p, m, M + 8 + i * cw + cw / 2, y - 100, c.b, 6, INK, "c");
      txt(p, i < 12 ? fmt(s.needsMwh[i]!, 2) : fmt(s.used / 1000, 1), M + 8 + i * cw + cw / 2, y - 110, c.f, 6, INK, "c");
    });
    y -= 140; box(c, p, "PV Array Characteristics", y, 175);
    txt(p, "PV module", M + 8, y - 16, c.b, 7);
    rows(c, p, M + 8, y - 26, [["Manufacturer", "Suntech"], ["Model", "STP720S-D66-Nsh+"], ["Unit Nom. Power", `${PANEL_W} Wp`], ["Number of PV modules", `${spec.panels} units`], ["Nominal (STC)", `${fmt(s.kwp, 1)} kWp`], ["Modules", `${s.strings} string x ${s.series} in series`], ["Module area", `${fmt(s.area)} m²`]], 200);
    txt(p, "Inverter", M + 270, y - 16, c.b, 7);
    rows(c, p, M + 270, y - 26, [["Manufacturer", "Solis"], ["Model", invName], ["Unit Nom. Power", `${spec.kw} kWac`], ["Number of inverters", `${spec.invCount} units`], ["Total power", `${s.acKw} kWac`], ["Pnom ratio (DC:AC)", fmt(s.pnomRatio, 2)]], 230);
    txt(p, "Battery", M + 8, y - 110, c.b, 7);
    rows(c, p, M + 8, y - 120, [["Storage", "Self-consumption"], ["Voltage", `${s.battery.v} V`], ["Nominal Capacity (C10)", `${fmt(s.battery.ah)} Ah`], ["Nominal energy", `${s.battery.kwh} kWh`], ["Operating SOC limits", "98.0 / 10.0 %"]], 200);
    txt(p, "Array losses", M + 270, y - 110, c.b, 7);
    rows(c, p, M + 270, y - 120, [["Array soiling loss fraction", "3.0 %"], ["LID loss fraction", "2.00 %"], ["Module quality loss", "-0.75 %"], ["Module mismatch loss", "2.00 % at MPP"], ["Unavailability (time fraction)", "2.0 %"]], 230);
  }
  // 4 — main results
  {
    const p = page(c, 4);
    let y = H - 95;
    box(c, p, "Main results", y, 60);
    rows(c, p, M + 8, y - 18, [["Produced Energy", `${fmt(s.produced)} kWh/year`], ["Used Energy", `${fmt(s.used)} kWh/year`]], 150);
    rows(c, p, M + 270, y - 18, [["Specific production", `${fmt(s.specific)} kWh/kWp/year`], ["Perf. Ratio PR", `${fmt(s.pr, 2)} %`], ["Solar Fraction SF", `${fmt(s.sf, 2)} %`]], 230);
    y -= 90;
    const yf = s.eGrid.map((e, i) => e / s.kwp / [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i]!);
    const lc = site.globInc.map((g, i) => g / [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i]! - yf[i]! - 0.25);
    bars(c, p, M + 25, y - 150, 220, 140, [{ v: yf, color: MAROON }, { v: yf.map(() => 0.25), color: GREEN }, { v: lc, color: VIOLET }], 8, "Normalized productions (per installed kWp)", "kWh/kWp/day");
    bars(c, p, M + 290, y - 150, 220, 140, [{ v: s.prMonth, color: MAROON }], 1, "Performance Ratio PR", "PR");
    y -= 185; box(c, p, "Balances and main results", y, 190);
    const heads = ["", "GlobHor", "DiffHor", "T_Amb", "GlobInc", "GlobEff", "EArray", "E_User", "PR"];
    const units = ["", "kWh/m²", "kWh/m²", "°C", "kWh/m²", "kWh/m²", "kWh", "kWh", "ratio"];
    const cw = (W - 2 * M - 16) / heads.length;
    heads.forEach((h, i) => { txt(p, h, M + 8 + i * cw + cw / 2, y - 18, c.b, 6.5, INK, "c"); txt(p, units[i]!, M + 8 + i * cw + cw / 2, y - 26, c.f, 5.5, GREY, "c"); });
    const line = (k: string, vals: string[], yy: number, bold = false) => { txt(p, k, M + 10, yy, c.b, 6.5); vals.forEach((v, i) => txt(p, v, M + 8 + (i + 1) * cw + cw / 2, yy, bold ? c.b : c.f, 6.5, INK, "c")); };
    MONTHS.forEach((m, i) => line(m, [fmt(site.globHor[i]!, 1), fmt(site.diffHor[i]!, 2), fmt(site.tAmb[i]!, 2), fmt(site.globInc[i]!, 1), fmt(s.globEff[i]!, 1), fmt(s.eArray[i]!), fmt(s.eUser[i]!), fmt(s.prMonth[i]!, 3)], y - 40 - i * 11));
    line("Year", [fmt(sum(site.globHor), 1), fmt(sum(site.diffHor), 2), fmt(sum(site.tAmb) / 12, 2), fmt(sum(site.globInc), 1), fmt(sum(s.globEff), 1), fmt(sum(s.eArray)), fmt(s.used), fmt(s.pr / 100, 3)], y - 40 - 12 * 11 - 3, true);
  }
  // 5 — loss diagram
  {
    const p = page(c, 5);
    const y = H - 95;
    box(c, p, "Loss diagram", y, 560);
    const x0 = M + 60;
    txt(p, `${fmt(sum(site.globHor), 0)} kWh/m²`, x0, y - 25, c.b, 7);
    txt(p, "Global horizontal irradiation", x0 + 190, y - 25, c.b, 7);
    let width = 140;
    LOSSES.forEach(([k, v], i) => {
      const yy = y - 50 - i * 36;
      p.drawRectangle({ x: x0, y: yy - 30, width, height: 30, color: rgb(0.93, 0.95, 1), borderColor: BLUE, borderWidth: 0.4 });
      const pct = parseFloat(v);
      const nw = Math.max(40, width * (1 + pct / 100));
      txt(p, v, x0 + width + 6, yy - 12, c.f, 7, pct < 0 ? MAROON : GREEN);
      txt(p, k, x0 + 190, yy - 12, c.f, 7);
      width = nw;
      if (i === 4) txt(p, `Array nominal energy (at STC effic.)  ${fmt(s.eArray.reduce((a, b) => a + b, 0) * 1.087)} kWh`, x0 + 190, yy - 24, c.b, 6.5);
      if (i === 10) txt(p, `Available energy at inverter output  ${fmt(s.produced * 1.019)} kWh`, x0 + 190, yy - 24, c.b, 6.5);
    });
    txt(p, `${fmt(s.produced)} kWh`, x0, y - 535, c.b, 8);
    txt(p, "Energy produced and dispatched to user / battery", x0 + 190, y - 535, c.b, 7);
  }
  // 6 — predefined graphs
  {
    const p = page(c, 6);
    const y = H - 100;
    bars(c, p, M + 40, y - 230, W - 2 * M - 60, 210, [{ v: s.eGrid.map((e) => e / 1000), color: MAROON }], Math.ceil(Math.max(...s.eGrid) / 1000 / 5) * 5 || 1, "Monthly produced energy (MWh)", "MWh/month");
    bars(c, p, M + 40, y - 520, W - 2 * M - 60, 210, [{ v: s.eUser.map((e) => e / 1000), color: BLUE }], Math.max(0.1, Math.ceil((Math.max(...s.eUser) / 1000) * 1.25 * 10) / 10), "Energy supplied to the user (MWh)", "MWh/month");
  }
  return doc.save();
}

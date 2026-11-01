// Draws the single-line diagram PDF (dark navy layout, same colours as the ACTES reference SLD).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { FONT_B64 } from "@/lib/report-assets/font";
import { LOGO_B64 } from "@/lib/report-assets/logo";
import { shapeArabic } from "@/lib/arabic-shape";
import type { SystemSpec } from "@/lib/pvsyst-calc";
import { design, PANEL } from "@/lib/sld-calc";

const W = 1300, H = 460;
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const BG = hex("#0B2545"), BOXBG = hex("#0E2B50"), HEAD = hex("#1B3A66");
const DC = hex("#F08A80"), AC = hex("#7FA8F5"), COM = hex("#C79BF2"), EARTH = hex("#7EE07E"), YEL = hex("#F5C518");
const WHITE = hex("#FFFFFF"), MUTED = hex("#B9C6DA"), OKBG = hex("#123D3A"), OK = hex("#55E07A");
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const f1 = (n: number, d = 2) => n.toFixed(d);

type C = { p: PDFPage; f: PDFFont; b: PDFFont };
// pdf-lib y is bottom-up; we work top-down with Y().
const Y = (y: number) => H - y;
function t(c: C, s: string, x: number, y: number, size = 7, color: RGB = WHITE, bold = false, align: "l" | "c" | "r" = "l") {
  const font = bold ? c.b : c.f;
  const w = font.widthOfTextAtSize(s, size);
  c.p.drawText(s, { x: align === "c" ? x - w / 2 : align === "r" ? x - w : x, y: Y(y), size, font, color });
}
function line(c: C, x1: number, y1: number, x2: number, y2: number, color: RGB, th = 1.2, dash?: number[]) {
  c.p.drawLine({ start: { x: x1, y: Y(y1) }, end: { x: x2, y: Y(y2) }, thickness: th, color, ...(dash ? { dashArray: dash } : {}) });
}
function dot(c: C, x: number, y: number, color: RGB, r = 2) { c.p.drawCircle({ x, y: Y(y), size: r, color }); }
function box(c: C, x: number, y: number, w: number, h: number, title: string, lines: string[], color: RGB) {
  c.p.drawRectangle({ x, y: Y(y + h), width: w, height: h, color: BOXBG, borderColor: color, borderWidth: 1.4 });
  c.p.drawRectangle({ x: x + 1, y: Y(y + 14), width: w - 2, height: 13, color: HEAD });
  t(c, title, x + w / 2, y + 10, 7.5, WHITE, true, "c");
  lines.forEach((s, i) => t(c, s, x + 5, y + 24 + i * 10, 6.5));
}
function badge(c: C, x: number, y: number, pct: number, limit: number) {
  const ok = pct <= limit;
  c.p.drawRectangle({ x, y: Y(y + 9), width: 52, height: 12, color: OKBG, borderColor: ok ? OK : DC, borderWidth: 1 });
  dot(c, x + 7, y + 3, ok ? OK : DC, 2.2);
  t(c, `${f1(pct)}% ${ok ? "OK" : "HIGH"}`, x + 13, y + 6, 6.5, ok ? OK : DC, true);
}
function panelIcon(c: C, x: number, y: number) {
  for (let k = 0; k < 3; k++) {
    const px = x + k * 17;
    c.p.drawRectangle({ x: px, y: Y(y + 12), width: 15, height: 12, borderColor: WHITE, borderWidth: 0.6 });
    line(c, px, y, px + 15, y + 12, WHITE, 0.4); line(c, px + 7.5, y, px + 7.5, y + 12, WHITE, 0.4);
  }
}

export async function buildSld(name: string, spec: SystemSpec, when = new Date()): Promise<Uint8Array> {
  const d = design(spec);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const p = doc.addPage([W, H]);
  const c: C = { p, f: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold) };
  const u = await doc.embedFont(b64(FONT_B64), { subset: true });
  const logo = await doc.embedPng(b64(LOGO_B64));
  doc.setTitle(`${name} - SLD`); doc.setAuthor("ACTES");
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  const ph = d.three ? "3PH" : "1PH";
  const lw = 80, lh = (logo.height / logo.width) * lw;
  p.drawRectangle({ x: W - lw - 22, y: H - lh - 16, width: lw + 12, height: lh + 12, color: WHITE });
  p.drawImage(logo, { x: W - lw - 16, y: H - lh - 10, width: lw, height: lh });
  const date = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")}/${when.getFullYear()}`;
  const nm = shapeArabic(name);
  p.drawText(nm, { x: W - lw - 26 - u.widthOfTextAtSize(nm, 10), y: Y(22), size: 10, font: u, color: WHITE });
  t(c, `Single Line Diagram — ${date}`, W - lw - 26, 36, 7, MUTED, false, "r");

  // ---- DC side
  t(c, `DC SIDE — PV ARRAY ${f1(d.kwp)} kWp`, 28, 28, 9, DC, true);
  const shown = Math.min(6, d.strings);
  const dcX = 258, dcY = 42, dcW = 120, dcH = 215;
  for (let i = 0; i < shown; i++) {
    const y = 48 + i * 36;
    panelIcon(c, 28, y);
    t(c, `String ${i + 1} — ${d.perString} x ${PANEL.w} Wp`, 108, y + 2, 6.5);
    line(c, 104, y + 10, dcX, y + 10, DC, 1.2);
    t(c, "+", 110, y + 21, 6.5, DC, true); t(c, "–", 122, y + 21, 6.5, WHITE);
  }
  badge(c, 196, 48 + Math.min(2, shown - 1) * 36 + 5, d.drops.string, 3);
  t(c, `typical — total ${d.strings} strings x ${d.perString} modules (${d.panels} modules)`, 28, 48 + shown * 36 + 6, 6, MUTED);
  line(c, dcX + 2, 52, dcX + 2, 48 + shown * 36 - 18, DC, 1.6);
  box(c, dcX, dcY, dcW, dcH, "DC PROTECTION BOARD", [`${d.strings} Way — IP65 UV`, "Fuse gPV 32 A / 1000 V DC", "DC Isolator (load break)", "Icu 10 kA", "DC SPD Type 2"], AC);
  for (let i = 0; i < 6; i++) c.p.drawRectangle({ x: dcX + dcW - 18, y: Y(70 + i * 30), width: 6, height: 14, borderColor: WHITE, borderWidth: 0.6 });

  // ---- Battery
  const bx = 185, by = 252;
  box(c, bx, by, 152, 55, "BATTERY BANK", d.batCount ? [`${d.batCount} x ${d.batModule} kWh = ${d.batKwh} kWh`, `Nominal ${d.batV} V DC`, `Max current ≈ ${d.batI} A`.replace("≈", "~")] : ["No battery"], DC);
  t(c, PANEL.model, 28, by + 52, 6, MUTED);

  // ---- Inverter
  const ix = 466, iy = 114, iw = 150, ih = 76;
  t(c, `STRING CHECK: Voc ${d.voc} V within ${d.mppt.min}–${d.mppt.max} V`, ix + iw / 2 - 10, 104, 6, d.vocOk ? MUTED : DC, false, "c");
  box(c, ix, iy, iw, ih, `PV INVERTER — ${ph}`, [`${d.invCount} x ${d.kw} kW = ${d.totalKw} kW`, `MPPT inputs: ${d.mpptInputs}`, `MPPT: ${d.mppt.min}–${d.mppt.max} V`, `BAT port: ${d.batV} V DC`], AC);
  t(c, `Solis ${d.kw}K ${ph} Hybrid`, ix + iw / 2, iy + ih + 10, 6.5, MUTED, false, "c");
  d.mpptMap.forEach((ids, i) => {
    const y = 140 + i * 8;
    line(c, dcX + dcW, y, ix, y, DC, 1.2); dot(c, dcX + dcW, y, DC, 1.8);
    t(c, `MPPT ${i + 1} — ${ids.length} STR${ids.length ? ` (${ids.map((n) => "S" + n).join(", ")})` : ""}`.slice(0, 42), dcX + dcW + 4, y - 1.5, 5, DC, true);
  });
  t(c, "DC IN", ix - 4, 140 + d.mpptInputs * 8 + 6, 6, DC, false, "r");
  badge(c, 392, 200, d.drops.dcIn, 3);
  // battery link W3
  const bus = ix + 120;
  line(c, bx + 152, by + 25, bus, by + 25, DC, 1.4); line(c, bus, iy + ih, bus, by + 25, DC, 1.4);
  dot(c, bus, iy + ih, DC); dot(c, bus, by + 25, DC);
  t(c, "BAT", bus - 22, 240, 6.5, DC); t(c, "W3", bus - 22, 268, 7, DC, true);
  t(c, `DC ${d.batBreaker} A 2P — 10 kA  ·  ${d.batMm2} mm²`, 390, by + 42, 6.5, MUTED);
  badge(c, 450, by + 58, d.drops.bat, 1.5);

  // ---- AC side
  const ax = 690, ay = 108, aw = 128, ah = 86;
  t(c, "GRID OUT", ix + iw + 6, 116, 6, AC);
  line(c, ix + iw, 152, ax, 152, AC, 1.4); dot(c, ix + iw, 152, AC);
  t(c, "W4", 652, 134, 7, AC, true); t(c, `L1 L2 L3 N · ${d.acMm2} mm²`, ix + iw + 4, 146, 5.5, MUTED);
  c.p.drawRectangle({ x: 660, y: Y(160), width: 14, height: 14, borderColor: AC, borderWidth: 1 }); t(c, "RCD-B", 667, 170, 5.5, AC, false, "c");
  box(c, ax, ay, aw, ah, "AC OUTPUT BOARD (GRID)", [`Main ${d.acBreaker} A ${d.three ? "4P" : "2P"} — IP54`, d.three ? "L1 / L2 / L3 / N / PE" : "L / N / PE", "Icu 15 kA", `RCD Type B 30 mA ${d.three ? "4P" : "2P"}`, "AC SPD Type 2"], AC);
  badge(c, 630, 176, d.drops.w4, 1.5);
  // EPS
  const ey = 220;
  line(c, ix + iw, 178, 630, 178, AC, 1.2); line(c, 630, 178, 630, ey + 20, AC, 1.2); line(c, 630, ey + 20, ax, ey + 20, AC, 1.2);
  t(c, "EPS / BACKUP", 636, 196, 6, AC); t(c, "COMM", bus + 28, 230, 6, COM);
  box(c, ax, ey, aw, 40, "EPS OUTPUT BOARD", [`MCB ${d.acBreaker} A + RCD 30 mA`, "AC SPD Type 2"], AC);
  badge(c, 636, ey + 26, d.drops.eps, 1.5);
  // W5 -> meter -> grid
  const mx = 1050, gx = 1100;
  line(c, ax + aw, 152, mx - 12, 152, AC, 1.4); t(c, "W5", 900, 134, 7, AC, true); t(c, "L1 L2 L3 N", 915, 146, 5.5, MUTED);
  c.p.drawCircle({ x: mx, y: Y(152), size: 12, borderColor: AC, borderWidth: 1.2 }); t(c, "kWh", mx, 154, 6, AC, true, "c");
  t(c, "SMART METER", mx, 132, 6, AC, true, "c"); t(c, `${d.three ? 3 : 1} x CT ${d.ct}/5 A`, mx, 176, 5.5, MUTED, false, "c");
  line(c, mx + 12, 152, gx - 20, 152, AC, 1.4); line(c, gx - 20, 152, gx - 20, 110, AC, 1.4); line(c, gx - 20, 110, gx, 110, AC, 1.4);
  badge(c, 880, 170, d.drops.w5, 1.5);
  const vtxt = d.three ? "Three Phase 400/230 V — 50 Hz" : "Single Phase 230 V — 50 Hz";
  box(c, gx, 92, 180, 42, "UTILITY GRID", [vtxt], AC);
  line(c, ax + aw, ey + 20, gx, ey + 20, AC, 1.4); t(c, "W6 — EPS BACKUP", 850, ey + 14, 6.5, AC, true);
  badge(c, 900, ey + 30, d.drops.w6, 1.5);
  box(c, gx, ey, 180, 42, "CRITICAL / BACKUP LOADS", [vtxt], AC);

  // ---- Communication
  const cy1 = 360, cy2 = 375;
  line(c, bx + 76, by + 55, bx + 76, cy1, COM, 1, [3, 2]); line(c, bx + 76, cy1, bus + 24, cy1, COM, 1, [3, 2]); line(c, bus + 24, cy1, bus + 24, iy + ih, COM, 1, [3, 2]);
  t(c, "C1 — BMS CAN / RS485 (shielded)", 380, cy1 - 4, 6.5, COM, true);
  line(c, bus + 24, cy2, mx, cy2, COM, 1, [3, 2]); line(c, mx, cy2, mx, 166, COM, 1, [3, 2]); dot(c, bus + 24, cy2, COM);
  t(c, "C2 — METER RS485 (Modbus)", 820, cy2 - 4, 6.5, COM, true);

  // ---- Earthing
  const ge = 392;
  line(c, 28, ge, W - 28, ge, YEL, 2.2); line(c, 28, ge - 1.5, W - 28, ge - 1.5, EARTH, 1);
  t(c, "LPS DOWN CONDUCTOR 50 mm²".replace("²", "2"), 28, 352, 5.5, EARTH, true);
  t(c, "PE — MAIN EARTHING BUS 1x16 mm2 (frames 1x6 mm2) — TN-S", 28, 380, 7, EARTH, true);
  const taps: [number, string][] = [[70, "ARRAY FRAMES 6 mm2"], [300, "DC BOARD + SPD"], [520, "INVERTER CHASSIS"], [760, "AC BOARD + SPD"], [1130, "LOADS PANEL PE"]];
  for (const [x, s] of taps) { line(c, x, ge - 22, x, ge, EARTH, 0.8, [2, 2]); dot(c, x, ge, EARTH); t(c, s, x, ge + 14, 5.5, EARTH, false, "c"); }
  c.p.drawRectangle({ x: 380, y: Y(ge + 8), width: 130, height: 16, color: BG, borderColor: EARTH, borderWidth: 1.2 });
  t(c, "MAIN EARTH BAR (MEB) — Cu 25x3 mm", 445, ge + 3, 6, EARTH, true, "c");
  t(c, "SPD TYPE I+II — DC", 300, 340, 5.5, EARTH, true, "c"); t(c, "SPD TYPE I+II — AC", 760, 340, 5.5, EARTH, true, "c");
  const px = W - 70;
  line(c, px, ge, px, ge + 18, EARTH, 1.2);
  [16, 10, 5].forEach((w, i) => line(c, px - w, ge + 18 + i * 4, px + w, ge + 18 + i * 4, EARTH, 1.2));
  t(c, "EARTHING PIT < 5 Ω".replace("Ω", "ohm"), px, ge + 44, 6, EARTH, false, "c");
  t(c, "ACTES — auto-generated SLD. Cable lengths assumed; verify on site before installation.", 28, H - 10, 5.5, MUTED);

  return doc.save();
}

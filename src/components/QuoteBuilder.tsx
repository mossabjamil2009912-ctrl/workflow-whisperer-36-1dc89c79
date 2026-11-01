import { useEffect, useMemo, useRef, useState } from "react";
import { applyAutoRules, type CatItem } from "@/lib/auto-rules";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, FilePlus2, Save, Minus, Plus, Trash2, Check, Zap, Battery, Sun, Box, ShieldCheck, Server, Home, Cpu, Cable, Wrench, Printer, History, Share2, X, Download } from "lucide-react";
import { listCatalog, listCustomers, saveQuote, listQuotes, sendAttachment, ensureCustomerByPhone, uploadQuotePdf, getKwhPrice, setKwhPrice } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";
import { BOT_PRESETS } from "@/lib/bot-presets";
import logoClean from "@/assets/actes-logo-clean.png";

type Row = Awaited<ReturnType<typeof listCatalog>>[number];
type Line = { key: string; name: string; unit: string | null; price: number; qty: number; specs: string[]; auto?: boolean };

const TABLES: { k: string; t: string; i: typeof Zap }[] = [
  { k: "inverters", t: "الإنفرترات", i: Zap },
  { k: "batteries", t: "البطاريات", i: Battery },
  { k: "panels", t: "الألواح الشمسية", i: Sun },
  { k: "dc_boxes", t: "صناديق حماية DC", i: Box },
  { k: "ac_panel", t: "لوحات حماية AC", i: ShieldCheck },
  { k: "racks", t: "راكات وكبائن التخزين", i: Server },
  { k: "stands", t: "استندات المنظومات", i: Home },
  { k: "battery_controls", t: "كنترولات وحماية البطاريات", i: Cpu },
  { k: "cables", t: "الكنشات والكابلات", i: Cable },
  { k: "custom", t: "أصناف مخصصة وخدمات", i: Wrench },
];

const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const specsOf = (r: Row) => (Array.isArray(r.specs) ? (r.specs as unknown[]).map(String) : []);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const money = (n: number) => "$ " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Spec printed verbatim as one continuous line, exactly as stored in the catalog.
const specRow = (s: string) => {
  const i = s.indexOf(":");
  const body = i > 0 && i < 60 ? `<b>${esc(s.slice(0, i + 1))}</b>${esc(s.slice(i + 1))}` : esc(s);
  return `<div class="sl">${body}</div>`;
};

type Preset = { type?: "res" | "com"; group: string; title: string; items: [string, number][]; lines?: Line[]; panels?: number; pw?: number };
// All ready-made systems come verbatim from the bot (names, specs, quantities, prices) — see bot-presets.ts.
export const PRESETS: Preset[] = BOT_PRESETS.map((p) => ({ ...p }));

// Links each bot line to its catalog item so ready-made systems always use live catalog prices.
export const catalogKeyFor = (l: { name: string; price: number; specs: string[] }): string | null => {
  const t = l.name + " " + l.specs.slice(0, 2).join(" ");
  const has = (s: string) => t.includes(s);
  if (has("595")) return "PV_SUNTECH_595";
  if (has("720")) return "PV_SUNTECH_720";
  if (has("ليو باور 1.6")) return "INV_LIPOWER_1_6K";
  if (has("ليو باور 6.2")) return "INV_LIPOWER_6_2K";
  if (has("RV12100")) return "BAT_RV12100";
  if (has("RV12200")) return "BAT_RV12200";
  if (has("NeoPower 4")) return "BAT_HEROEE_4K";
  if (has("UF5000")) return "BAT_UF5000";
  if (has("Fidus")) return "BAT_FIDUS_16K";
  if (has("HeroEE 16")) return "BAT_HITHIUM_16K_LV";
  for (const [m, k] of [["SUN-8K-SG02LP1", "INV_DEYE_8K_1P"], ["SUN-12K-SG01LP1", "INV_DEYE_12K_1P"], ["SUN-16K-SG01LP1", "INV_DEYE_16K_1P"], ["SUN-12K-SG04LP3", "INV_DEYE_12K_3P"], ["SUN-16K-SG05LP3", "INV_DEYE_16K_3P"], ["SUN-20K-SG05LP3", "INV_DEYE_20K_3P"]] as const) if (has(m)) return k;
  if (has("استند 100 أمبير")) return "STAND_100A";
  if (has("استند 200 أمبير")) return "STAND_200A";
  if (has("استند 314 أمبير")) return "STAND_314A";
  if (has("استند منظومة ليثيوم 6")) return "STAND_LITHIUM_6K";
  if (has("MC4")) return "mc4_connector";
  if (has("10 مم") && has("كابل")) return "cable_cu_1500v_10mm";
  if (has("6 مم") && has("كابل")) return "cable_cu_1500v_6mm";
  if (has("صندوق حماية - تيار مستمر") && l.price === 80) return "DCBOX_1000_2";
  if (has("صندوق حماية - تيار مستمر") && l.price === 45) return "DCBOX_1000_4_45";
  if (has("صندوق حماية - تيار مستمر") && l.price === 120) return "DCBOX_1000_4_PRO";
  if ((has("سنجل فاز") && has("لوحة حماية")) && (l.price === 35 || has("2P-63AH"))) return "ac_01";
  if (has("4P-63AH")) return "ac_03";
  if (has("4P-100AH")) return "ac_04";
  return null;
};

// Commercial presets copied from real bot quotes (exact items and quantities). Cable is always 1 m = price per metre.
type Store = { dc: [string, number][]; hv?: number; ctrl?: number; ebc?: number; bdc?: number; other?: [string, number][] };
const com = (inv: string, invQty: number, ac: string, pv: number, mc4: number, s: Store): [string, number][] => [
  ["PV_SUNTECH_720", pv], [inv, invQty],
  ...(s.hv ? [["BAT_HITHIUM_16K_HV", s.hv] as [string, number]] : []),
  ...(s.other ?? []),
  ...s.dc, [ac, 1],
  ...(s.ctrl ? [["ctrl_hithium_hv16", s.ctrl] as [string, number]] : []),
  ...(s.ebc ? [["ctrl_hithium_hv16_ebc", s.ebc] as [string, number]] : []),
  ...(s.bdc ? [["bat_protect_dc1500_250a", s.bdc] as [string, number]] : []),
  ["mc4_connector", mc4], ["cable_cu_1500v_10mm", 1],
];
const S50 = "INV_SOLIS_50K_3P_HV", S125 = "INV_SOLIS_125K_3P_HV";
const g50 = "منظومات تجارية 50 كيلو", g125 = "منظومات تجارية 125 كيلو";
const COMMERCIAL: Preset[] = [
  { type: "com", group: g50, title: "50 كيلو · 75 لوح · 4 بطارية هيثيوم (64 كيلو)", items: com(S50, 1, "ac_06", 75, 5, { dc: [["DCBOX_1500_6", 1]], hv: 4, ctrl: 1, bdc: 1 }) },
  { type: "com", group: g50, title: "2× 50 كيلو · 150 لوح · 8 بطارية هيثيوم (128 كيلو)", items: com(S50, 2, "ac_06", 150, 10, { dc: [["DCBOX_1500_10", 1]], hv: 8, ctrl: 1, ebc: 1, bdc: 1 }) },
  { type: "com", group: g50, title: "2× 50 كيلو · 180 لوح · 12 بطارية هيثيوم (192 كيلو)", items: com(S50, 2, "ac_06", 180, 12, { dc: [["DCBOX_1500_6", 2]], hv: 12, ctrl: 1, ebc: 1, bdc: 1 }) },
  { type: "com", group: g50, title: "2× 50 كيلو · 180 لوح · كبينة بايلونتك 313 كيلو", items: com(S50, 2, "ac_06", 180, 12, { dc: [["DCBOX_1500_6", 2]], other: [["CAB_PYLON_313", 1]] }) },
  { type: "com", group: g50, title: "2× 50 كيلو · 180 لوح · 13 بطارية بايلونتك M5", items: com(S50, 2, "ac_06", 180, 12, { dc: [["DCBOX_1500_6", 2]], other: [["BAT_PYLON_M5_15_68K", 13], ["KIT_M5", 1], ["RACK_M5_16", 1], ["CTRL_M5", 1]] }) },
  { type: "com", group: g125, title: "125 كيلو · 221 لوح · 12 بطارية هيثيوم (192 كيلو)", items: com(S125, 1, "ac_15", 221, 13, { dc: [["DCBOX_1500_8", 2]], hv: 12, ctrl: 1, ebc: 1, bdc: 1 }) },
  { type: "com", group: g125, title: "2× 125 كيلو · 442 لوح · 24 بطارية هيثيوم (384 كيلو)", items: com(S125, 2, "ac_15", 442, 26, { dc: [["DCBOX_1500_10", 2], ["DCBOX_1500_8", 1]], hv: 24, ctrl: 2, ebc: 2, bdc: 2 }) },
  { type: "com", group: g125, title: "2× 125 كيلو · 646 لوح · 36 بطارية هيثيوم (576 كيلو)", items: com(S125, 2, "ac_15", 646, 38, { dc: [["DCBOX_1500_10", 4]], hv: 36, ctrl: 3, ebc: 3, bdc: 3 }) },
];
PRESETS.push(...COMMERCIAL);
// Bot formulas (State Machine), fed with daily kWh directly (no ÷30):
// production = panels × panel W × 5.5 / 1000.
export const dailyProduction = (p: Preset) => p.panels ? p.panels * (p.pw ?? 720) * 5.5 / 1000 :
  p.items.reduce((s, [k, q]) => s + (k === "PV_SUNTECH_595" ? q * 595 : k === "PV_SUNTECH_720" ? q * 720 : 0), 0) * 5.5 / 1000;
// ===== Exact copy of the WhatsApp bot selection rules (State Machine) =====
// Residential: bot RES_TABLE "range" values (Excel), in the same order as the residential presets.
// Preset #6 (6.2 kW, 4 panels) is bot r6 AND r7 (identical systems), so it carries both ranges.
const RES_RANGES: number[][] = [[1.2], [2.5], [2.5], [4], [4], [5, 7.5], [13], [21], [31.7], [35.6], [55.4], [63.4], [71.3], [83.2], [106.9]];
const RES_LIST = PRESETS.filter((p) => p.type !== "com");
export const RES_MAX_DAILY = 106.9;
export const DEFAULT_KWH_PRICE = 290;
const E = 0.0001;
// resNearest: closest range; 8/12 kW never below the need; equal distances are all returned (bot tie buttons).
export const resOptions = (need: number): Preset[] => {
  let best: number | null = null;
  let out: Preset[] = [];
  RES_LIST.forEach((p, i) => {
    for (const range of RES_RANGES[i] ?? []) {
      if (/^إنفرتر (8|12) /.test(p.group) && range < need - E) continue;
      const d = Math.abs(range - need);
      if (best === null || d < best - E) { best = d; out = [p]; }
      else if (Math.abs(d - best) <= E && !out.includes(p)) out.push(p);
    }
  });
  return out;
};
// Commercial: comInvOptions (inverter sizes whose max output covers the need; small 8–20 kW first, else big)
// then comLookup per size/phase: smallest system whose daily output >= need.
const COM_LIST = PRESETS.filter((p) => p.type === "com");
const kwOf = (p: Preset) => Number((p.group.match(/(\d+(?:\.\d+)?) كيلو/) ?? [])[1] ?? 0);
const COM_SMALL = [8, 12, 16, 20];
export const comOptions = (need: number): Preset[] => {
  const maxDaily = (kw: number) => Math.max(0, ...COM_LIST.filter((p) => kwOf(p) === kw).map(dailyProduction));
  const kws = [...new Set(COM_LIST.map(kwOf))];
  const small = kws.filter((k) => COM_SMALL.includes(k));
  const big = kws.filter((k) => !COM_SMALL.includes(k));
  const smallMax = Math.max(0, ...small.map(maxDaily));
  let use = need <= smallMax && small.length ? small : big;
  if (!use.length) use = small;
  use = use.filter((k) => maxDaily(k) >= need - E).sort((a, b) => a - b);
  const out: Preset[] = [];
  for (const kw of use) {
    const groups = [...new Set(COM_LIST.filter((p) => kwOf(p) === kw).map((p) => p.group))];
    for (const g of groups) {
      const pick = COM_LIST.filter((p) => p.group === g).sort((a, b) => dailyProduction(a) - dailyProduction(b)).find((p) => dailyProduction(p) >= need - E);
      if (pick) out.push(pick);
    }
  }
  return out;
};
// Bot entry paths. Residential bill → need = bill ÷ price ÷ 30; above the largest home range → commercial.
export const optionsForResBill = (bill: number, price = DEFAULT_KWH_PRICE): Preset[] => {
  const need = bill / price / 30;
  return need > RES_MAX_DAILY + E ? comOptions(need) : resOptions(need);
};
export type ComMethod = "bill" | "kwh" | "diesel";
// Commercial (com_1 bill / com_2 kWh per month / com_3 diesel litres ÷ 0.27) → kWh/month ÷ 30.
export const optionsForCom = (m: ComMethod, v: number, price = DEFAULT_KWH_PRICE): Preset[] => {
  const kwh = m === "bill" ? v / price : m === "kwh" ? v : v / 0.27;
  const need = kwh / 30;
  // Live bot: a commercial need that fits the home range is treated exactly as residential.
  return need <= RES_MAX_DAILY + E ? resOptions(need) : comOptions(need);
};

// Three choices (app + bot): one size smaller / the right system / one size larger.
// Size order: home systems as listed, then business systems by daily production.
const SIZE_ORDER: Preset[] = [...RES_LIST, ...[...COM_LIST].sort((a, b) => dailyProduction(a) - dailyProduction(b))];
export type Tiers = { low?: Preset | undefined; rec: Preset; high?: Preset | undefined };
// Less/more stay on the SAME inverter (size + phase) as the recommended system; a missing side is simply
// omitted. Home 1.6 kW and 6.2 kW systems skip the choice entirely (recommended only).
export const NO_TIER_RES = /^إنفرتر (1\.6|6\.2) /;
export const tiersFrom = (opts: Preset[]): Tiers | null => {
  if (!opts.length) return null;
  const rec = opts[0]!;
  if (rec.type !== "com" && NO_TIER_RES.test(rec.group)) return { rec };
  const skip = new Set(opts.map(dailyProduction));
  const r = dailyProduction(rec);
  const fam = PRESETS.filter((p) => p.group === rec.group && (p.type ?? "res") === (rec.type ?? "res") && !skip.has(dailyProduction(p))).sort((a, b) => dailyProduction(a) - dailyProduction(b));
  return { low: [...fam].reverse().find((p) => dailyProduction(p) < r), rec, high: fam.find((p) => dailyProduction(p) > r) };
};
void SIZE_ORDER;
export const tieredOptions = (path: "res" | "com", m: ComMethod, v: number, price = DEFAULT_KWH_PRICE) =>
  tiersFrom(path === "res" ? optionsForResBill(v, price) : optionsForCom(m, v, price));
// Bot-style inverter choice for business systems: sizes that cover the need, then single/three phase.
export const isThreePhase = (p: Preset) => /3 فاز/.test(p.group);
export type InvChoice = { kw: number; single?: Preset; three?: Preset };
export const inverterChoices = (opts: Preset[]): InvChoice[] => {
  if (!opts.length || !opts.every((p) => p.type === "com")) return [];
  const m = new Map<number, InvChoice>();
  for (const p of opts) { const kw = kwOf(p); const c = m.get(kw) ?? { kw }; if (isThreePhase(p)) c.three ??= p; else c.single ??= p; m.set(kw, c); }
  return [...m.values()].sort((a, b) => a.kw - b.kw);
};

function quoteBody(no: string, cust: { name: string; phone: string; city: string }, lines: Line[], notes: string) {
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const o = location.origin;
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const date = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const h = d.getHours() % 12 || 12;
  const stamp = `${date} ${p2(h)}:${p2(d.getMinutes())} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  const ltr = (s: string) => `<span class="ltr">${esc(s)}</span>`;
  const rows = lines.map((l, i) => `<tr class="it"><td class="c">${i + 1}</td><td class="nm"><div class="t">${esc(l.name)}</div>${l.specs.length ? `<div class="sp">${l.specs.map(specRow).join("")}</div>` : ""}</td><td class="c">${esc(l.unit ?? "حبة")}</td><td class="c">${l.qty}</td><td class="m">${ltr(money(l.price))}</td><td class="m">${ltr(money(l.price * l.qty))}</td></tr>`).join("");
  const noteList = [
    "الأسعار غير شاملة أعمال التركيب ما لم يُذكر خلاف ذلك.",
    ...(lines.some((l) => /كابل/.test(l.name)) ? ["كمية الكابل (1 متر) لتحديد سعر المتر، ويُحدد الطول الفعلي حسب مسافة الموقع."] : []),
    ...(notes ? [notes] : []),
  ];
  const css = `.qt{font-family:Cairo,sans-serif;color:#1a1a1a;direction:rtl;width:190mm;margin:0 auto;font-size:11px;background:#fff;letter-spacing:0;word-spacing:0}
  .qt *{box-sizing:border-box;letter-spacing:0}
  .qt .ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}
  .qt bdi{unicode-bidi:isolate}
  .qt .hdr{width:100%;display:block}
  .qt .info{width:100%;border-collapse:collapse;margin:8px 0 8px;font-size:11.5px}
  .qt .info td{border:0;padding:2px 4px;vertical-align:middle}
  .qt .info .l{color:#666;width:90px;white-space:nowrap}
  .qt .info .val{font-weight:700}
  .qt .info .gap{width:24px}
  .qt .items{width:100%;border-collapse:collapse;table-layout:fixed}
  .qt .items th{background:#ed1c24;color:#fff;font-weight:700;font-size:12px;border:1px solid #c4161d;padding:6px 4px;text-align:center}
  .qt .items td{border:1px solid #bdbdbd;vertical-align:top;padding:7px 6px}
  .qt .items tr.it:nth-child(even) td{background:#fafafa}
  .qt td.c{text-align:center;font-weight:700}
  .qt td.m{text-align:center;font-weight:700;white-space:nowrap}
  .qt .t{font-weight:800;font-size:12.5px;line-height:1.5;margin-bottom:5px;text-align:right}
  .qt .sp{font-size:10.5px;line-height:1.6;text-align:right}
  .qt .sp .sl{padding:1px 0;border-top:1px dotted #e0e0e0;unicode-bidi:plaintext}
  .qt .sp .sl:first-child{border-top:0}
  .qt .sp b{font-weight:700;color:#222}
  .qt tr{page-break-inside:avoid}
  .qt .tot td{font-weight:800;font-size:13px;padding:8px 6px;border:1px solid #bdbdbd}
  .qt .tot .lbl{background:#f1f1f1;text-align:left}
  .qt .tot td.m{color:#ed1c24;background:#fff}
  .qt .notes{font-size:10px;margin-top:10px;line-height:1.8}
  .qt .notes b{color:#ed1c24}
  .qt .ft{width:100%;border-collapse:collapse;margin-top:18px;border-top:1.5px solid #ed1c24;font-size:9px;color:#444}
  .qt .ft td{padding:6px 4px 0;vertical-align:middle}
  .qt .ft img{height:46px;display:block}`;
  const info = (l: string, v: string) => `<td class="l">${l}</td><td class="val">${v}</td>`;
  const html = `<div class="qt"><img class="hdr" src="${o}/quote-header.jpg">
  <table class="info"><tbody>
  <tr>${info("الأخوة:", esc(cust.name || "..........."))}<td class="gap"></td>${info("رقم العرض:", ltr(no))}</tr>
  <tr>${info("الموقع:", esc(cust.city || "—"))}<td class="gap"></td>${info("التاريخ:", ltr(date))}</tr>
  <tr>${info("الموبايل:", cust.phone ? ltr("+" + cust.phone.replace(/^\+/, "")) : "—")}<td class="gap"></td>${info("العملة:", "الدولار الأمريكي")}</tr>
  </tbody></table>
  <table class="items"><colgroup><col style="width:28px"><col><col style="width:52px"><col style="width:50px"><col style="width:86px"><col style="width:92px"></colgroup>
  <thead><tr><th>م</th><th>الصنف والمواصفات</th><th>الوحدة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>${rows}<tr class="tot"><td colspan="5" class="lbl">الإجمالي الكلي</td><td class="m">${ltr(money(total))}</td></tr></tbody></table>
  <div class="notes"><b>ملاحظات:</b><br>${noteList.map((n, i) => `${i + 1}. ${esc(n)}`).join("<br>")}</div>
  <table class="ft"><tr><td style="width:56px"><img src="${o}/quote-qr.jpg"></td><td style="text-align:center"><span class="ltr">www.actesgroup.com · info@actesgroup.com</span></td><td style="text-align:left;white-space:nowrap">طبع بواسطة: <span class="ltr">ACTES CRM</span> · <span class="ltr">${stamp}</span></td></tr></table></div>`;
  return { css, html };
}

function quoteHtml(no: string, cust: { name: string; phone: string; city: string }, lines: Line[], notes: string) {
  const { css, html } = quoteBody(no, cust, lines, notes);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(no)}</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet"><style>@page{size:A4;margin:8mm 10mm}body{margin:0}${css}</style></head><body>${html}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))</script></body></html>`;
}

const toDataUrl = async (url: string) => {
  const b = await (await fetch(url)).blob();
  return await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(f.result as string); f.readAsDataURL(b); });
};
let assetCache: Promise<{ fontCss: string; imgs: Record<string, string> }> | null = null;
// Fonts & images inlined as data URLs so preview and PDF render with identical fonts.
function quoteAssets() {
  if (!assetCache) assetCache = (async () => {
    const o = location.origin;
    const [ar, la, hdr, qr] = (await Promise.all([`${o}/fonts/cairo-ar.woff2`, `${o}/fonts/cairo-la.woff2`, `${o}/quote-header.jpg`, `${o}/quote-qr.jpg`].map(toDataUrl))) as [string, string, string, string];
    const ff = (src: string, range: string) => `@font-face{font-family:Cairo;font-weight:200 1000;font-style:normal;src:url(${src}) format('woff2');unicode-range:${range}}`;
    return {
      fontCss: ff(ar, "U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC") + ff(la, "U+0000-00FF,U+0131,U+0152-0153,U+2000-206F,U+20AC,U+2122,U+2212"),
      imgs: { [`${o}/quote-header.jpg`]: hdr, [`${o}/quote-qr.jpg`]: qr } as Record<string, string>,
    };
  })().catch((e) => { assetCache = null; throw e; });
  return assetCache!;
}

async function quoteDoc(no: string, cust: { name: string; phone: string; city: string }, lines: Line[], notes: string) {
  const { css, html } = quoteBody(no, cust, lines, notes);
  const { fontCss, imgs } = await quoteAssets();
  let h = html;
  for (const [u, d] of Object.entries(imgs)) h = h.split(u).join(d);
  return { css: fontCss + css, html: h };
}

async function quotePdfBase64(no: string, cust: { name: string; phone: string; city: string }, lines: Line[], notes: string) {
  const { css, html } = await quoteDoc(no, cust, lines, notes);
  const W = 760; // ~ 201mm at 96dpi: page content width
  // Measure height with the real browser layout.
  const frame = document.createElement("iframe");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;height:1200px;border:0`;
  document.body.appendChild(frame);
  let H = 1100;
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>body{margin:0;background:#fff}${css}</style></head><body>${html}</body></html>`);
    doc.close();
    await doc.fonts.ready;
    await Promise.all([...doc.images].map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
    await new Promise((r) => setTimeout(r, 150));
    H = Math.ceil((doc.querySelector(".qt") as HTMLElement).getBoundingClientRect().height) + 4;
  } finally { frame.remove(); }

  // Render via SVG foreignObject: the browser's own text engine (correct Arabic shaping & bidi).
  const xhtml = new XMLSerializer().serializeToString(
    new DOMParser().parseFromString(`<div xmlns="http://www.w3.org/1999/xhtml" dir="rtl" style="width:${W}px;background:#fff"><style>${css}</style>${html}</div>`, "text/html").body.firstElementChild!,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await img.decode();
  await new Promise((r) => setTimeout(r, 100));
  const scale = 2.5;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale; canvas.height = H * scale;
  const cx = canvas.getContext("2d")!;
  cx.fillStyle = "#fff"; cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const mx = 5, my = 6, pw = 210 - mx * 2, ph = 297 - my * 2;
  const pxPerMm = canvas.width / pw, pagePx = Math.floor(ph * pxPerMm);
  for (let y = 0, i = 0; y < canvas.height; y += pagePx, i++) {
    const h = Math.min(pagePx, canvas.height - y);
    const c = document.createElement("canvas"); c.width = canvas.width; c.height = h;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, h); ctx.drawImage(canvas, 0, -y);
    if (i) pdf.addPage();
    pdf.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", mx, my, pw, h / pxPerMm);
  }
  return pdf.output("datauristring").split(",")[1]!;
}

export function QuoteBuilder({ pw, initialCustomerId }: { pw: string; initialCustomerId?: string | null }) {
  const listC = useServerFn(listCatalog), listCu = useServerFn(listCustomers), save = useServerFn(saveQuote), sendA = useServerFn(sendAttachment), listQ = useServerFn(listQuotes), ensureC = useServerFn(ensureCustomerByPhone), upPdf = useServerFn(uploadQuotePdf);
  const [sharePhone, setSharePhone] = useState("");
  const { data: rows = [] } = useQuery(offlineQuery({ queryKey: ["catalog"], queryFn: () => listC({ data: { pw } }) }));
  const { data: customers = [], refetch: refetchCu } = useQuery(offlineQuery({ queryKey: ["quote-customers"], queryFn: () => listCu({ data: { pw } }) }));
  const { data: quotes = [], refetch: refetchQ } = useQuery(offlineQuery({ queryKey: ["quotes"], queryFn: () => listQ({ data: { pw } }) }));

  const [active, setActive] = useState("inverters");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [custId, setCustId] = useState<string | null>(initialCustomerId ?? null);
  const [cust, setCust] = useState({ name: "", phone: "", city: "" });
  const [notes, setNotes] = useState("");
  const [custom, setCustom] = useState({ name: "", price: "", unit: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [presetTab, setPresetTab] = useState<"res" | "com">("res");
  const [daily, setDaily] = useState("");
  const [path, setPath] = useState<"res" | "com" | null>(null);
  const [comM, setComM] = useState<ComMethod | null>(null);
  const [tiers, setTiers] = useState<Tiers | null>(null);
  const [invs, setInvs] = useState<InvChoice[] | null>(null);
  const [invKw, setInvKw] = useState<InvChoice | null>(null);
  const getKwh = useServerFn(getKwhPrice);
  const saveKwh = useServerFn(setKwhPrice);
  const { data: kwhData, refetch: refetchKwh } = useQuery(offlineQuery({ queryKey: ["kwh_price"], queryFn: () => getKwh({ data: { pw } }) }));
  const kwhPrice = kwhData?.kwh_price ?? DEFAULT_KWH_PRICE;
  const [kwhEdit, setKwhEdit] = useState<string | null>(null);
  const saveKwhPrice = async () => {
    const v = Number(kwhEdit);
    if (!(v > 0)) return setMsg("سعر غير صحيح");
    try { await saveKwh({ data: { pw, price: v } }); await refetchKwh(); setKwhEdit(null); setMsg(`تم حفظ سعر الكيلووات: ${v} ريال (البوت والتطبيق)`); }
    catch (e) { setMsg((e as Error).message); }
  };
  const [share, setShare] = useState(false);
  const [shareQ, setShareQ] = useState("");

  const items = useMemo(() => rows.filter((r) => r.kind === "item" && r.active), [rows]);
  const byCat = useMemo(() => {
    const m: Record<string, Row[]> = {};
    for (const r of items) (m[r.category] ??= []).push(r);
    return m;
  }, [items]);
  const list = (active === "custom" ? [] : byCat[active] ?? []).filter((r) => !q || (r.name + r.key).toLowerCase().includes(q.toLowerCase()));
  const chosen = Object.values(lines);
  const total = chosen.reduce((s, l) => s + l.price * l.qty, 0);
  const countIn = (k: string) => chosen.filter((l) => (k === "custom" ? l.key.startsWith("CUSTOM_") : byCat[k]?.some((r) => r.key === l.key))).length;

  const toggle = (r: Row) => setLines((p) => {
    const n = { ...p };
    if (n[r.key]) delete n[r.key];
    else n[r.key] = { key: r.key, name: r.name, unit: r.unit, price: Number(r.price ?? 0), qty: 1, specs: specsOf(r) };
    return n;
  });
  const setQty = (k: string, qty: number) => setLines((p) => (p[k] ? { ...p, [k]: { ...p[k], qty: Math.max(1, qty || 1), auto: false } } : p));
  // Auto-add rules from the catalog: matching items join the quote; a deleted auto item stays out of this quote.
  const [quoteType, setQuoteType] = useState<"res" | "com" | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const withAuto = (ls: Line[], t = quoteType, skip = dismissed) => applyAutoRules(ls, rows as CatItem[], catalogKeyFor, t, skip);
  useEffect(() => {
    if (!rows.length) return;
    const cur = Object.values(lines), next = withAuto(cur);
    const sig = (ls: Line[]) => ls.filter((l) => l.auto).map((l) => l.key + ":" + l.qty).sort().join("|");
    if (sig(cur) !== sig(next) || cur.filter((l) => !l.auto).length !== next.filter((l) => !l.auto).length) setLines(Object.fromEntries(next.map((l) => [l.key, l])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, rows, quoteType, dismissed]);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [editNote, setEditNote] = useState(false);
  const chosenRef = useRef<HTMLHeadingElement>(null);
  const setPriceLocal = (k: string, price: number) => setLines((p) => (p[k] ? { ...p, [k]: { ...p[k], price: Math.max(0, price || 0) } } : p));
  const catOfKey = (k: string) => items.find((r) => r.key === k)?.category;
  const swapLine = (oldKey: string, r: Row) => setLines((p) => {
    const old = p[oldKey]; if (!old) return p;
    const n: Record<string, Line> = {};
    for (const [k, v] of Object.entries(p)) {
      if (k === oldKey) n[r.key] = { key: r.key, name: r.name, unit: r.unit, price: Number(r.price ?? 0), qty: old.qty + (r.key !== oldKey ? (p[r.key]?.qty ?? 0) : 0), specs: specsOf(r) };
      else if (k !== r.key) n[k] = v;
    }
    return n;
  });
  const closePreview = () => { setPreview(null); setEditNote(true); setTimeout(() => chosenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const remove = (k: string) => { if (lines[k]?.auto) setDismissed((s) => new Set(s).add(k)); setLines((p) => { const n = { ...p }; delete n[k]; return n; }); };
  const addCustom = () => {
    const price = Number(custom.price);
    if (!custom.name.trim() || !(price >= 0)) return;
    const key = "CUSTOM_" + Date.now();
    setLines((p) => ({ ...p, [key]: { key, name: custom.name.trim(), unit: custom.unit || null, price, qty: 1, specs: [] } }));
    setCustom({ name: "", price: "", unit: "" });
  };
  const pickCustomer = (id: string) => {
    setCustId(id || null);
    const c = customers.find((x) => x.id === id);
    if (c) setCust({ name: c.name ?? "", phone: c.phone, city: c.city ?? "" });
  };
  if (custId && !cust.phone) { const c = customers.find((x) => x.id === custId); if (c) setCust({ name: c.name ?? "", phone: c.phone, city: c.city ?? "" }); }

  const [no, setNo] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string; html: string } | null>(null);
  const generate = async (src: Line[] = chosen) => {
    if (!src.length) return setMsg("اختر صنفا واحدا على الأقل");
    setBusy(true); setMsg("جارٍ إنشاء ملف PDF...");
    try {
      const num = no ?? "ACTES-Q-" + Date.now().toString().slice(-6);
      const url = "";
      const { css, html } = await quoteDoc(num, cust, src, notes);
      const doc = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=760"><style>body{margin:0;background:#fff;padding:6mm 0}${css}</style></head><body>${html}</body></html>`;
            setPreview({ url, name: `عرض سعر ${num} - ${cust.name || "عميل"}.pdf`, html: doc });
      setGenerated(true); setMsg(null);
    } catch (e) { setMsg("تعذر إنشاء PDF: " + (e as Error).message); } finally { setBusy(false); }
  };
  // Browser print engine → "Save as PDF" keeps real vector text & exact preview layout.
  const printIt = async () => {
    if (!preview) return;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const d = f.contentDocument!;
    d.open();
    d.write(preview.html.replace("<head>", `<head><title>${esc(preview.name.replace(/\.pdf$/, ""))}</title>`).replace("</style>", "@page{size:A4;margin:8mm 6mm}@media print{body{padding:0!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>"));
    d.close();
    await d.fonts.ready;
    await Promise.all([...d.images].map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
    setTimeout(() => { f.contentWindow!.focus(); f.contentWindow!.print(); setTimeout(() => f.remove(), 60000); }, 200);
  };
  const download = printIt;
  void quoteHtml;
  const doShare = async (toId: string) => {
    setBusy(true); setMsg(null);
    try {
      const num = no ?? "ACTES-Q-" + Date.now().toString().slice(-6);
      const b64 = await quotePdfBase64(num, cust, chosen, notes);
      const to = customers.find((c) => c.id === toId);
      await sendA({ data: { pw, id: toId, text: `عرض سعر ${num}`, file_name: `عرض سعر ${num} - ${cust.name || "..........."}.pdf`, mime: "application/pdf", b64 } });
      setShare(false); setMsg(`تم إرسال عرض السعر إلى ${to?.name || to?.phone}`);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const shareToPhone = async () => {
    let p = sharePhone.replace(/\D/g, "").replace(/^00/, "");
    if (/^0?7\d{8}$/.test(p)) p = "967" + p.replace(/^0/, "");
    if (!/^\d{9,15}$/.test(p)) return setMsg("رقم غير صحيح");
    setBusy(true);
    try {
      const r = await ensureC({ data: { pw, phone: p, name: cust.name || undefined } });
      setBusy(false); await doShare(r.id); setSharePhone(""); void refetchCu?.();
    } catch (e) { setMsg((e as Error).message); setBusy(false); }
  };
  const openWhatsApp = async () => {
    if (!chosen.length) return setMsg("اختر صنفا واحدا على الأقل");
    let ph = (sharePhone || cust.phone).replace(/\D/g, "").replace(/^00/, "");
    if (/^0?7\d{8}$/.test(ph)) ph = "967" + ph.replace(/^0/, "");
    if (ph && !/^\d{9,15}$/.test(ph)) return setMsg("رقم غير صحيح");
    // Open the tab synchronously so the browser doesn't block it after the upload.
    const tab = ph ? window.open("about:blank", "_blank") : null;
    setBusy(true); setMsg(null);
    try {
      const num = no ?? "ACTES-Q-" + Date.now().toString().slice(-6);
      const b64 = await quotePdfBase64(num, cust, chosen, notes);
      if (ph) {
        const { url } = await upPdf({ data: { pw, file_name: `عرض سعر ${num}.pdf`, b64 } });
        const wa = `https://wa.me/${ph}?text=${encodeURIComponent(`عرض سعر ${num} — ACTES\n${url}`)}`;
        if (tab) tab.location.href = wa; else window.location.href = wa;
        return;
      }
      const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const file = new File([bin], `عرض سعر ${num}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `عرض سعر ${num}` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file); a.download = file.name; a.click();
        let p = (sharePhone || cust.phone).replace(/\D/g, "").replace(/^00/, "");
        if (/^0?7\d{8}$/.test(p)) p = "967" + p.replace(/^0/, "");
        window.open(`https://wa.me/${p}`, "_blank");
        setMsg("تم تنزيل الملف — أرفقه في محادثة واتساب");
      }
    } catch (e) { if ((e as Error).name !== "AbortError") setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const doSave = async () => {
    if (!chosen.length) return setMsg("اختر صنفا واحدا على الأقل");
    setBusy(true); setMsg(null);
    try {
      const r = await save({ data: { pw, customer_id: custId, customer_name: cust.name || null, phone: cust.phone || null, city: cust.city || null, notes: notes || null, items: chosen } });
      setNo(r.quote_no); setMsg(`تم الحفظ: ${r.quote_no}`); void refetchQ();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  // Only the recommended system → load it straight away (no independence step).
  const showTiers = (t: Tiers | null) => { if (t && !t.low && !t.high) { setTiers(null); loadPreset(t.rec); } else setTiers(t); };
  function loadPreset(p: Preset) {
    // Like the bot: every linked line takes name, specs, unit and price live from the catalog.
    const out: Line[] = p.lines ? p.lines.map((l) => {
      const k = catalogKeyFor(l), r = k ? items.find((x) => x.key === k) : null;
      return r ? { key: l.key, name: r.name, unit: r.unit ?? l.unit, price: Number(r.price ?? l.price), qty: l.qty, specs: specsOf(r).length ? specsOf(r) : l.specs } : { ...l };
    }) : [];
    if (!p.lines) for (const [key, qty] of p.items) {
      const r = items.find((x) => x.key === key);
      if (r) out.push({ key: r.key, name: r.name, unit: r.unit, price: Number(r.price ?? 0), qty, specs: specsOf(r) });
    }
    if (!out.length) return setMsg("أصناف هذه المنظومة غير متوفرة في قائمة الأصناف");
    const t = p.type ?? "res", full = withAuto(out, t, new Set());
    setQuoteType(t); setDismissed(new Set());
    setLines(Object.fromEntries(full.map((l) => [l.key, l])));
    setShowHist(false);
    void generate(full);
  }
  const loadQuote = (qt: (typeof quotes)[number]) => {
    // Saved quotes keep their items as they were: auto lines become ordinary lines.
    const its = ((qt.items as unknown as Line[]) ?? []).map((l) => ({ ...l, auto: false }));
    setQuoteType(null); setDismissed(new Set(its.map((l) => l.key)));
    setLines(Object.fromEntries(its.map((l) => [l.key, l])));
    setCustId(qt.customer_id); setCust({ name: qt.customer_name ?? "", phone: qt.phone ?? "", city: qt.city ?? "" });
    setNotes(qt.notes ?? ""); setNo(qt.quote_no); setShowHist(false);
  };

  return (
    <div className="grid gap-3 p-3 lg:h-full lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold"><FilePlus2 className="h-5 w-5 text-primary" />إنشاء عرض سعر</h2>
          <div className="mr-auto flex flex-wrap items-center gap-1">
            {(["res", "com"] as const).map((k) => (
              <button key={k} type="button" onClick={() => { setPath(path === k ? null : k); setComM(null); setTiers(null); setInvs(null); setInvKw(null); setDaily(""); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${path === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>{k === "res" ? "سكني" : "تجاري"}</button>
            ))}
            {path === "com" && (["bill", "kwh", "diesel"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setComM(m); setDaily(""); }} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${comM === m ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}>{m === "bill" ? "فاتورة" : m === "kwh" ? "استهلاك شهري" : "الديزل"}</button>
            ))}
            {(path === "res" || (path === "com" && comM)) && (
              <form onSubmit={(e) => { e.preventDefault(); const n = Number(daily); if (!(n > 0)) return; setInvKw(null); const opts = path === "res" ? optionsForResBill(n, kwhPrice) : optionsForCom(comM ?? "bill", n, kwhPrice); const ic = inverterChoices(opts); if (ic.length) { setTiers(null); setInvs(ic); return; } setInvs(null); const t = tiersFrom(opts); if (!t) { setTiers(null); return setMsg("لا توجد منظومة مناسبة — يُحوّل للموظف المختص"); } showTiers(t); }} className="flex items-center gap-1">
                <input autoFocus value={daily} onChange={(e) => setDaily(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={path === "res" || comM === "bill" ? "الفاتورة الشهرية (ريال)" : comM === "kwh" ? "الاستهلاك الشهري (كيلووات)" : "الديزل الشهري (لتر)"} className="w-40 rounded-lg border bg-card px-2 py-1.5 text-xs" />
                <button type="submit" className="rounded-lg bg-primary px-2 py-1.5 text-xs font-bold text-primary-foreground">عرض</button>
              </form>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">سعر الكيلووات:</span>
            {kwhEdit === null
              ? <button type="button" onClick={() => setKwhEdit(String(kwhPrice))} className="rounded-lg border bg-card px-2 py-1 font-bold">{kwhPrice} ريال</button>
              : <><input autoFocus value={kwhEdit} onChange={(e) => setKwhEdit(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="w-16 rounded-lg border bg-card px-2 py-1" />
                <button type="button" onClick={saveKwhPrice} className="rounded-lg bg-primary px-2 py-1 font-bold text-primary-foreground">حفظ</button>
                <button type="button" onClick={() => setKwhEdit(null)} className="rounded-lg bg-muted px-2 py-1">إلغاء</button></>}
          </div>
          <button onClick={() => setShowHist((v) => !v)} className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/70"><History className="h-4 w-4" />العروض الجاهزة ({PRESETS.length})</button>
        </div>
        {invs && !tiers && (
          <div className="rounded-xl border bg-muted/30 p-2">
            {!invKw ? (<>
              <div className="mb-1 text-xs font-bold">اختر قدرة الإنفرتر:</div>
              <div className="flex flex-wrap gap-1">
                {invs.map((c) => <button key={c.kw} type="button" onClick={() => { const only = c.single && c.three ? null : (c.single ?? c.three)!; if (only) { setInvs(null); showTiers(tiersFrom([only])); } else setInvKw(c); }} className="rounded-lg border bg-card px-3 py-1.5 text-xs font-bold hover:bg-muted">{c.kw} كيلو</button>)}
              </div>
            </>) : (<>
              <div className="mb-1 text-xs font-bold">إنفرتر {invKw.kw} كيلو — سنجل أو ثري فاز؟</div>
              <div className="flex flex-wrap gap-1">
                {([["single", "سنجل فاز"], ["three", "ثري فاز"]] as const).map(([k, label]) => { const p = invKw[k]; return p ? <button key={k} type="button" onClick={() => { setInvs(null); setInvKw(null); showTiers(tiersFrom([p])); }} className="rounded-lg border bg-card px-3 py-1.5 text-xs font-bold hover:bg-muted">{label}</button> : null; })}
                {invs.length > 1 && <button type="button" onClick={() => setInvKw(null)} className="rounded-lg bg-muted px-3 py-1.5 text-xs">رجوع</button>}
              </div>
            </>)}
          </div>
        )}
        {tiers && (
          <div className="rounded-xl border bg-muted/30 p-2">
            <div className="mb-1 text-xs font-bold">اختر مستوى الاستقلالية:</div>
            <div className="grid gap-1 sm:grid-cols-3">
              {([["low", "أقل استقلالية"], ["rec", "موصى به"], ["high", "أكثر استقلالية"]] as const).map(([k, label]) => { const p = tiers[k]; return p ? (
                <button key={k} type="button" onClick={() => { setTiers(null); loadPreset(p); }} className={`rounded-lg border px-2 py-1.5 text-right text-xs hover:bg-muted ${k === "rec" ? "border-primary bg-primary/10" : "bg-card"}`}><div className="font-bold">{label}</div><div className="text-muted-foreground">{p.title}</div></button>
              ) : null; })}
            </div>
          </div>
        )}
        {showHist && (
          <div className="max-h-96 overflow-y-auto rounded-xl border bg-muted/30 p-2 animate-in fade-in slide-in-from-top-2">
            <div className="mb-2 grid grid-cols-2 gap-1">
              {(["res", "com"] as const).map((k) => (
                <button key={k} onClick={() => setPresetTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${presetTab === k ? "bg-primary text-primary-foreground" : "bg-card border"}`}>{k === "res" ? "منظومات سكنية" : "منظومات تجارية"}</button>))}
            </div>
            {[...new Set(PRESETS.filter((p) => (p.type ?? "res") === presetTab).map((p) => p.group))].map((g) => (
              <div key={g} className="mb-2">
                <div className="px-2 py-1 text-xs font-bold text-primary">{g}</div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {PRESETS.filter((p) => p.group === g).map((p) => (
                    <button key={p.title} onClick={() => loadPreset(p)} disabled={busy} className="rounded-lg border bg-card px-3 py-2 text-right text-sm font-semibold hover:border-primary hover:shadow disabled:opacity-50">{p.title}</button>))}
                </div>
              </div>))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {TABLES.map((t) => { const n = countIn(t.k), all = t.k === "custom" ? 0 : byCat[t.k]?.length ?? 0; return (
            <button key={t.k} onClick={() => { setActive(t.k); setQ(""); }}
              className={`group relative flex items-center gap-1.5 rounded-lg border px-2 py-1 text-right transition-all duration-200 hover:shadow-md ${active === t.k ? "border-primary bg-primary text-primary-foreground shadow" : "bg-card"}`}>
              <t.i className={`h-3.5 w-3.5 shrink-0 ${active === t.k ? "" : "text-primary"}`} />
              <span className="truncate text-[11px] font-bold leading-tight">{t.t}</span>
              <span className="mr-auto shrink-0 text-[9px] opacity-70">{t.k === "custom" ? "حر" : all}</span>
              {n > 0 && <span className="absolute -top-1.5 -left-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground animate-in zoom-in">{n}</span>}
            </button>); })}
        </div>

        <div key={active} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 border-b bg-muted/40 p-2.5">
            <span className="font-bold">{TABLES.find((t) => t.k === active)?.t}</span>
            {active !== "custom" && <label className="mr-auto flex items-center gap-1 rounded-lg border bg-background px-2"><Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..." className="w-36 bg-transparent py-1 text-sm outline-none" /></label>}
          </div>
          {active === "custom" ? (
            <div className="grid gap-2 p-3 sm:grid-cols-[1fr_110px_90px_auto]">
              <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="اسم الصنف أو الخدمة (مثل أجور التركيب)" className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} type="number" min={0} placeholder="السعر $" className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <input value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })} placeholder="الوحدة" className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <button onClick={addCustom} className="flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" />إضافة</button>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground"><tr className="border-b"><th className="w-10 p-2" /><th className="p-2 text-right">الصنف</th><th className="p-2 text-right">السعر</th><th className="w-40 p-2 text-right">الكمية</th></tr></thead>
                <tbody>
                  {list.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد أصناف</td></tr>}
                  {list.map((r) => { const l = lines[r.key]; const sp = specsOf(r); return (
                    <tr key={r.key} onClick={() => toggle(r)} className={`cursor-pointer border-b transition-colors ${l ? "bg-primary/10" : "hover:bg-muted/50"}`}>
                      <td className="p-2"><span className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${l ? "border-primary bg-primary text-primary-foreground scale-110" : "border-muted-foreground/40"}`}>{l && <Check className="h-3.5 w-3.5" />}</span></td>
                      <td className="p-2"><div className="font-semibold">{r.name}</div>{sp.length > 0 && <div className="line-clamp-1 text-[11px] text-muted-foreground">{sp.slice(0, 3).join(" · ")}</div>}</td>
                      <td className="whitespace-nowrap p-2 font-bold text-primary">{r.price != null ? usd(Number(r.price)) : "-"}{r.unit && <span className="text-[10px] font-normal text-muted-foreground"> / {r.unit}</span>}</td>
                      <td className="p-2" onClick={(e) => l && e.stopPropagation()}>
                        {l && (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => setQty(r.key, l.qty - 1)} className="rounded-md bg-muted p-1"><Minus className="h-3.5 w-3.5" /></button>
                            <input type="number" min={1} value={l.qty} onChange={(e) => setQty(r.key, Number(e.target.value))} autoFocus className="w-14 rounded-md border bg-background px-1 py-0.5 text-center text-sm font-bold" />
                            <button onClick={() => setQty(r.key, l.qty + 1)} className="rounded-md bg-muted p-1"><Plus className="h-3.5 w-3.5" /></button>
                          </div>)}
                      </td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-1.5 rounded-xl border bg-card p-2 shadow-sm">
        <select value={custId ?? ""} onChange={(e) => pickCustomer(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">
          <option value="">— العميل: جديد / بدون —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name || c.phone} {c.name ? `(${c.phone})` : ""}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-1">
          <input value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder="الاسم" className="min-w-0 rounded-md border bg-background px-1.5 py-1 text-xs" />
          <input value={cust.city} onChange={(e) => setCust({ ...cust, city: e.target.value })} placeholder="المدينة" className="min-w-0 rounded-md border bg-background px-1.5 py-1 text-xs" />
          <input dir="ltr" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="الهاتف" className="min-w-0 rounded-md border bg-background px-1.5 py-1 text-xs" />
        </div>
        {editNote && chosen.length > 0 && <p className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">تقدر تعدّل هذا العرض قبل الحفظ أو الإرسال — التعديل على هذه النسخة فقط، والمنظومة الجاهزة وقائمة الأصناف لا تتغير. لإضافة صنف اختره من الجداول.</p>}
        <h3 ref={chosenRef} className="flex items-center justify-between text-sm font-bold">الأصناف المختارة <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{chosen.length}</span></h3>
        <ul className="min-h-40 flex-1 space-y-1 overflow-y-auto">
          {chosen.length === 0 && <li className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">اضغط على أي صنف من الجداول لإضافته</li>}
          {chosen.map((l) => (
            <li key={l.key} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1 text-xs animate-in fade-in slide-in-from-left-2">
              <div className="min-w-0 flex-1"><div className="font-semibold">{l.name}{l.auto && <span className="mr-1 rounded bg-primary/15 px-1 text-[9px] font-bold text-primary">تلقائي</span>}</div>{l.specs.length > 0 && <ul className="my-0.5 space-y-0.5 border-r-2 border-primary/40 pr-1.5 text-[10px] leading-snug text-muted-foreground">{l.specs.map((s, i) => { const k = s.indexOf(":"); return <li key={i}>{k > 0 && k < 60 ? <><b className="text-foreground">{s.slice(0, k + 1)}</b>{s.slice(k + 1)}</> : s}</li>; })}</ul>}<div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                <button type="button" aria-label="إنقاص" onClick={() => setQty(l.key, l.qty - 1)} className="rounded bg-card p-0.5"><Minus className="h-3 w-3" /></button>
                <input type="number" min={1} value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value))} className="w-11 rounded border bg-background px-1 text-center font-bold" />
                <button type="button" aria-label="زيادة" onClick={() => setQty(l.key, l.qty + 1)} className="rounded bg-card p-0.5"><Plus className="h-3 w-3" /></button>
                <span>×</span>
                <input type="number" min={0} step="0.01" value={l.price} onChange={(e) => setPriceLocal(l.key, Number(e.target.value))} className="w-16 rounded border bg-background px-1 text-center" aria-label="السعر لهذا العرض" />
                <span>$ {l.unit ? `/ ${l.unit}` : ""}</span>
                {catOfKey(l.key) && <button type="button" onClick={() => setSwapKey(swapKey === l.key ? null : l.key)} className="rounded border border-primary/40 px-1.5 font-semibold text-primary">تغيير</button>}
              </div>
              {swapKey === l.key && (
                <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded border bg-card p-1">
                  {(byCat[catOfKey(l.key) ?? ""] ?? []).filter((r) => r.key !== l.key).map((r) => (
                    <button key={r.key} type="button" onClick={() => { swapLine(l.key, r); setSwapKey(null); }} className="block w-full rounded px-1 py-0.5 text-right hover:bg-muted">{r.name} <b className="text-primary">{usd(Number(r.price ?? 0))}</b></button>))}
                </div>)}
              </div>
              <b className="text-primary">{usd(l.qty * l.price)}</b>
              <button onClick={() => remove(l.key)} className="rounded p-0.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>))}
        </ul>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات على العرض (اختياري)" className="rounded-md border bg-background px-2 py-1 text-xs" />
        <div className="flex items-center justify-between rounded-lg bg-ink px-3 py-1.5 text-ink-foreground">
          <span className="text-xs">الإجمالي</span><span className="text-base font-extrabold text-primary">{usd(total)}</span>
        </div>
        {msg && <p className="text-center text-xs font-semibold text-primary">{msg}</p>}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => generate()} disabled={busy} className="flex items-center justify-center gap-1 rounded-md bg-primary py-1.5 text-xs font-bold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"><Printer className="h-3.5 w-3.5" />{busy && !share ? "جارٍ الإنشاء..." : "إنشاء عرض السعر"}</button>
          <button onClick={() => (chosen.length ? setShare(true) : setMsg("اختر صنفا واحدا على الأقل"))} disabled={busy} className="flex items-center justify-center gap-1 rounded-md bg-ink py-1.5 text-xs font-bold text-ink-foreground transition hover:opacity-90 disabled:opacity-50"><Share2 className="h-3.5 w-3.5" />{busy && share ? "جارٍ الإرسال..." : "مشاركة مع عميل"}</button>
        </div>
        {share && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={() => !busy && setShare(false)}>
            <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-2 rounded-xl bg-card p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between"><b>إرسال عرض السعر PDF إلى</b><button onClick={() => setShare(false)}><X className="h-4 w-4" /></button></div>
              <form onSubmit={(e) => { e.preventDefault(); void shareToPhone(); }} className="flex gap-1.5 rounded-lg border-2 border-primary/40 p-2">
                <input dir="ltr" value={sharePhone} onChange={(e) => setSharePhone(e.target.value.replace(/[^\d+]/g, ""))} inputMode="tel" placeholder="رقم واتساب مثل 77XXXXXXX" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
                <button type="submit" disabled={busy} className="rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">إرسال</button>
              </form>
              <button type="button" disabled={busy} onClick={() => void openWhatsApp()} className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">إرسال ملف PDF عبر واتساب (بدون قيود)</button>
              <p className="text-center text-[11px] text-muted-foreground">أو اختر من المحادثات</p>
              <input value={shareQ} onChange={(e) => setShareQ(e.target.value)} placeholder="بحث بالاسم أو الرقم" className="rounded-lg border bg-background px-3 py-2 text-sm" />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {customers.filter((c) => !shareQ || ((c.name ?? "") + c.phone).includes(shareQ)).map((c) => (
                  <button key={c.id} disabled={busy} onClick={() => doShare(c.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-muted disabled:opacity-50">
                    <span className="font-semibold">{c.name || "بدون اسم"}</span><span dir="ltr" className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>))}
              </div>
              {busy && <p className="text-center text-xs text-primary">جارٍ إنشاء الملف وإرساله...</p>}
            </div>
          </div>
        )}
        {preview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-2 animate-in fade-in" onClick={closePreview}>
            <div className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 border-b p-2">
                <b className="flex-1 truncate text-sm">{preview.name}</b>
                <button onClick={download} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"><Download className="h-4 w-4" />حفظ PDF</button>
                <button onClick={closePreview} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <iframe title="معاينة عرض السعر" srcDoc={preview.html} className="min-h-0 w-full flex-1 bg-background" />
              <div className="grid grid-cols-3 gap-2 border-t p-2">
                <button onClick={download} className="flex items-center justify-center gap-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground"><Download className="h-4 w-4" />حفظ PDF</button>
                <button onClick={printIt} className="flex items-center justify-center gap-1 rounded-md bg-muted py-2 text-sm font-bold"><Printer className="h-4 w-4" />طباعة</button>
                <button onClick={() => { setPreview(null); setShare(true); }} className="flex items-center justify-center gap-1 rounded-md bg-ink py-2 text-sm font-bold text-ink-foreground"><Share2 className="h-4 w-4" />إرسال</button>
              </div>
            </div>
          </div>
        )}
        {generated && (
          <button onClick={doSave} disabled={busy} className="flex items-center justify-center gap-1 rounded-md border-2 border-primary py-1 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50 animate-in fade-in"><Save className="h-3.5 w-3.5" />{busy ? "جارٍ الحفظ..." : "حفظ عرض السعر"}</button>
        )}
      </aside>
    </div>
  );
}

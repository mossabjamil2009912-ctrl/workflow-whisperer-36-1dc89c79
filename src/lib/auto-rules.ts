// Auto-add rules: a catalog item carries rules saying which quotes it is added to automatically.
// The same logic is ported into the WhatsApp bot (n8n State Machine); change both together.

export type QuoteType = "res" | "com";
export type AutoRule = {
  scope: "all" | "res" | "com" | "custom";
  type: "all" | "res" | "com"; // only for scope "custom"
  match: "all" | "any";
  inv_kw: number[];
  bat_kwh: number[];
  panel_keys: string[];
  panels_min: number | null;
  panels_max: number | null;
  qty_mode: "fixed" | "per_panels";
  qty: number;
  per: number; // one unit per N panels when qty_mode = per_panels
};

export const emptyRule = (): AutoRule => ({ scope: "res", type: "all", match: "all", inv_kw: [], bat_kwh: [], panel_keys: [], panels_min: null, panels_max: null, qty_mode: "fixed", qty: 1, per: 10 });

export type CatItem = { key: string; name: string; unit: string | null; price: number | string | null; category: string; specs: unknown; kind: string; active: boolean; auto_rules?: unknown };
export type QLine = { key: string; name: string; unit: string | null; price: number; qty: number; specs: string[]; auto?: boolean };
export type QuoteCtx = { type: QuoteType; inv: number[]; bat: number[]; panels: { key: string; qty: number }[] };

// Capacity number written before «كيلو» in the item name (e.g. 8, 50, 15.68).
export const kwOf = (name: string): number | null => {
  const m = name.match(/(\d+(?:\.\d+)?)\s*كيلو/);
  return m ? Number(m[1]) : null;
};

export const rulesOf = (r: { auto_rules?: unknown }): AutoRule[] =>
  Array.isArray(r.auto_rules) ? (r.auto_rules as AutoRule[]).map((x) => ({ ...emptyRule(), ...x })) : [];

export function quoteCtx(lines: QLine[], items: CatItem[], keyOf: (l: QLine) => string | null, type: QuoteType | null): QuoteCtx {
  const inv: number[] = [], bat: number[] = [], panels: { key: string; qty: number }[] = [];
  for (const l of lines) {
    if (l.auto) continue;
    const k = items.some((i) => i.key === l.key) ? l.key : keyOf(l);
    const it = k ? items.find((i) => i.key === k) : null;
    if (!it) continue;
    const kw = kwOf(it.name);
    if (it.category === "inverters" && kw != null) inv.push(kw);
    else if (it.category === "batteries" && kw != null) bat.push(kw);
    else if (it.category === "panels") panels.push({ key: it.key, qty: l.qty });
  }
  return { type: type ?? (Math.max(0, ...inv) >= 30 ? "com" : "res"), inv, bat, panels };
}

const panelCount = (r: AutoRule, c: QuoteCtx) =>
  c.panels.filter((p) => !r.panel_keys.length || r.panel_keys.includes(p.key)).reduce((s, p) => s + p.qty, 0);

export function ruleMatches(r: AutoRule, c: QuoteCtx): boolean {
  if (r.scope === "all") return true;
  if (r.scope === "res" || r.scope === "com") return c.type === r.scope;
  if (r.type !== "all" && r.type !== c.type) return false;
  const conds: boolean[] = [];
  if (r.inv_kw.length) conds.push(c.inv.some((k) => r.inv_kw.includes(k)));
  if (r.bat_kwh.length) conds.push(c.bat.some((k) => r.bat_kwh.includes(k)));
  if (r.panel_keys.length || r.panels_min != null || r.panels_max != null) {
    const n = panelCount(r, c);
    conds.push(n > 0 && (r.panels_min == null || n >= r.panels_min) && (r.panels_max == null || n <= r.panels_max));
  }
  if (!conds.length) return true;
  return r.match === "any" ? conds.some(Boolean) : conds.every(Boolean);
}

export function ruleQty(r: AutoRule, c: QuoteCtx): number {
  if (r.qty_mode === "per_panels") return Math.max(1, Math.ceil(panelCount(r, c) / Math.max(1, r.per)));
  return Math.max(1, r.qty);
}

// Returns the quote's manual lines plus every auto item whose rule matches (first matching rule sets the quantity).
export function applyAutoRules(lines: QLine[], items: CatItem[], keyOf: (l: QLine) => string | null, type: QuoteType | null, skip: Set<string> = new Set()): QLine[] {
  const manual = lines.filter((l) => !l.auto);
  const c = quoteCtx(manual, items, keyOf, type);
  const out = [...manual];
  for (const it of items) {
    if (it.kind !== "item" || !it.active || skip.has(it.key) || manual.some((l) => l.key === it.key)) continue;
    const r = rulesOf(it).find((x) => ruleMatches(x, c));
    if (!r) continue;
    const specs = Array.isArray(it.specs) ? (it.specs as unknown[]).map(String) : [];
    out.push({ key: it.key, name: it.name, unit: it.unit, price: Number(it.price ?? 0), qty: ruleQty(r, c), specs, auto: true });
  }
  return out;
}

export type ReportKind = "pvsyst" | "sld";
export const REPORT_LABEL: Record<ReportKind, string> = { pvsyst: "تقرير PVsyst", sld: "مخطط SLD" };

/** Why a report request cannot be sent, or null if it can. */
export function sendBlocker(req: { status: string }, file: { path: string } | null | undefined): string | null {
  if (req.status !== "pending") return "تم إرسال هذا الطلب مسبقاً";
  if (!file) return "ارفع ملف التقرير لهذه المنظومة أولاً";
  return null;
}

type Spec = { kw: number; three: boolean; panels: number; bat: number };
function parse(s: string): Spec {
  const t = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
  const num = (re: RegExp) => { const m = t.match(re); return m?.[1] ? parseFloat(m[1]) : 0; };
  return {
    kw: num(/(\d+(?:\.\d+)?)\s*كيلو(?!\s*\))/),
    three: /3\s*فاز|ثلاث/.test(t),
    panels: num(/(\d+)\s*(?:لوح|ألواح)/) || num(/ألواح:\s*(\d+)/),
    bat: num(/بطاري(?:ة|ات):?\s*(\d+(?:\.\d+)?)/),
  };
}

/** Best ready-made system (with an uploaded file) for a request's system description; same inverter size and phase required. */
export function matchPreset(label: string | null | undefined, titles: string[]): string | null {
  if (!label) return null;
  if (titles.includes(label)) return label;
  const want = parse(label);
  if (!want.kw) return null;
  let best: string | null = null, bestScore = Infinity;
  for (const t of titles) {
    const p = parse(t);
    if (p.kw !== want.kw || p.three !== want.three) continue;
    const score = Math.abs(p.panels - want.panels) + Math.abs(p.bat - want.bat) / 4;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

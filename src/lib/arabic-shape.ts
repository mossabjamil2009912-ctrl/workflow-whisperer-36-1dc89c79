// Turns Arabic text into visual-order presentation forms so a left-to-right PDF writer
// draws it correctly (connected letters, right-to-left). Latin/digit runs keep their order.
// [isolated, final, initial, medial]; letters with only 2 forms don't join to the next letter.
const F: Record<string, number[]> = {
  "ء": [0xfe80], "آ": [0xfe81, 0xfe82], "أ": [0xfe83, 0xfe84], "ؤ": [0xfe85, 0xfe86], "إ": [0xfe87, 0xfe88],
  "ئ": [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c], "ا": [0xfe8d, 0xfe8e], "ب": [0xfe8f, 0xfe90, 0xfe91, 0xfe92], "ة": [0xfe93, 0xfe94],
  "ت": [0xfe95, 0xfe96, 0xfe97, 0xfe98], "ث": [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c], "ج": [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0],
  "ح": [0xfea1, 0xfea2, 0xfea3, 0xfea4], "خ": [0xfea5, 0xfea6, 0xfea7, 0xfea8], "د": [0xfea9, 0xfeaa], "ذ": [0xfeab, 0xfeac],
  "ر": [0xfead, 0xfeae], "ز": [0xfeaf, 0xfeb0], "س": [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4], "ش": [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8],
  "ص": [0xfeb9, 0xfeba, 0xfebb, 0xfebc], "ض": [0xfebd, 0xfebe, 0xfebf, 0xfec0], "ط": [0xfec1, 0xfec2, 0xfec3, 0xfec4],
  "ظ": [0xfec5, 0xfec6, 0xfec7, 0xfec8], "ع": [0xfec9, 0xfeca, 0xfecb, 0xfecc], "غ": [0xfecd, 0xfece, 0xfecf, 0xfed0],
  "ف": [0xfed1, 0xfed2, 0xfed3, 0xfed4], "ق": [0xfed5, 0xfed6, 0xfed7, 0xfed8], "ك": [0xfed9, 0xfeda, 0xfedb, 0xfedc],
  "ل": [0xfedd, 0xfede, 0xfedf, 0xfee0], "م": [0xfee1, 0xfee2, 0xfee3, 0xfee4], "ن": [0xfee5, 0xfee6, 0xfee7, 0xfee8],
  "ه": [0xfee9, 0xfeea, 0xfeeb, 0xfeec], "و": [0xfeed, 0xfeee], "ى": [0xfeef, 0xfef0], "ي": [0xfef1, 0xfef2, 0xfef3, 0xfef4],
};
const LAM_ALEF: Record<string, [number, number]> = { "ا": [0xfefb, 0xfefc], "أ": [0xfef7, 0xfef8], "إ": [0xfef9, 0xfefa], "آ": [0xfef5, 0xfef6] };
const isAr = (c: string) => /[\u0600-\u06FF]/.test(c);
const joinsNext = (c?: string) => !!c && (F[c]?.length ?? 0) === 4;

function shapeRun(s: string): string {
  const ch = [...s].filter((c) => !/[\u064B-\u0652]/.test(c)); // drop harakat
  const out: string[] = [];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i]!, prev = ch[i - 1], next = ch[i + 1];
    const fromPrev = joinsNext(prev);
    if (c === "ل" && next && LAM_ALEF[next]) { out.push(String.fromCharCode(LAM_ALEF[next]![fromPrev ? 1 : 0])); i++; continue; }
    const f = F[c];
    if (!f) { out.push(c); continue; }
    const toNext = f.length === 4 && !!next && !!F[next];
    const idx = fromPrev && toNext ? 3 : fromPrev ? 1 : toNext ? 2 : 0;
    out.push(String.fromCharCode(f[Math.min(idx, f.length - 1)] ?? f[0]!));
  }
  return out.reverse().join("");
}

/** Visual-order string for LTR drawing. Pure Latin text is returned unchanged. */
export function shapeArabic(text: string): string {
  if (![...text].some(isAr)) return text;
  // split into Arabic and non-Arabic runs, shape Arabic ones, then reverse run order (RTL paragraph)
  const runs = text.match(/[\u0600-\u06FF\s]+|[^\u0600-\u06FF]+/g) ?? [];
  return runs.map((r) => ([...r].some(isAr) ? shapeRun(r) : r)).reverse().join("");
}

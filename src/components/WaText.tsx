import type { ReactNode } from "react";

// تنسيق واتساب: *عريض* _مائل_ ~مشطوب~ + أزرار ردّ وقائمة كما تظهر للعميل
function waInline(s: string, k: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
  let last = 0, i = 0, mt: RegExpExecArray | null;
  while ((mt = re.exec(s))) {
    if (mt.index > last) out.push(s.slice(last, mt.index));
    const key = `${k}-${i++}`;
    if (mt[1]) out.push(<strong key={key}>{mt[1]}</strong>);
    else if (mt[2]) out.push(<em key={key}>{mt[2]}</em>);
    else out.push(<s key={key}>{mt[3]}</s>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function WaText({ text }: { text: string }) {
  const body: string[] = [];
  const buttons: string[] = [];
  const rows: string[] = [];
  for (const l of text.split("\n")) {
    const t = l.trim();
    if (t.startsWith("🔘")) t.split("🔘").map((x) => x.trim()).filter(Boolean).forEach((b) => buttons.push(b));
    else if (t.startsWith("▫️")) rows.push(t.replace("▫️", "").trim());
    else body.push(l);
  }
  const bodyText = body.join("\n").replace(/\s+$/, "");
  return (
    <div>
      {bodyText && bodyText.split("\n").map((l, i) => <div key={i} className="min-h-[1em] whitespace-pre-wrap">{waInline(l, String(i))}</div>)}
      {[...rows, ...buttons].length > 0 && (
        <div className="-mx-2.5 mt-1.5">
          {[...rows, ...buttons].map((b, i) => (
            <div key={i} className="border-t border-wa-line py-2 text-center text-[12.5px] font-medium text-wa-link">↪ {b}</div>
          ))}
        </div>
      )}
    </div>
  );
}

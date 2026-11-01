import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Save, Plus, Trash2 } from "lucide-react";
import { saveAutoRules } from "@/lib/crm.functions";
import { emptyRule, kwOf, rulesOf, type AutoRule, type CatItem } from "@/lib/auto-rules";

const SCOPES: [AutoRule["scope"], string][] = [["all", "كل العروض"], ["res", "كل العروض السكنية"], ["com", "كل العروض التجارية"], ["custom", "عروض بشروط معيّنة"]];
const COUNTS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 180, 200, 250, 300, 400, 500, 650];
const QTYS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{children}</button>;
}
const Sel = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-xs">{children}</select>
);
const caps = (items: CatItem[], cat: string) => [...new Set(items.filter((i) => i.kind === "item" && i.category === cat).map((i) => kwOf(i.name)).filter((x): x is number => x != null))].sort((a, b) => a - b);
const toggleIn = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

export function AutoRulesDialog({ item, items, pw, onClose, onSaved }: { item: CatItem; items: CatItem[]; pw: string; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(saveAutoRules);
  const init = rulesOf(item);
  const [off, setOff] = useState(init.length === 0);
  const [rules, setRules] = useState<AutoRule[]>(init.length ? init : [emptyRule()]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inv = caps(items, "inverters"), bat = caps(items, "batteries");
  const panels = items.filter((i) => i.kind === "item" && i.category === "panels");
  const set = (i: number, p: Partial<AutoRule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function submit() {
    setBusy(true); setMsg("");
    try { await save({ data: { pw, key: item.key, rules: off ? [] : rules } }); onSaved(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b p-3">
          <button onClick={submit} disabled={busy} className="flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "جارٍ الحفظ..." : "حفظ القاعدة"}</button>
          <span className="flex-1 truncate text-sm font-bold">لأي عروض يُضاف هذا الصنف؟</span>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {msg && <p className="px-3 pt-2 text-xs text-destructive">{msg}</p>}
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <p className="text-sm font-medium">{item.name}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={off} onClick={() => setOff(true)}>لا يُضاف تلقائيًا</Chip>
            <Chip on={!off} onClick={() => setOff(false)}>يُضاف تلقائيًا</Chip>
          </div>
          {!off && rules.map((r, i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <div className="flex items-center justify-between"><b className="text-xs text-primary">قاعدة {i + 1}</b>
                {rules.length > 1 && <button onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label="حذف القاعدة" className="rounded p-1 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>}</div>
              <div className="flex flex-wrap gap-1.5">{SCOPES.map(([k, t]) => <Chip key={k} on={r.scope === k} onClick={() => set(i, { scope: k })}>{t}</Chip>)}</div>
              {r.scope === "custom" && (
                <div className="space-y-3">
                  <div><p className="mb-1 text-xs text-muted-foreground">نوع العرض</p>
                    <div className="flex flex-wrap gap-1.5">{([["all", "الكل"], ["res", "سكني"], ["com", "تجاري"]] as const).map(([k, t]) => <Chip key={k} on={r.type === k} onClick={() => set(i, { type: k })}>{t}</Chip>)}</div></div>
                  <div><p className="mb-1 text-xs text-muted-foreground">مع إنفرترات بقدرة (كيلو)</p>
                    <div className="flex flex-wrap gap-1.5">{inv.map((k) => <Chip key={k} on={r.inv_kw.includes(k)} onClick={() => set(i, { inv_kw: toggleIn(r.inv_kw, k) })}>{k}</Chip>)}</div></div>
                  <div><p className="mb-1 text-xs text-muted-foreground">مع بطاريات بقدرة (كيلو)</p>
                    <div className="flex flex-wrap gap-1.5">{bat.map((k) => <Chip key={k} on={r.bat_kwh.includes(k)} onClick={() => set(i, { bat_kwh: toggleIn(r.bat_kwh, k) })}>{k}</Chip>)}</div></div>
                  <div><p className="mb-1 text-xs text-muted-foreground">نوع اللوح</p>
                    <div className="flex flex-wrap gap-1.5">{panels.map((p) => <Chip key={p.key} on={r.panel_keys.includes(p.key)} onClick={() => set(i, { panel_keys: toggleIn(r.panel_keys, p.key) })}>{p.name.match(/(\d{3})\s*وات/)?.[1] ?? p.name} وات</Chip>)}</div></div>
                  <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">عدد الألواح</span>
                    <span>من</span><Sel value={r.panels_min == null ? "" : String(r.panels_min)} onChange={(v) => set(i, { panels_min: v ? Number(v) : null })}><option value="">أي عدد</option>{COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}</Sel>
                    <span>إلى</span><Sel value={r.panels_max == null ? "" : String(r.panels_max)} onChange={(v) => set(i, { panels_max: v ? Number(v) : null })}><option value="">بدون حد</option>{COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}</Sel></div>
                  <div><p className="mb-1 text-xs text-muted-foreground">الربط بين الشروط</p>
                    <div className="flex flex-wrap gap-1.5"><Chip on={r.match === "all"} onClick={() => set(i, { match: "all" })}>كل الشروط معًا</Chip><Chip on={r.match === "any"} onClick={() => set(i, { match: "any" })}>أي شرط منها</Chip></div></div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">الكمية</span>
                <Sel value={r.qty_mode} onChange={(v) => set(i, { qty_mode: v as AutoRule["qty_mode"] })}><option value="fixed">عدد ثابت</option><option value="per_panels">حبة لكل عدد ألواح</option></Sel>
                {r.qty_mode === "fixed"
                  ? <Sel value={String(r.qty)} onChange={(v) => set(i, { qty: Number(v) })}>{QTYS.map((n) => <option key={n} value={n}>{n}</option>)}</Sel>
                  : <><span>كل</span><Sel value={String(r.per)} onChange={(v) => set(i, { per: Number(v) })}>{COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}</Sel><span>لوح</span></>}
              </div>
            </div>
          ))}
          {!off && <button onClick={() => setRules([...rules, emptyRule()])} className="flex items-center gap-1 rounded-md border px-3 py-1 text-xs"><Plus className="h-3.5 w-3.5" /> إضافة قاعدة أخرى</button>}
        </div>
      </div>
    </div>
  );
}

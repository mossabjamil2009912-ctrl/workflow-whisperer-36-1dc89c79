import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Save, RotateCcw, ChevronLeft, MessageSquareText, Check } from "lucide-react";
import { listBotTexts, saveBotText, listBotSteps } from "@/lib/crm.functions";
import { StepEditor, StepCard } from "@/components/BotSteps";
import { Plus } from "lucide-react";
import { offlineQuery } from "@/lib/offline-cache";
import ALL from "@/lib/bot-texts.json";

type T = { k: string; m: string; t: string; s: string; o: string; b?: string; d?: string };
const TEXTS = ALL as T[];
const ORDER = ["الترحيب والقائمة الرئيسية", "السكني", "التجاري", "الصناعي", "التخزين", "عرض السعر", "تعديل المنظومة", "طلب أصناف", "الموقع والمدينة", "دراسة PVsyst", "مخطط SLD", "التقارير", "الشراء والدفع", "التواصل مع المبيعات", "الدعم الفني", "رسائل الانتظار", "أزرار الرجوع", "رسائل عامة", "رسائل أخرى"];

// Keep the original leading/trailing spaces and line breaks so the message layout stays intact.
const edges = (s: string) => { const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/)!; return [m[1] ?? "", m[2] ?? "", m[3] ?? ""] as const; };

function Field({ row, saved, onSave }: { row: T; saved: { value: string | null; desc_value: string | null } | undefined; onSave: (v: string | null, d: string | null) => Promise<void> }) {
  const [lead, core, trail] = edges(row.o);
  const cur = saved?.value != null ? edges(saved.value)[1] : core;
  const [v, setV] = useState(cur);
  const [d, setD] = useState(saved?.desc_value ?? row.d ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const isBtn = row.t === "b";
  const changed = v !== cur || (isBtn && row.d != null && d !== (saved?.desc_value ?? row.d));
  const edited = saved != null;
  const save = async (val: string | null, desc: string | null) => {
    setBusy(true);
    try { await onSave(val, desc); setOk(true); setTimeout(() => setOk(false), 1500); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className={`flex items-start gap-1.5 ${isBtn ? "" : "w-full"}`}>
      {isBtn ? (
        <div className="flex-1 space-y-1">
          <input value={v} maxLength={20} onChange={(e) => setV(e.target.value)} aria-label="اسم الزر"
            className={`w-full rounded-full border px-3 py-1 text-center text-sm font-semibold text-primary outline-none focus:ring-2 focus:ring-ring ${edited ? "border-primary bg-primary/5" : "border-input bg-background"}`} />
          {row.d != null && <input value={d} maxLength={72} onChange={(e) => setD(e.target.value)} aria-label="وصف الخيار" className="w-full rounded border border-input bg-background px-2 py-0.5 text-xs text-muted-foreground" />}
        </div>
      ) : (
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={Math.min(8, Math.max(1, v.split("\n").length))} dir="rtl"
          className={`flex-1 resize-y rounded-lg border px-2 py-1.5 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring ${edited ? "border-primary bg-primary/5" : "border-input bg-background"}`} />
      )}
      <div className="flex flex-col gap-1">
        {changed && <button disabled={busy || !v.trim()} onClick={() => save(lead + v + trail, isBtn && row.d != null ? d : null)} aria-label="حفظ" className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /></button>}
        {ok && <span className="p-1.5 text-primary"><Check className="h-4 w-4" /></span>}
        {edited && !changed && <button disabled={busy} onClick={async () => { await save(null, null); setV(core); setD(row.d ?? ""); }} aria-label="إرجاع النص الأصلي" title="إرجاع النص الأصلي" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><RotateCcw className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

export function BotFlow({ pw }: { pw: string }) {
  const list = useServerFn(listBotTexts);
  const saveFn = useServerFn(saveBotText);
  const { data: rows = [], refetch } = useQuery(offlineQuery({ queryKey: ["bot-texts"], queryFn: () => list({ data: { pw } }) }));
  const listSteps = useServerFn(listBotSteps);
  const { data: steps = [], refetch: refetchSteps } = useQuery(offlineQuery({ queryKey: ["bot-steps"], queryFn: () => listSteps({ data: { pw } }) }));
  const [adding, setAdding] = useState<string | null>(null);
  const saved = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(ORDER[0] ?? null);

  const sections = useMemo(() => {
    const qq = q.trim();
    const hit = (r: T) => !qq || r.o.includes(qq) || (saved.get(r.k)?.value ?? "").includes(qq);
    const bySec = new Map<string, Map<string, T[]>>();
    for (const r of TEXTS) {
      if (!bySec.has(r.s)) bySec.set(r.s, new Map());
      const g = bySec.get(r.s)!;
      if (!g.has(r.m)) g.set(r.m, []);
      g.get(r.m)!.push(r);
    }
    return ORDER.filter((s) => bySec.has(s)).map((s) => {
      const msgs = [...bySec.get(s)!.values()].filter((ms) => ms.some(hit));
      return { s, msgs, edited: msgs.flat().filter((r) => saved.has(r.k)).length };
    }).filter((x) => x.msgs.length);
  }, [q, saved]);

  const onSave = (k: string) => async (value: string | null, desc_value: string | null) => {
    await saveFn({ data: { pw, key: k, value, desc_value } });
    await refetch();
  };

  return (
    <div dir="rtl" className="space-y-3 p-3">
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm leading-6">
        <b>مسار البوت:</b> هنا كل رسائل البوت النصية وأزراره. عدّل أي نص أو اسم زر واضغط حفظ، والبوت يرسل الجديد من الرسالة التالية.
        الأرقام والأسماء التي يحسبها البوت (القدرة، السعر، اسم العميل) تُضاف تلقائياً بين الأجزاء ولا تحتاج تعديل. الملفات لا تتغير من هنا.
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن كلمة في رسالة أو زر..." aria-label="بحث"
          className="w-full rounded-lg border border-input bg-background py-2 pl-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="space-y-2 rounded-xl border bg-card p-2">
        <div className="flex items-center gap-2"><b className="flex-1 text-sm text-primary">خطوات مستقلة (تُفتح من خطوات أخرى)</b>
          <button onClick={() => setAdding("__free")} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground"><Plus className="h-3.5 w-3.5" />خطوة</button></div>
        {steps.filter((x) => !x.trigger_key).map((x) => <StepCard key={x.id} pw={pw} step={x} steps={steps} onChanged={() => void refetchSteps()} />)}
        {adding === "__free" && <StepEditor pw={pw} triggerKey={null} section={null} steps={steps} onDone={() => { setAdding(null); void refetchSteps(); }} />}
      </div>
      {sections.map(({ s, msgs, edited }) => {
        const isOpen = open === s || !!q.trim();
        return (
          <div key={s} className="rounded-xl border bg-card">
            <button onClick={() => setOpen(isOpen && !q ? null : s)} className="flex w-full items-center gap-2 p-3 text-right font-bold text-primary">
              <ChevronLeft className={`h-4 w-4 transition-transform ${isOpen ? "-rotate-90" : ""}`} />
              <span className="flex-1">{s}</span>
              {edited > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{edited} معدّل</span>}
              <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{msgs.length} رسالة</span>
            </button>
            {isOpen && (
              <div className="space-y-2 px-2 pb-2">
                {msgs.map((ms) => {
                  const texts = ms.filter((r) => r.t === "t");
                  const btns = ms.filter((r) => r.t === "b");
                  return (
                    <div key={ms[0]?.m} className="space-y-2 rounded-lg border bg-background p-2">
                      {texts.length > 0 && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquareText className="h-3.5 w-3.5" />رسالة{texts.length > 1 ? ` — ${texts.length} أجزاء، وبينها قيم يضيفها البوت` : ""}</div>}
                      {texts.map((r) => <Field key={r.k + (saved.get(r.k)?.updated_at ?? "")} row={r} saved={saved.get(r.k)} onSave={onSave(r.k)} />)}
                      {btns.length > 0 && <div className="text-xs text-muted-foreground">الأزرار / الخيارات</div>}
                      {btns.length > 0 && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {btns.map((r) => (
                          <div key={r.k} className="space-y-1">
                            <Field key={r.k + (saved.get(r.k)?.updated_at ?? "")} row={r} saved={saved.get(r.k)} onSave={onSave(r.k)} />
                            <button onClick={() => setAdding(r.k)} className="flex items-center gap-1 text-xs text-primary hover:underline"><Plus className="h-3 w-3" />إضافة خطوة بعد هذا الزر</button>
                          </div>
                        ))}
                      </div>}
                      {btns.map((r) => (
                        <div key={"s" + r.k} className="space-y-2">
                          {steps.filter((x) => x.trigger_key === r.k).map((x) => <div key={x.id}><div className="mb-1 text-xs text-muted-foreground">بعد زر «{r.o}»:</div><StepCard pw={pw} step={x} steps={steps} onChanged={() => void refetchSteps()} /></div>)}
                          {adding === r.k && <StepEditor pw={pw} triggerKey={r.k} section={s} steps={steps} onDone={() => { setAdding(null); void refetchSteps(); }} />}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

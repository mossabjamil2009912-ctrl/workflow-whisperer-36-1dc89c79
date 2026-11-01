import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Save, X, GitBranch, Power } from "lucide-react";
import { saveBotStep, deleteBotStep, listBotSteps } from "@/lib/crm.functions";
import ALL from "@/lib/bot-texts.json";

export type Step = Awaited<ReturnType<typeof listBotSteps>>[number];
type Opt = { title: string; desc?: string; goto: { type: "continue" | "step" | "button"; value: string } };
type T = { k: string; t: string; o: string; b?: string };

// Bot buttons a new step's option can jump to (unique by id+title).
const BTNS = (() => {
  const seen = new Set<string>(); const out: { id: string; title: string }[] = [];
  for (const r of ALL as T[]) if (r.t === "b" && r.b && !seen.has(r.b + r.o)) { seen.add(r.b + r.o); out.push({ id: r.b, title: r.o }); }
  return out;
})();

const optsOf = (s?: Step): Opt[] => (Array.isArray(s?.options) ? (s!.options as unknown as Opt[]) : []);
const stepName = (s: Step) => s.body.split("\n")[0].slice(0, 40);

export function StepEditor({ pw, step, triggerKey, section, steps, onDone }: { pw: string; step?: Step; triggerKey: string | null; section: string | null; steps: Step[]; onDone: () => void }) {
  const save = useServerFn(saveBotStep);
  const [body, setBody] = useState(step?.body ?? "");
  const [kind, setKind] = useState<"buttons" | "list">((step?.kind as "buttons" | "list") ?? "buttons");
  const [listBtn, setListBtn] = useState(step?.list_button ?? "الخيارات");
  const [opts, setOpts] = useState<Opt[]>(step ? optsOf(step) : [{ title: "", goto: { type: "continue", value: "" } }]);
  const [busy, setBusy] = useState(false);
  const max = kind === "list" ? 10 : 3;
  const setOpt = (i: number, o: Partial<Opt>) => setOpts(opts.map((x, j) => (j === i ? { ...x, ...o } : x)));
  const others = steps.filter((s) => s.id !== step?.id);
  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { pw, ...(step ? { id: step.id } : {}), trigger_key: triggerKey, section, body, kind, list_button: kind === "list" ? listBtn : null,
        options: opts.slice(0, max).map((o) => ({ title: o.title, ...(kind === "list" && o.desc ? { desc: o.desc } : {}), goto: o.goto })), active: step?.active ?? true } });
      onDone();
    } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded-lg border-2 border-dashed border-primary bg-primary/5 p-2">
      <div className="flex items-center gap-1 text-xs font-bold text-primary"><GitBranch className="h-3.5 w-3.5" />{step ? "تعديل الخطوة" : "خطوة جديدة"}</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} placeholder="نص الرسالة اللي يشوفها العميل..." className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>نوع الرد:</span>
        {(["buttons", "list"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-0.5 text-xs font-semibold ${kind === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{k === "buttons" ? "أزرار (حتى 3)" : "قائمة (حتى 10)"}</button>
        ))}
        {kind === "list" && <input value={listBtn} maxLength={20} onChange={(e) => setListBtn(e.target.value)} aria-label="اسم زر القائمة" placeholder="اسم زر القائمة" className="rounded border border-input bg-background px-2 py-0.5 text-xs" />}
      </div>
      {opts.slice(0, max).map((o, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md bg-background p-1.5">
          <input value={o.title} maxLength={kind === "list" ? 24 : 20} onChange={(e) => setOpt(i, { title: e.target.value })} placeholder="اسم الزر" aria-label="اسم الزر"
            className="w-36 rounded-full border border-input px-3 py-0.5 text-center text-sm font-semibold text-primary" />
          {kind === "list" && <input value={o.desc ?? ""} maxLength={72} onChange={(e) => setOpt(i, { desc: e.target.value })} placeholder="وصف (اختياري)" className="w-40 rounded border border-input px-2 py-0.5 text-xs" />}
          <span className="text-xs text-muted-foreground">يروح إلى:</span>
          <select value={o.goto.type === "continue" ? "continue" : `${o.goto.type}:${o.goto.value}`} aria-label="وين يروح"
            onChange={(e) => { const v = e.target.value; setOpt(i, { goto: v === "continue" ? { type: "continue", value: "" } : { type: v.split(":")[0] as "step" | "button", value: v.slice(v.indexOf(":") + 1) } }); }}
            className="max-w-56 rounded border border-input bg-background px-1 py-0.5 text-xs">
            <option value="continue">يكمل المسار الأصلي</option>
            {others.length > 0 && <optgroup label="خطوة مضافة">{others.map((s) => <option key={s.id} value={`step:${s.id}`}>{stepName(s)}</option>)}</optgroup>}
            <optgroup label="زر من البوت">{BTNS.map((b) => <option key={b.id + b.title} value={`button:${b.id}`}>{b.title}</option>)}</optgroup>
          </select>
          {opts.length > 1 && <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} aria-label="حذف الزر" className="p-1 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {opts.length < max && <button onClick={() => setOpts([...opts, { title: "", goto: { type: "continue", value: "" } }])} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"><Plus className="h-3.5 w-3.5" />زر</button>}
        <div className="flex-1" />
        <button onClick={onDone} className="rounded-md px-3 py-1 text-xs hover:bg-muted">إلغاء</button>
        <button disabled={busy || !body.trim() || opts.some((o) => !o.title.trim())} onClick={submit} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"><Save className="h-3.5 w-3.5" />حفظ الخطوة</button>
      </div>
    </div>
  );
}

export function StepCard({ pw, step, steps, onChanged }: { pw: string; step: Step; steps: Step[]; onChanged: () => void }) {
  const save = useServerFn(saveBotStep);
  const del = useServerFn(deleteBotStep);
  const [edit, setEdit] = useState(false);
  if (edit) return <StepEditor pw={pw} step={step} triggerKey={step.trigger_key} section={step.section} steps={steps} onDone={() => { setEdit(false); onChanged(); }} />;
  const opts = optsOf(step);
  const dest = (o: Opt) => o.goto.type === "continue" ? "يكمل المسار" : o.goto.type === "step" ? `خطوة: ${(steps.find((s) => s.id === o.goto.value) && stepName(steps.find((s) => s.id === o.goto.value)!)) || "محذوفة"}` : `زر: ${BTNS.find((b) => b.id === o.goto.value)?.title ?? o.goto.value}`;
  const toggle = async () => {
    await save({ data: { pw, id: step.id, trigger_key: step.trigger_key, section: step.section, body: step.body, kind: step.kind as "buttons" | "list", list_button: step.list_button, options: opts, active: !step.active } });
    onChanged();
  };
  return (
    <div className={`space-y-1.5 rounded-lg border-2 border-primary/60 bg-primary/5 p-2 ${step.active ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-1 text-xs font-bold text-primary"><GitBranch className="h-3.5 w-3.5" />خطوة مضافة{!step.active && " (موقوفة)"}<div className="flex-1" />
        <button onClick={() => setEdit(true)} className="rounded px-2 py-0.5 hover:bg-muted">تعديل</button>
        <button onClick={toggle} aria-label={step.active ? "إيقاف" : "تشغيل"} title={step.active ? "إيقاف" : "تشغيل"} className="rounded p-1 hover:bg-muted"><Power className="h-3.5 w-3.5" /></button>
        <button onClick={async () => { if (confirm("حذف هذه الخطوة؟")) { await del({ data: { pw, id: step.id } }); onChanged(); } }} aria-label="حذف الخطوة" className="rounded p-1 hover:bg-muted hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="whitespace-pre-wrap text-sm">{step.body}</div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o, i) => <span key={i} className="rounded-full border border-primary/40 bg-background px-2.5 py-0.5 text-xs"><b className="text-primary">{o.title}</b> ← {dest(o)}</span>)}
      </div>
    </div>
  );
}

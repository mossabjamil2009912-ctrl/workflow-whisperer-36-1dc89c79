import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Phone, MapPin, Wrench, Image as ImageIcon } from "lucide-react";
import { listTickets, updateTicket, draftVendorQuery, replyTicket } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";

type St = "open" | "in_progress" | "resolved";
const TABS: { k: St; label: string }[] = [
  { k: "open", label: "مفتوحة" },
  { k: "in_progress", label: "قيد المتابعة" },
  { k: "resolved", label: "تم الحل" },
];

export function useTickets(pw: string) {
  const list = useServerFn(listTickets);
  return useQuery(offlineQuery({ queryKey: ["tickets"], queryFn: () => list({ data: { pw } }), refetchInterval: 30000 }));
}

export function Tickets({ pw }: { pw: string }) {
  const { data: tickets = [], refetch } = useTickets(pw);
  const update = useServerFn(updateTicket);
  const [tab, setTab] = useState<St>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const shown = tickets.filter((t) => t.status === tab);

  async function act(id: string, status: St) {
    const msg = status === "in_progress" ? "استلام التذكرة وإبلاغ العميل؟" : "إغلاق التذكرة كمحلولة وإبلاغ العميل؟";
    if (!confirm(msg)) return;
    const assigned = status === "in_progress" ? prompt("اسم المهندس المسؤول (اختياري)") ?? undefined : undefined;
    setBusy(id); setErr("");
    try { await update({ data: { pw, id, status, assigned_to: assigned || undefined } }); await refetch(); }
    catch (x) { setErr(x instanceof Error ? x.message : "حدث خطأ"); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`rounded-lg border p-2 text-center text-sm ${tab === t.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            <div className="text-lg font-bold">{tickets.filter((x) => x.status === t.k).length}</div>
            <div className="text-xs">{t.label}</div>
          </button>
        ))}
      </div>
      {err && <p className="px-3 text-sm text-destructive">{err}</p>}
      <ul className="flex-1 space-y-2 overflow-y-auto p-3 pt-0">
        {shown.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">لا توجد تذاكر</li>}
        {shown.map((t) => (
          <li key={t.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span dir="ltr" className="font-mono text-sm font-bold text-primary">{t.ticket_no}</span>
              <span className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ar")}</span>
            </div>
            <div className="font-semibold">{t.name || "بدون اسم"}</div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <a href={`tel:+${t.phone}`} dir="ltr" className="flex items-center gap-1"><Phone className="h-3 w-3" />+{t.phone}</a>
              {t.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{t.city}</span>}
              {t.device && <span className="flex items-center gap-1"><Wrench className="h-3 w-3" />{t.device}</span>}
              {t.media_id && <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" />مرفق {t.media_type ?? ""}</span>}
            </div>
            {t.issue_type && <div className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">{t.issue_type}</div>}
            {t.description && <p className="whitespace-pre-wrap text-sm">{t.description}</p>}
            {t.assigned_to && <div className="text-xs text-muted-foreground">المهندس: {t.assigned_to}</div>}
            <div className="flex gap-2">
              {t.status === "open" && <button disabled={busy === t.id} onClick={() => act(t.id, "in_progress")} className="flex-1 rounded-lg bg-primary py-1.5 text-sm text-primary-foreground disabled:opacity-60">استلام</button>}
              {t.status !== "resolved" && <button disabled={busy === t.id} onClick={() => act(t.id, "resolved")} className="flex-1 rounded-lg border border-border py-1.5 text-sm disabled:opacity-60">تم الحل</button>}
            </div>
            {t.status !== "resolved" && <VendorBox pw={pw} id={t.id} onDone={() => refetch()} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VendorBox({ pw, id, onDone }: { pw: string; id: string; onDone: () => void }) {
  const draft = useServerFn(draftVendorQuery);
  const reply = useServerFn(replyTicket);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run(fn: () => Promise<void>) {
    setBusy(true); setMsg("");
    try { await fn(); } catch (x) { setMsg(x instanceof Error ? x.message : "حدث خطأ"); } finally { setBusy(false); }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="w-full rounded-lg border border-dashed border-border py-1.5 text-xs text-muted-foreground">استفسار من الشركة المصنّعة / إرسال حل للعميل</button>;
  return (
    <div className="space-y-2 rounded-lg bg-muted p-2 text-sm">
      <button disabled={busy} onClick={() => run(async () => { const r = await draft({ data: { pw, id } }); setQ(r.text); })}
        className="w-full rounded-lg border border-border bg-card py-1.5 text-xs disabled:opacity-60">{busy && !q ? "جاري الصياغة..." : "صياغة استفسار فني للمصنّع (إنجليزي)"}</button>
      {q && <>
        <textarea dir="ltr" value={q} onChange={(e) => setQ(e.target.value)} rows={6} className="w-full rounded-md border border-border bg-card p-2 text-xs" />
        <button onClick={() => navigator.clipboard.writeText(q)} className="text-xs text-primary">نسخ لإرساله للمصنّع</button>
        <p className="text-[11px] text-muted-foreground">لا يصل للعميل — أرسله لدعم الشركة المصنّعة بنفسك.</p>
      </>}
      <textarea value={ans} onChange={(e) => setAns(e.target.value)} rows={4} placeholder="اكتب الحل (بعد رد المصنّع) ليصل للعميل باسم أكتس"
        className="w-full rounded-md border border-border bg-card p-2 text-sm" />
      <button disabled={busy || ans.trim().length < 2} onClick={() => run(async () => { if (!confirm("إرسال الحل للعميل؟")) return; await reply({ data: { pw, id, text: ans.trim() } }); setAns(""); setMsg("تم الإرسال للعميل ✅"); onDone(); })}
        className="w-full rounded-lg bg-primary py-1.5 text-sm text-primary-foreground disabled:opacity-60">إرسال الحل للعميل</button>
      {msg && <p className="text-xs">{msg}</p>}
    </div>
  );
}

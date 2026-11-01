import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Send, Phone, Upload, Check, Trash2, X } from "lucide-react";
import { listReportRequests, uploadPresetReport, openPresetReport, sendReportRequest, deleteReportRequest, openRequestReport } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";
import { BOT_PRESETS } from "@/lib/bot-presets";
import { matchPreset } from "@/lib/report-rules";
import { parseSystem, DIR_LABEL, type Direction } from "@/lib/pvsyst-calc";
const CITY_AR: Record<string, string> = { sanaa: "صنعاء", aden: "عدن", other: "موقع العميل" };
import { REPORT_LABEL, type ReportKind } from "@/lib/report-rules";

const TITLES = BOT_PRESETS.map((p) => p.title);

export function useReports(pw: string) {
  const list = useServerFn(listReportRequests);
  return useQuery(offlineQuery({ queryKey: ["reports"], queryFn: () => list({ data: { pw } }), refetchInterval: 30000 }));
}

function toB64(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export function Reports({ pw }: { pw: string }) {
  const { data, refetch } = useReports(pw);
  const requests = data?.requests ?? [];
  const files = data?.files ?? [];
  const has = (t: string, k: string) => files.some((f) => f.preset_title === t && f.kind === k);
  const open = useServerFn(openPresetReport);
  const send = useServerFn(sendReportRequest);
  const upload = useServerFn(uploadPresetReport);
  const [tab, setTab] = useState<"pending" | "sent" | "files">("pending");
  const openReq = useServerFn(openRequestReport);
  const del = useServerFn(deleteReportRequest);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<{ id: string; url: string; title: string; pending: boolean } | null>(null);
  function closePreview() { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }
  async function openPreview(r: { id: string; name: string | null; status: string }) {
    await run("v" + r.id, async () => {
      const { url } = await openReq({ data: { pw, id: r.id } });
      const blob = await (await fetch(url)).blob();
      setPreview({ id: r.id, url: URL.createObjectURL(new Blob([blob], { type: "application/pdf" })), title: `${r.name || "عميل"} · تقرير`, pending: r.status === "pending" });
      await refetch();
    });
  }

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setErr("");
    try { await fn(); } catch (x) { setErr(x instanceof Error ? x.message : "حدث خطأ"); } finally { setBusy(null); }
  }
  async function view(title: string, kind: string) {
    const w = window.open("", "_blank");
    await run("v" + title + kind, async () => {
      const { url } = await open({ data: { pw, preset_title: title, kind: kind as ReportKind } });
      if (w) w.location.href = url; else window.location.href = url;
    });
  }

  const shown = requests.filter((r) => r.status === tab);
  const fmt = (d: string) => new Date(d).toLocaleString("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {([["pending", "جديدة"], ["sent", "مُرسلة"], ["files", "ملفات المنظومات"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-lg border px-2 py-2 text-sm font-medium ${tab === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
            {l}{k !== "files" && <span className="opacity-80"> ({requests.filter((r) => r.status === k).length})</span>}
          </button>
        ))}
      </div>
      {err && <p className="px-3 pb-2 text-xs text-destructive">{err}</p>}

      {tab === "files" ? (
        <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {TITLES.map((t) => (
            <li key={t} className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-semibold">{t}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["pvsyst", "sld"] as const).map((k) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {REPORT_LABEL[k]} {has(t, k) && <Check className="h-3 w-3 text-primary" />}
                    </span>
                    <div className="flex gap-1">
                      <label className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs">
                        <Upload className="h-3 w-3" />{busy === "u" + t + k ? "..." : has(t, k) ? "استبدال" : "رفع PDF"}
                        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0]; e.target.value = "";
                          if (f) run("u" + t + k, async () => { await upload({ data: { pw, preset_title: t, kind: k, file_name: f.name, b64: await toB64(f) } }); await refetch(); });
                        }} />
                      </label>
                      {has(t, k) && <button onClick={() => view(t, k)} className="rounded-lg border border-border px-2"><Eye className="h-3 w-3" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {shown.map((r) => {
            const sel = matchPreset(r.system_label, files.filter((f) => f.kind === r.kind).map((f) => f.preset_title));
            const auto = !!parseSystem(r.system_label);
            const ready = !!r.file_path || !!sel || auto;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{r.name || "عميل"} · {REPORT_LABEL[r.kind as ReportKind] ?? r.kind}</span>
                  <span className="text-[11px] text-muted-foreground">{fmt(r.created_at)}</span>
                </div>
                <span dir="ltr" className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />+{r.phone}</span>
                {r.system_label && <p className="mt-1 text-xs">المنظومة: {r.system_label}</p>}
                {r.kind === "pvsyst" && (r.city || r.azimuth || r.tilt != null) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[r.city && CITY_AR[r.city], r.azimuth && `الاتجاه: ${DIR_LABEL[r.azimuth as Direction] ?? r.azimuth}`, `الميلان: ${r.tilt != null ? `${r.tilt}°` : "الأنسب"}`].filter(Boolean).join(" · ")}
                  </p>
                )}
                {r.status === "pending" ? (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {r.file_path ? `التقرير: ${r.file_name ?? ""}` : auto ? "تقرير جاهز لمنظومة العميل" : sel ? `التقرير: ${sel}` : ""}
                    </p>
                    {!ready && <p className="mt-1 text-xs text-destructive">لا يوجد مخطط لهذه المنظومة — ارفعه من «ملفات المنظومات»</p>}
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <button disabled={!ready || busy === "v" + r.id} onClick={() => openPreview(r)} className="flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs font-semibold disabled:opacity-50">
                        <Eye className="h-4 w-4" />{busy === "v" + r.id ? "..." : "فتح"}
                      </button>
                      
                      <button disabled={!ready || busy === r.id} onClick={() => {
                        if (confirm("إرسال التقرير للعميل على واتساب؟")) run(r.id, async () => { await send({ data: { pw, id: r.id } }); await refetch(); });
                      }} className="flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                        <Send className="h-4 w-4" />إرسال
                      </button>
                      <button disabled={busy === "d" + r.id} onClick={() => {
                        if (confirm("حذف هذا الطلب؟")) run("d" + r.id, async () => { await del({ data: { pw, id: r.id } }); await refetch(); });
                      }} className="flex items-center justify-center gap-1 rounded-lg border border-destructive/40 py-2 text-xs font-semibold text-destructive disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />حذف
                      </button>
                    </div>
                  </>
                ) : r.sent_at && <p className="mt-2 text-[11px] text-muted-foreground">أُرسل في {fmt(r.sent_at)}</p>}
              </li>
            );
          })}
          {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات هنا</li>}
        </ul>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-2 animate-in fade-in" onClick={closePreview}>
          <div className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b p-2">
              <b className="flex-1 truncate text-sm">{preview.title}</b>
              <button onClick={closePreview} className="rounded-md p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <iframe title="معاينة التقرير" src={preview.url} className="min-h-0 w-full flex-1 bg-background" />
            <div className="grid grid-cols-2 gap-2 border-t p-2">
              <button disabled={!preview.pending || busy === preview.id} onClick={() => {
                if (confirm("إرسال التقرير للعميل على واتساب؟")) run(preview.id, async () => { await send({ data: { pw, id: preview.id } }); closePreview(); await refetch(); });
              }} className="flex items-center justify-center gap-1 rounded-md bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{preview.pending ? "إرسال" : "تم الإرسال"}</button>
              <button onClick={closePreview} className="flex items-center justify-center gap-1 rounded-md bg-muted py-2 text-sm font-bold"><X className="h-4 w-4" />إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

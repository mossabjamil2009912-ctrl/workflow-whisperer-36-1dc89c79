import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Phone, MapPin } from "lucide-react";
import { listOrders, decideOrder } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";

type St = "pending" | "confirmed" | "cancelled";
const TABS: { k: St; label: string }[] = [
  { k: "pending", label: "معلقة" },
  { k: "confirmed", label: "مؤكدة" },
  { k: "cancelled", label: "ملغية" },
];

export function useOrders(pw: string) {
  const list = useServerFn(listOrders);
  return useQuery(offlineQuery({ queryKey: ["orders"], queryFn: () => list({ data: { pw } }), refetchInterval: 30000 }));
}

export function Orders({ pw }: { pw: string }) {
  const { data: orders = [], refetch } = useOrders(pw);
  const decide = useServerFn(decideOrder);
  const [tab, setTab] = useState<St>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const shown = orders.filter((o) => o.status === tab);

  async function act(id: string, status: "confirmed" | "cancelled") {
    if (!confirm(status === "confirmed" ? "تأكيد الطلب وإرسال إشعار للعميل؟" : "إلغاء الطلب وإرسال إشعار للعميل؟")) return;
    setBusy(id); setErr("");
    try { await decide({ data: { pw, id, status } }); await refetch(); }
    catch (x) { setErr(x instanceof Error ? x.message : "حدث خطأ"); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {TABS.map((t) => {
          const n = orders.filter((o) => o.status === t.k).length;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`rounded-lg border px-2 py-2 text-sm font-medium ${tab === t.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              {t.label} <span className="opacity-80">({n})</span>
            </button>
          );
        })}
      </div>
      {err && <p className="px-3 pb-2 text-xs text-destructive">{err}</p>}
      <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {shown.map((o) => (
          <li key={o.id} className="rounded-xl border border-border bg-card p-3 text-sm shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{o.name || "عميل"}</span>
              <span className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleString("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span dir="ltr" className="flex items-center gap-1"><Phone className="h-3 w-3" />+{o.phone}</span>
              {o.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.city}</span>}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
              {o.method && <><dt className="text-muted-foreground">الطريقة</dt><dd>{o.method}</dd></>}
              {o.invoice_no && <><dt className="text-muted-foreground">رقم الفاتورة</dt><dd>{o.invoice_no}</dd></>}
              {o.amount && <><dt className="text-muted-foreground">حساب الفاتورة</dt><dd>{o.amount}</dd></>}
            </dl>
            {o.details && <p className="mt-2 whitespace-pre-wrap rounded bg-muted p-2 text-xs">{o.details}</p>}
            {o.status === "pending" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={busy === o.id} onClick={() => act(o.id, "confirmed")}
                  className="flex items-center justify-center gap-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground disabled:opacity-50">
                  <Check className="h-4 w-4" />تأكيد
                </button>
                <button disabled={busy === o.id} onClick={() => act(o.id, "cancelled")}
                  className="flex items-center justify-center gap-1 rounded-lg bg-destructive py-2 font-semibold text-destructive-foreground disabled:opacity-50">
                  <X className="h-4 w-4" />إلغاء
                </button>
              </div>
            ) : o.decided_at && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {o.status === "confirmed" ? "أُكّد" : "أُلغي"} في {new Date(o.decided_at).toLocaleString("ar", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات هنا</li>}
      </ul>
    </div>
  );
}

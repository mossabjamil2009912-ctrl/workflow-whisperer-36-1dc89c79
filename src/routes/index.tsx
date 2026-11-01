import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WaText } from "@/components/WaText";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, FileText, Search, Phone, MapPin, Sun, MessageCircle, Lock, Send, Bell, BellOff, Bot, User, Moon, Copy, Check, Clock, Download, Info, StickyNote, Headphones, LayoutGrid, Image as ImageIcon, Inbox, ShoppingCart, UserPlus, Wallet } from "lucide-react";

let audioCtx: AudioContext | null = null;
function playChime() {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.15;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch { /* ignore */ }
}
import { STAGES, type Stage } from "@/lib/crm-data";
import { listCustomers, getMessages, sendMessage, sendAttachment, saveNote, setBotPaused, listCatalog, listOrders, listTickets, listReportRequests, listQuotes, getKwhPrice } from "@/lib/crm.functions";
import { enqueue, flush, isNetworkError, usePending } from "@/lib/outbox";
import { offlineQuery, snapshotTime } from "@/lib/offline-cache";
import { Paperclip, X } from "lucide-react";
import { Orders, useOrders } from "@/components/Orders";
import { Tickets, useTickets } from "@/components/Tickets";
import { Catalog } from "@/components/Catalog";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { FilePlus2, FileBarChart } from "lucide-react";
import { Reports, useReports } from "@/components/Reports";
import logo from "@/assets/actes-logo.png";
import logoClean from "@/assets/actes-logo-clean.png";
import waBg from "@/assets/actes-wa-bg.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ACTES — لوحة محادثات عملاء البوت" },
      { name: "description", content: "عرض أرقام ومحادثات جميع عملاء بوت واتساب ACTES للطاقة الشمسية." },
      { property: "og:title", content: "ACTES — لوحة محادثات عملاء البوت" },
      { property: "og:description", content: "متابعة العملاء وعروض الأسعار ومخططات SLD من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const PW_KEY = "actes_pw";

const stageClass: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  quote: "bg-st-quote text-st-quote-fg",
  sld: "bg-st-sld text-st-sld-fg",
  cod: "bg-st-cod text-st-cod-fg",
  buy: "bg-st-buy text-st-buy-fg",
  human: "bg-st-human text-st-human-fg",
};

type SysT = "res" | "com" | "agri";
const SYS: Record<SysT, string> = { res: "🏠 سكني", com: "🏢 تجاري", agri: "🌾 زراعي" };
function sysType(s: string | null): SysT | null {
  if (!s) return null;
  if (/زراع|مضخ|غطاس|ري\b/.test(s)) return "agri";
  if (/تجار|مصنع|شرك|مؤسس/.test(s)) return "com";
  if (/سكن|منزل|بيت/.test(s)) return "res";
  return null;
}

function dayLabel(t: string) {
  const d = new Date(t); const n = new Date();
  if (d.toDateString() === n.toDateString()) return "اليوم";
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "أمس";
  return d.toLocaleDateString("ar", { day: "numeric", month: "long", year: d.getFullYear() === n.getFullYear() ? undefined : "numeric" });
}

function exportCsv(rows: { name: string | null; phone: string; city: string | null; stage: string; system: string | null; last_at: string; notes: string | null }[], orders: { phone: string; invoice_no: string | null; amount: string | null; status: string }[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const head = ["الاسم", "الرقم", "المدينة", "الحالة", "نوع المنظومة", "المنظومة", "الطلبات", "آخر نشاط", "ملاحظات"];
  const lines = rows.map((c) => {
    const d = c.phone.replace(/\D/g, "").slice(-9);
    const os = orders.filter((o) => o.phone.replace(/\D/g, "").endsWith(d)).map((o) => [o.invoice_no, o.amount, orderStatus[o.status] ?? o.status].filter(Boolean).join(" "));
    const t = sysType(c.system);
    return [c.name, "+" + c.phone.replace(/^\+/, ""), c.city, STAGES[c.stage as Stage] ?? c.stage, t ? SYS[t].slice(3) : "", c.system, os.join(" | "), new Date(c.last_at).toLocaleString("ar"), c.notes].map(esc).join(",");
  });
  const blob = new Blob(["\uFEFF" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ACTES-عملاء-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function fmt(t: string) {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ar", { day: "numeric", month: "short" });
}

function Index() {
  const [pw, setPw] = useState<string | null>(null);
  useEffect(() => { setPw(localStorage.getItem(PW_KEY)); }, []);
  if (!pw) return <Login onOk={(p) => { localStorage.setItem(PW_KEY, p); setPw(p); }} />;
  return <Dashboard pw={pw} onLogout={() => { localStorage.removeItem(PW_KEY); setPw(null); }} />;
}

function Login({ onOk }: { onOk: (p: string) => void }) {
  const list = useServerFn(listCustomers);
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { await list({ data: { pw: v } }); onOk(v); }
          catch { setErr("كلمة المرور غير صحيحة"); }
          finally { setBusy(false); }
        }}
      >
        <div className="flex flex-col items-center gap-1 text-primary"><img src={logo} alt="ACTES أكتس" className="h-16 w-auto" /><h1 className="text-xl font-bold">محادثات العملاء</h1></div>
        <label className="block text-sm text-muted-foreground">كلمة مرور اللوحة</label>
        <div className="relative">
          <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="password" value={v} onChange={(e) => setV(e.target.value)} className="w-full rounded-lg border border-input bg-background py-2 pl-3 pr-9 outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy || !v} className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ pw, onLogout }: { pw: string; onLogout: () => void }) {
  const list = useServerFn(listCustomers);
  const { data: customers = [], isLoading } = useQuery(offlineQuery({
    queryKey: ["customers"],
    queryFn: () => list({ data: { pw } }),
    refetchInterval: 20000,
  }));
  // حفظ كل المحادثات على الجهاز للعمل دون إنترنت
  const qcAll = useQueryClient();
  const getAll = useServerFn(getMessages);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const u = () => setOnline(navigator.onLine); u();
    window.addEventListener("online", u); window.addEventListener("offline", u);
    return () => { window.removeEventListener("online", u); window.removeEventListener("offline", u); };
  }, []);
  const synced = useRef(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const listCat = useServerFn(listCatalog), listOrd = useServerFn(listOrders), listTic = useServerFn(listTickets);
  const listRep = useServerFn(listReportRequests), listQ = useServerFn(listQuotes), getKwh = useServerFn(getKwhPrice);
  // تنزيل نسخة كاملة على الجهاز: كل الشاشات وكل المحادثات — حتى يفتح التطبيق دون إنترنت
  useEffect(() => {
    if (!online || synced.current || customers.length === 0) return;
    synced.current = true;
    (async () => {
      const screens = [
        async () => { await qcAll.prefetchQuery(offlineQuery({ queryKey: ["catalog"], queryFn: () => listCat({ data: { pw } }) })); },
        async () => { await qcAll.prefetchQuery(offlineQuery({ queryKey: ["orders"], queryFn: () => listOrd({ data: { pw } }) })); },
        async () => { await qcAll.prefetchQuery(offlineQuery({ queryKey: ["tickets"], queryFn: () => listTic({ data: { pw } }) })); },
        async () => { await qcAll.prefetchQuery(offlineQuery({ queryKey: ["reports"], queryFn: () => listRep({ data: { pw } }) })); },
        async () => { await qcAll.prefetchQuery(offlineQuery({ queryKey: ["quotes"], queryFn: () => listQ({ data: { pw } }) })); },
        async () => { await qcAll.prefetchQuery(offlineQuery({ queryKey: ["kwh_price"], queryFn: () => getKwh({ data: { pw } }) })); },
      ];
      for (const s of screens) {
        if (!navigator.onLine) break;
        await s().catch(() => {});
      }
      for (const c of customers) {
        if (!navigator.onLine) break;
        await qcAll.prefetchQuery(offlineQuery({ queryKey: ["messages", c.id], queryFn: () => getAll({ data: { pw, id: c.id } }), staleTime: 60_000 })).catch(() => {});
      }
      void snapshotTime(["customers"]).then(setSavedAt);
    })();
  }, [online, customers, qcAll, getAll, pw, listCat, listOrd, listTic, listRep, listQ, getKwh]);
  // إرسال الرسائل المعلّقة تلقائياً عند عودة الاتصال
  const sendQueued = useServerFn(sendMessage);
  const pendingAll = usePending();
  useEffect(() => {
    if (!online || pendingAll.length === 0) return;
    void flush(async (m) => {
      await sendQueued({ data: { pw, id: m.id, text: m.text } });
      void qcAll.invalidateQueries({ queryKey: ["messages", m.id] });
    });
  }, [online, pendingAll.length, sendQueued, pw, qcAll]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Stage | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"chats" | "orders" | "reports" | "tickets" | "catalog" | "quote">("chats");
  const { data: rep } = useReports(pw);
  const pendingReports = (rep?.requests ?? []).filter((r) => r.status === "pending").length;
  const { data: tickets = [] } = useTickets(pw);
  const openTickets = tickets.filter((t) => t.status === "open").length;
  const { data: orders = [] } = useOrders(pw);
  const pending = orders.filter((o) => o.status === "pending").length;

  const [city, setCity] = useState("");
  const [sys, setSys] = useState("");
  const cities = useMemo(() => [...new Set(customers.map((c) => (c.city ?? "").trim()).filter(Boolean))].sort(), [customers]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [info, setInfo] = useState(false);
  useEffect(() => { setInfo(false); }, [openId]);
  const shown = useMemo(() => customers.filter((c) =>
    (filter === "all" || c.stage === filter) &&
    (!unreadOnly || c.unread > 0) &&
    (!city || (c.city ?? "").trim() === city) &&
    (!sys || sysType(c.system) === sys) &&
    (() => {
      const t = q.trim().toLowerCase();
      if (!t) return true;
      const d = t.replace(/\D/g, "").replace(/^0+/, "");
      return (c.name ?? "").toLowerCase().includes(t) || (d.length > 0 && c.phone.replace(/\D/g, "").includes(d));
    })()), [customers, q, filter, city, sys, unreadOnly]);
  const open = customers.find((c) => c.id === openId) ?? null;
  const openOrders = open ? orders.filter((o) => o.customer_id === open.id || o.phone.replace(/\D/g, "").endsWith(open.phone.replace(/\D/g, "").slice(-9))) : [];

  const [muted, setMuted] = useState(false);
  useEffect(() => { setMuted(localStorage.getItem("actes_mute") === "1"); }, []);
  const prevSig = useRef<{ unread: number; count: number } | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const sig = { unread: customers.reduce((s, c) => s + (c.unread || 0), 0), count: customers.length };
    const p = prevSig.current;
    prevSig.current = sig;
    if (p && !muted && (sig.unread > p.unread || sig.count > p.count)) playChime();
  }, [customers, isLoading, muted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stats: { key: Stage | "all"; label: string; value: number }[] = [
    { key: "all", label: "العملاء", value: customers.length },
    { key: "quote" as Stage, label: "عروض أسعار", value: customers.filter((c) => c.stage === "quote").length },
    { key: "sld" as Stage, label: "مخططات SLD", value: customers.filter((c) => c.stage === "sld").length },
    { key: "cod" as Stage, label: "عند الاستلام", value: customers.filter((c) => c.stage === "cod").length },
    { key: "buy" as Stage, label: "جاهز للشراء", value: customers.filter((c) => c.stage === "buy").length },
  ];

  const [dark, setDark] = useState(false);
  useEffect(() => { const d = localStorage.getItem("actes_dark") === "1"; setDark(d); document.documentElement.classList.toggle("dark", d); }, []);
  const toggleDark = () => { const d = !dark; setDark(d); localStorage.setItem("actes_dark", d ? "1" : "0"); document.documentElement.classList.toggle("dark", d); };
  const [wide, setWide] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(min-width: 1024px)"); const f = () => setWide(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);

  const statStyle: Record<string, { icon: typeof User; c: string }> = {
    all: { icon: User, c: "s-purple" }, quote: { icon: FileText, c: "s-green" }, sld: { icon: ImageIcon, c: "s-blue" },
    cod: { icon: Inbox, c: "s-gray" }, buy: { icon: ShoppingCart, c: "s-red" },
  };
  const stageIcon: Record<string, typeof User> = { new: UserPlus, quote: FileText, sld: ImageIcon, cod: Wallet, buy: ShoppingCart, human: User };
  const tabs = [
    { k: "chats" as const, l: "المحادثات", i: MessageCircle, n: 0 },
    { k: "orders" as const, l: "الطلبات", i: FileText, n: pending },
    { k: "reports" as const, l: "التقارير", i: FileBarChart, n: pendingReports },
    { k: "tickets" as const, l: "الدعم الفني", i: Headphones, n: openTickets },
    { k: "catalog" as const, l: "الأصناف", i: LayoutGrid, n: 0 },
    { k: "quote" as const, l: "إنشاء عرض سعر", i: FilePlus2, n: 0 },
  ];

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background text-foreground lg:h-screen lg:overflow-hidden">
      {!online && (
        <div className="bg-accent px-3 py-1 text-center text-xs font-semibold text-accent-foreground">
          أنت دون إنترنت — {savedAt ? `تعرض آخر نسخة محفوظة على الجهاز من {new Date(savedAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}` : "لم تُحفظ نسخة على الجهاز بعد — افتح التطبيق مرة واحدة والإنترنت شغّال"}، وتتحدث تلقائياُ عند عودة الاتصال
        </div>
      )}
      <header className="relative overflow-hidden bg-ink px-4 py-3 text-ink-foreground md:px-8 lg:py-1">
        <div className="pointer-events-none absolute -top-10 left-[30%] h-40 w-1.5 rotate-[35deg] bg-primary" />
        <div className="pointer-events-none absolute -top-10 left-[31.5%] h-40 w-px rotate-[35deg] bg-primary/50" />
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 md:flex-nowrap">
          <h1 className="flex shrink-0 items-center gap-2 text-sm font-bold md:text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><MessageCircle className="h-4 w-4" /></span>
            محادثات العملاء
          </h1>
          <nav className="order-last flex w-full items-center gap-1 md:order-none md:w-auto md:flex-1 md:justify-center">
            {tabs.map((t) => (
              <button key={t.k} onClick={() => { setView(t.k); if (t.k !== "chats") setOpenId(null); }}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold md:flex-none md:px-3 md:text-sm ${view === t.k ? "bg-primary text-primary-foreground shadow" : "hover:bg-ink-foreground/10"}`}>
                <t.i className="h-4 w-4" />{t.l}
                {t.n > 0 && <span className="absolute -top-1 left-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">{t.n}</span>}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={toggleDark} aria-label={dark ? "الوضع الفاتح" : "الوضع الليلي"} className="rounded-md p-1.5 hover:bg-ink-foreground/10">
              {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button onClick={() => { const m = !muted; setMuted(m); localStorage.setItem("actes_mute", m ? "1" : "0"); if (!m) playChime(); }}
              aria-label={muted ? "تشغيل صوت التنبيه" : "كتم صوت التنبيه"} className="rounded-md p-1.5 hover:bg-ink-foreground/10">
              {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            </button>
            <img src={logoClean} alt="ACTES أكتس" className="h-9 w-auto shrink-0 md:h-10 lg:h-8" />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-3 p-3 md:p-4 lg:flex lg:min-h-0 lg:flex-col lg:space-y-2 lg:p-2">

        {view === "orders" ? <div className="rounded-xl border border-border bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"><Orders pw={pw} /></div>
        : view === "reports" ? <div className="rounded-xl border border-border bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"><Reports pw={pw} /></div>
        : view === "tickets" ? <div className="rounded-xl border border-border bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"><Tickets pw={pw} /></div>
        : view === "catalog" ? <div className="rounded-xl border border-border bg-card lg:min-h-0 lg:flex-1 lg:overflow-y-auto"><Catalog pw={pw} /></div>
        : view === "quote" ? <div className="rounded-xl border border-border bg-background lg:min-h-0 lg:flex-1 lg:overflow-hidden"><QuoteBuilder pw={pw} /></div> : <>
        <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-3">
        <div className="min-w-0 space-y-3 lg:flex lg:min-h-0 lg:flex-col">


        <div className="space-y-2.5 rounded-xl border border-border bg-card p-2.5 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:space-y-1.5 lg:p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم العميل أو رقمه..."
              aria-label="بحث عن عميل" className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring" />
            {q && <button onClick={() => setQ("")} aria-label="مسح البحث" className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["all", "human", "quote", "cod", "buy"] as (Stage | "all")[]).map((s) => {
              const n = customers.filter((c) => c.unread > 0 && (s === "all" || c.stage === s)).length;
              const Ic = s === "all" ? null : stageIcon[s];
              return (
              <button key={s} onClick={() => setFilter(s)}
                className={`relative mt-2 lg:mt-1.5 flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs md:text-sm ${s === "human" ? `bg-st-human-fg text-background ${filter === s ? "font-semibold ring-2 ring-st-human-fg ring-offset-1" : ""}` : filter === s ? "bg-primary font-semibold text-primary-foreground" : "bg-muted text-foreground"}`}>
                {Ic && <Ic className="h-4 w-4" />}{s === "all" ? "الكل" : STAGES[s]}
                <span className="rounded-full bg-background/70 px-1.5 text-[11px] font-bold text-foreground">{s === "all" ? customers.length : customers.filter((c) => c.stage === s).length}</span>
                {n > 0 && <span className="absolute -top-2 -left-1 min-w-[18px] animate-pulse rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground">{n}</span>}
              </button>
            );})}
          </div>
          <ul className="overflow-hidden rounded-lg border border-border lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
            {shown.map((c) => (
              <li key={c.id} onClick={() => setOpenId(c.id)} className={`flex cursor-pointer items-center gap-3 border-b border-r-4 border-b-border px-3 py-2.5 transition last:border-b-0 hover:bg-muted/60 ${openId === c.id ? "border-r-primary bg-primary/10" : "border-r-transparent"}`}>
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <User className="h-5 w-5" /><span className="absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-s-green" />
                </div>
                <div className="min-w-0 w-40 shrink-0 md:w-52">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{c.name || c.phone}</span>
                    {c.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{c.unread}</span>}
                  </div>
                  <div dir="ltr" className="text-right text-xs text-muted-foreground">+{c.phone.replace(/^\+/, "")}</div>
                  {c.system && <div className="truncate text-[11px] text-muted-foreground">{c.system}</div>}
                </div>
                <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:inline ${stageClass[c.stage] ?? stageClass["new"]}`}>{STAGES[c.stage as Stage] ?? c.stage}</span>
                <div className="line-clamp-2 min-w-0 flex-1 text-xs text-muted-foreground">{c.last_message}</div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{fmt(c.last_at)}</span>
              </li>
            ))}
            {!isLoading && shown.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {customers.length === 0 ? "لا توجد محادثات بعد — ستظهر هنا فور تواصل العملاء مع البوت" : "لا توجد نتائج"}
              </li>
            )}
          </ul>
        </div>
        </div>
        {wide && (
          <aside className="hidden h-full min-h-0 overscroll-contain lg:flex"
            ref={(el) => {
              if (!el || el.dataset["w"]) return;
              el.dataset["w"] = "1";
              el.addEventListener("wheel", (ev) => {
                ev.preventDefault();
                const t = ev.target as HTMLElement;
                const box = (t.closest?.("[data-scroll]") ?? el.querySelector("[data-chat-scroll]")) as HTMLElement | null;
                if (!box) return;
                const k = ev.deltaMode === 1 ? 32 : ev.deltaMode === 2 ? box.clientHeight : 1;
                box.scrollTop += ev.deltaY * k;
              }, { passive: false });
            }}>
            {open ? (
              <div className="relative flex h-full">
                <Chat pw={pw} c={open} onBack={() => setOpenId(null)} onInfo={() => setInfo(true)} />
                {info && <Details pw={pw} c={open} orders={openOrders} drawer onClose={() => setInfo(false)} />}
              </div>
            ) : (
              <div className="relative flex aspect-[9/19] h-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[2.6rem] border-[10px] border-phone bg-phone text-wa-muted shadow-2xl">
                <div className="absolute left-1/2 top-1.5 h-5 w-24 -translate-x-1/2 rounded-full bg-background/10" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-wa-text/10 via-transparent to-transparent" />
                <img src={logoClean} alt="" className="h-14 w-auto opacity-30" />
                <MessageCircle className="h-8 w-8 opacity-40" />
                <span className="px-6 text-center text-xs opacity-60">اختر محادثة من القائمة لعرضها هنا</span>
              </div>
            )}
          </aside>
        )}
        </div>
        </>}
      </div>
      <footer className="relative overflow-hidden bg-ink py-2.5 lg:hidden text-center text-xs font-semibold text-ink-foreground">
        <div className="pointer-events-none absolute -bottom-6 right-[8%] h-16 w-1.5 rotate-[35deg] bg-primary" />
        ACTES — لأنظمة الطاقة وحلولها
        <span className="absolute left-6 top-1/2 hidden h-px w-32 -translate-y-1/2 bg-ink-foreground/30 md:block" />
        <span className="absolute left-[9.5rem] top-1/2 hidden -translate-y-1/2 text-primary md:block">⌁</span>
      </footer>

      {open && !wide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 md:py-3" onClick={() => setOpenId(null)}>
          <div className="relative flex h-full w-full justify-center gap-4 overflow-hidden md:w-auto" onClick={(e) => e.stopPropagation()}>
            <main className="flex min-w-0 flex-1 flex-col">
              <Chat pw={pw} c={open} onBack={() => setOpenId(null)} onInfo={view === "chats" ? () => setInfo(true) : undefined} />
            </main>
            {view === "chats" && <Details pw={pw} c={open} orders={openOrders} />}
            {view === "chats" && info && <>
              <div className="absolute inset-0 z-[5] bg-foreground/30 xl:hidden" onClick={() => setInfo(false)} />
              <Details pw={pw} c={open} orders={openOrders} drawer onClose={() => setInfo(false)} />
            </>}
          </div>
        </div>
      )}
    </div>
  );
}

const orderStatus: Record<string, string> = { pending: "معلقة", confirmed: "مؤكدة", cancelled: "ملغية" };

function Details({ pw, c, orders, drawer, onClose }: { pw: string; c: Cust; drawer?: boolean; onClose?: () => void; orders: { id: string; status: string; amount: string | null; invoice_no: string | null; method: string | null; created_at: string }[] }) {
  const stage = c.stage as Stage;
  const digits = c.phone.replace(/\D/g, "");
  const parts = (c.system ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  const save = useServerFn(saveNote);
  const qc = useQueryClient();
  const [note, setNote] = useState(c.notes ?? "");
  const [saved, setSaved] = useState<"" | "busy" | "ok" | "err">("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setNote(c.notes ?? ""); setSaved(""); }, [c.id]);
  const t = sysType(c.system);
  return (
    <aside data-scroll className={drawer
      ? "absolute inset-y-0 left-0 z-10 flex w-[88%] max-w-sm flex-col gap-3 overflow-y-auto border-r border-border bg-background p-4 shadow-2xl"
      : "hidden w-80 shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-muted/40 p-4 xl:flex"}>
      {drawer && <button onClick={onClose} className="self-start rounded-lg border border-border px-3 py-1 text-xs hover:bg-muted">✕ إغلاق</button>}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-secondary-foreground">{(c.name ?? "#")[0]}</div>
        <div className="font-bold">{c.name || "عميل"}</div>
        <div className="flex items-center gap-1.5">
          <span dir="ltr" className="text-sm text-muted-foreground">+{digits}</span>
          <button onClick={() => { void navigator.clipboard.writeText("+" + digits); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            aria-label="نسخ الرقم" title="نسخ الرقم" className="rounded p-1 hover:bg-muted">
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        {c.city && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{c.city}</div>}
        <div className="flex flex-wrap justify-center gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stageClass[stage] ?? stageClass["new"]}`}>{STAGES[stage] ?? stage}</span>
          {t && <span className="rounded-full border border-border px-2 py-0.5 text-xs">{SYS[t]}</span>}
        </div>
        <div className="mt-1 grid w-full grid-cols-2 gap-2">
          <a href={`tel:+${digits}`} className="flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs hover:bg-muted"><Phone className="h-3.5 w-3.5" />اتصال</a>
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs text-primary-foreground"><MessageCircle className="h-3.5 w-3.5" />واتساب</a>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><StickyNote className="h-4 w-4 text-primary" />ملاحظات داخلية</h3>
        <textarea value={note} onChange={(e) => { setNote(e.target.value); setSaved(""); }} rows={3} placeholder="خاصة بفريق العمل — لا تُرسل للعميل"
          className="w-full resize-y rounded-lg border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{saved === "ok" ? "تم الحفظ ✓" : saved === "err" ? "تعذّر الحفظ" : ""}</span>
          <button disabled={saved === "busy" || note === (c.notes ?? "")}
            onClick={async () => { setSaved("busy"); try { await save({ data: { pw, id: c.id, notes: note } }); setSaved("ok"); void qc.invalidateQueries({ queryKey: ["customers"] }); } catch { setSaved("err"); } }}
            className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">{saved === "busy" ? "جاري..." : "حفظ"}</button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Sun className="h-4 w-4 text-primary" />المنظومة المختارة</h3>
        {parts.length ? <ul className="space-y-1.5 text-sm">{parts.map((p) => <li key={p} className="rounded-md bg-muted px-2 py-1.5">{p}</li>)}</ul>
          : <p className="text-xs text-muted-foreground">لم يختر العميل منظومة بعد</p>}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" />الطلبات</h3>
        {orders.length ? <ul className="space-y-2 text-xs">{orders.map((o) => (
          <li key={o.id} className="rounded-md border border-border p-2">
            <div className="flex justify-between font-semibold"><span>{o.invoice_no || "طلب"}</span><span>{orderStatus[o.status] ?? o.status}</span></div>
            <div className="mt-1 text-muted-foreground">{[o.amount, o.method, fmt(o.created_at)].filter(Boolean).join(" · ")}</div>
          </li>))}</ul>
          : <p className="text-xs text-muted-foreground">لا توجد طلبات لهذا العميل</p>}
      </div>
      <div className="text-center text-[11px] text-muted-foreground">عميل منذ {new Date(c.created_at).toLocaleDateString("ar")}</div>
    </aside>
  );
}

type Cust = Awaited<ReturnType<typeof listCustomers>>[number];

function Chat({ pw, c, onBack, onInfo }: { pw: string; c: Cust; onBack: () => void; onInfo?: (() => void) | undefined }) {
  const get = useServerFn(getMessages);
  const send = useServerFn(sendMessage);
  const togglePause = useServerFn(setBotPaused);
  const [paused, setPaused] = useState(!!(c as { bot_paused?: boolean }).bot_paused);
  useEffect(() => { setPaused(!!(c as { bot_paused?: boolean }).bot_paused); }, [c.id]);
  const [text, setText] = useState("");
  const sendFile = useServerFn(sendAttachment);
  const [file, setFile] = useState<File | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const pending = usePending(c.id);
  const { data: msgs = [], refetch } = useQuery(offlineQuery({
    queryKey: ["messages", c.id],
    queryFn: () => get({ data: { pw, id: c.id } }),
    refetchInterval: 10000,
    staleTime: 5000,
  }));
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lastId = msgs.length ? msgs[msgs.length - 1]!.id : null;
  useEffect(() => {
    const el = box.current; if (!el) return;
    const toBottom = () => { el.scrollTop = el.scrollHeight; };
    toBottom();
    const t1 = setTimeout(toBottom, 150), t2 = setTimeout(toBottom, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [c.id, lastId, msgs.length]);
  return (
    <>
      <div className="flex h-full flex-1 justify-center overflow-hidden md:py-0">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-phone shadow-2xl md:aspect-[9/19] md:w-auto md:rounded-[2.6rem] md:border-[10px] md:border-phone">
        <div className="absolute left-1/2 top-1.5 z-20 hidden h-5 w-24 -translate-x-1/2 rounded-full bg-phone md:block" />
        <div className="flex items-center gap-1 bg-wa-bar px-2 py-1 text-wa-text md:pt-6">
          <button onClick={onBack} aria-label="رجوع" className="lg:hidden"><ArrowRight className="h-4 w-4" /></button>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[11px] font-semibold">{c.name || "عميل"}</div>
            <div dir="ltr" className="text-right text-[9.5px] text-wa-muted">+{c.phone.replace(/^\+/, "")}</div>
          </div>
          <button title={paused ? "تشغيل البوت" : "إيقاف البوت"} aria-label={paused ? "تشغيل البوت" : "إيقاف البوت"}
            onClick={async () => { const v = !paused; setPaused(v); try { await togglePause({ data: { pw, id: c.id, paused: v } }); } catch { setPaused(!v); } }}
            className={`flex shrink-0 items-center justify-center rounded-full p-1 ${paused ? "bg-destructive text-destructive-foreground" : "hover:bg-wa-bot"}`}><Bot className="h-3.5 w-3.5" /></button>
          {onInfo && <button onClick={onInfo} aria-label="تفاصيل العميل" className="shrink-0 rounded-full p-1 hover:bg-wa-bot"><Info className="h-3.5 w-3.5" /></button>}
        </div>
        <div ref={box} onLoadCapture={() => { const el = box.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 400) el.scrollTop = el.scrollHeight; }} data-scroll data-chat-scroll className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain bg-cover bg-center p-2.5 text-[12.5px]" style={{ backgroundImage: `url(${waBg.url})` }}>
        {msgs.map((m, i) => (
          <div key={m.id}>
          {(i === 0 || new Date(msgs[i - 1]!.created_at).toDateString() !== new Date(m.created_at).toDateString()) && (
            <div className="my-2 flex justify-center"><span className="rounded-lg bg-wa-bot px-3 py-0.5 text-[11px] text-wa-muted shadow">{dayLabel(m.created_at)}</span></div>
          )}
          <div className={`flex ${m.direction === "customer" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] break-words px-2.5 py-1.5 text-wa-text shadow ${m.direction === "customer" ? "rounded-2xl rounded-tl-sm bg-wa-me" : m.direction === "agent" ? "rounded-2xl rounded-tr-sm bg-wa-agent" : "rounded-2xl rounded-tr-sm bg-wa-bot"}`}>
              {(m as { src?: string | null }).src || ["pdf", "image", "audio", "video", "document", "sticker"].includes(m.kind) ? <MediaBubble m={m as MediaMsg} />
                : <WaText text={m.text} />}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-wa-muted">
                {m.direction === "agent" && <><User className="h-3 w-3" />الموظف ·</>}
                <span>{fmt(m.created_at)}</span>
                {m.direction === "customer" && <span>✓✓</span>}
              </div>
            </div>
          </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.lid} className="flex justify-start">
            <div className="max-w-[85%] break-words rounded-2xl rounded-tr-sm bg-wa-agent px-2.5 py-1.5 text-wa-text opacity-80 shadow">
              <WaText text={p.text} />
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-wa-muted">
                <Clock className="h-3 w-3" />بانتظار الإنترنت · <span>{fmt(p.at)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
        </div>
      {file && (
        <div className="flex items-center gap-2 bg-wa-bar px-3 py-1 text-[11px] text-wa-text">
          <Paperclip className="h-3 w-3 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="text-wa-muted">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
          <button type="button" onClick={() => setFile(null)} aria-label="إلغاء الملف"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      <form
        className="flex items-end gap-1.5 bg-wa-bar px-2 py-1 md:pb-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim(); if ((!t && !file) || sending) return;
          if (!file && !navigator.onLine) { enqueue(c.id, t); setText(""); setErr(""); return; }
          if (file && !navigator.onLine) { setErr("إرسال الملفات يحتاج إنترنت"); return; }
          setSending(true); setErr("");
          try {
            if (file) {
              const buf = new Uint8Array(await file.arrayBuffer());
              let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
              await sendFile({ data: { pw, id: c.id, text: t, file_name: file.name, mime: file.type || "application/octet-stream", b64: btoa(bin) } });
              setFile(null);
            } else await send({ data: { pw, id: c.id, text: t } });
            setText(""); await refetch();
          }
          catch (x) {
            if (!file && isNetworkError(x)) { enqueue(c.id, t); setText(""); }
            else setErr(x instanceof Error ? x.message : "تعذّر الإرسال");
          }
          finally { setSending(false); }
        }}
      >
        <input ref={fileIn} type="file" hidden onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          if (f.size > 16 * 1024 * 1024) { setErr("حجم الملف أكبر من 16MB"); return; }
          setErr(""); setFile(f);
        }} />
        <button type="button" onClick={() => fileIn.current?.click()} aria-label="إرفاق ملف" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-wa-muted hover:bg-wa-bot">
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={file ? "تعليق (اختياري)" : "مراسلة"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          className="max-h-24 min-h-8 flex-1 resize-none rounded-3xl bg-wa-bot px-3 py-1.5 text-xs text-wa-text outline-none placeholder:text-wa-muted" />
        <button disabled={sending || (!text.trim() && !file)} aria-label="إرسال" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wa-mic text-wa-text disabled:opacity-60">
          <Send className="h-3.5 w-3.5 -scale-x-100" />
        </button>
      </form>
      </div>
      </div>
      {err && <p className="px-3 pb-2 text-xs text-destructive">{err}</p>}
    </>
  );
}


type MediaMsg = { kind: string; text: string; src?: string | null; mime?: string | null; file_name?: string | null };

function MediaBubble({ m }: { m: MediaMsg }) {
  const [zoom, setZoom] = useState(false);
  const src = m.src ?? null;
  const caption = m.text.replace(/^📎\s*(image|audio|video|document|sticker|voice)\s*(—\s*)?/i, "").trim();
  const kind = m.kind === "document" && /pdf/i.test(m.mime ?? m.file_name ?? "") ? "pdf" : m.kind;
  if (!src) {
    return <span className="flex items-center gap-1.5 text-[11px]"><FileText className="h-3.5 w-3.5 shrink-0 text-destructive" /><span className="truncate">{m.text}</span></span>;
  }
  if (kind === "image" || kind === "sticker") {
    return (
      <div>
        <button type="button" onClick={() => setZoom(true)} className="block overflow-hidden rounded-lg">
          <img src={src} alt={caption || "صورة"} loading="lazy" className="max-h-64 w-auto max-w-full object-cover" />
        </button>
        {caption && <div className="mt-1">{caption}</div>}
        {zoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4" onClick={() => setZoom(false)}>
            <img src={src} alt={caption || "صورة"} className="max-h-full max-w-full rounded-lg" />
          </div>
        )}
      </div>
    );
  }
  if (kind === "audio") return <audio controls preload="none" src={src} className="h-10 w-60 max-w-full" />;
  if (kind === "video") return <div><video controls preload="metadata" src={src} className="max-h-64 max-w-full rounded-lg" />{caption && <div className="mt-1">{caption}</div>}</div>;
  const name = m.file_name || caption || m.text || "ملف";
  return (
    <a href={src} target="_blank" rel="noreferrer" className="flex w-full max-w-[210px] items-center gap-2 rounded-md bg-background/15 px-1.5 py-1 text-[11px] no-underline hover:bg-background/25">
      <span className="flex h-6 w-5 shrink-0 items-center justify-center rounded-sm bg-destructive text-[7px] font-bold text-destructive-foreground">{kind === "pdf" ? "PDF" : "FILE"}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <Download className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  );
}

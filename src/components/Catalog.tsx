import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, FileText, Save, Pencil, X, Plus, Trash2, ChevronLeft, Zap } from "lucide-react";
import { listCatalog, saveCatalogItem, createCatalogItem, deleteCatalogItem } from "@/lib/crm.functions";
import { offlineQuery } from "@/lib/offline-cache";
import { AutoRulesDialog } from "@/components/AutoRulesDialog";
import { rulesOf, type CatItem } from "@/lib/auto-rules";

type Row = Awaited<ReturnType<typeof listCatalog>>[number];

function specsOf(r: Row): string[] {
  return Array.isArray(r.specs) ? (r.specs as unknown[]).map((s) => String(s)) : [];
}

function brandOf(r: Row): string {
  const t = (r.key + " " + r.name + " " + (r.label ?? "")).toUpperCase();
  if (/DEYE|دايا|دايما/.test(t)) return "Deye";
  if (/SOLIS|سوليس|سولار/.test(t)) return "Solis";
  if (/LIPOWER|LI POWER|ليو باور/.test(t)) return "Li Power";
  if (/HITHIUM|HEROEE|هيثيوم/.test(t)) return "Hithium";
  if (/PYLON|RV12|UF5000|FIDUS|بايلونتك/.test(t)) return "Pylontech";
  if (/SUNTECH|سنتك/.test(t)) return "Suntech";
  return "";
}

// Display order of sections and brands inside them (UI only; DB categories unchanged).
const SECTIONS: [string, string][] = [["panels", "الألواح"], ["inverters", "الإنفرترات"], ["batteries", "البطاريات"], ["cabinets", "الكبائن"], ["racks", "الراكات"]];
const BRAND_ORDER = ["Li Power", "Solis", "Deye", "Pylontech", "Hithium", "Suntech", ""];
function sectionOf(r: Row): string {
  const t = (r.key + " " + r.name).toUpperCase();
  if (/^CAB_|كبينة|112C|A300|L260/.test(t)) return "cabinets";
  if (r.kind === "item") {
    if (/^BAT_PYLON_M/.test(r.key)) return "batteries";
    if (/^(CTRL|KIT)_/.test(r.key)) return "battery_controls";
    if (/^RACK_/.test(r.key)) return "racks";
  }
  if (r.category === "racks" || /M1C|M5A|112S/.test(t)) return "racks";
  if (r.kind === "datasheet") {
    if (/INV|إنفرتر|انفرتر/.test(t)) return "inverters";
    if (/PV|PANEL|لوح|الواح|ألواح/.test(t)) return "panels";
    return "batteries";
  }
  return r.category;
}
const brandRank = (b: string) => { const i = BRAND_ORDER.indexOf(b); return i < 0 ? 99 : i; };

function Folder({ title, count, open, onToggle, level, children }: { title: string; count: number; open: boolean; onToggle: () => void; level: number; children: React.ReactNode }) {
  return (
    <div className={level ? "rounded-lg border bg-muted/40" : "rounded-xl border bg-card"}>
      <button onClick={onToggle} className={`flex w-full items-center gap-2 p-3 text-right ${level ? "text-sm font-semibold" : "font-bold text-primary"}`}>
        <ChevronLeft className={`h-4 w-4 transition-transform ${open ? "-rotate-90" : ""}`} />
        <span className="flex-1">{title}</span>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{count}</span>
      </button>
      {open && <div className="space-y-2 px-2 pb-2">{children}</div>}
    </div>
  );
}

export function Catalog({ pw }: { pw: string }) {
  const list = useServerFn(listCatalog);
  const del = useServerFn(deleteCatalogItem);
  const { data: rows = [], refetch } = useQuery(offlineQuery({ queryKey: ["catalog"], queryFn: () => list({ data: { pw } }) }));
  const onDelete = async (r: Row) => {
    if (!window.confirm(`حذف "${r.name}" نهائياً؟`)) return;
    try { await del({ data: { pw, key: r.key } }); await refetch(); } catch (e) { alert((e as Error).message); }
  };
  const [tab, setTab] = useState<"item" | "datasheet">("item");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [ruleKey, setRuleKey] = useState<string | null>(null);
  const ruleItem = ruleKey ? rows.find((r) => r.key === ruleKey) : null;
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const shown = rows.filter((r) => r.kind === tab && (r.name.includes(q) || r.key.includes(q)));
  const isOpen = (id: string) => !!q || openSet.has(id);
  const toggle = (id: string) => setOpenSet((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const others = [...new Set(shown.map(sectionOf))].filter((c) => !SECTIONS.some(([k]) => k === c));
  const groups: { id: string; title: string; rows: Row[] }[] = [
    ...SECTIONS.map(([id, title]) => ({ id, title, rows: shown.filter((r) => sectionOf(r) === id) })),
    ...others.map((c) => ({ id: c, title: shown.find((r) => r.category === c)?.category_title ?? c, rows: shown.filter((r) => sectionOf(r) === c) })),
  ].filter((g) => g.rows.length);

  const card = (r: Row) => (
    <div key={r.key} className={`rounded-xl border bg-card p-3 ${r.active ? "" : "opacity-60"}`}>
      <p className="text-sm font-medium">{r.name}</p>
      {(() => {
        const m = specsOf(r).join(" ").match(/(\d+)\s*خط دخول\s*(\d+)\s*خط خروج/);
        if (!m) return null;
        const n = Number(m[1]);
        const g = n === 2 ? "مجموعتان" : n <= 10 ? `${n} مجموعات` : `${n} مجموعة`;
        return <p className="mt-1 text-xs font-medium text-primary">عدد المجموعات: {g} ({m[1]} دخول / {m[2]} خروج)</p>;
      })()}
      <div className="mt-2 flex items-center gap-2 text-sm">
        {r.kind === "item" && <span className="text-muted-foreground">${r.price ?? "-"} / {r.unit}</span>}
        {r.kind === "datasheet" && r.pdf_url && <a href={r.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary"><FileText className="h-3.5 w-3.5" /> فتح</a>}
        {!r.active && <span className="text-xs text-muted-foreground">(موقوف)</span>}
        {r.kind === "item" && (
          <button onClick={() => setRuleKey(r.key)} className={`mr-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${rulesOf(r).length ? "border-primary text-primary" : "text-muted-foreground"}`}>
            <Zap className="h-3.5 w-3.5" /> {rulesOf(r).length ? "تلقائي" : "القاعدة"}
          </button>
        )}
        <button onClick={() => setEditing(r)} className={`${r.kind === "item" ? "" : "mr-auto "}flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground`}>
          <Pencil className="h-3.5 w-3.5" /> تعديل
        </button>
        <button onClick={() => onDelete(r)} className="flex items-center gap-1 rounded-md border border-destructive px-2 py-1 text-xs text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> حذف
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => setTab("item")} className={`rounded-lg py-2 text-sm ${tab === "item" ? "bg-primary font-semibold text-primary-foreground" : "bg-muted"}`}>الأصناف والأسعار</button>
          <button onClick={() => setTab("datasheet")} className={`rounded-lg py-2 text-sm ${tab === "datasheet" ? "bg-primary font-semibold text-primary-foreground" : "bg-muted"}`}>الكتالوجات PDF</button>
        </div>
        {tab === "item" && (
          <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary py-2 text-sm font-semibold text-primary">
            <Plus className="h-4 w-4" /> إضافة صنف
          </button>
        )}
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث عن صنف..." className="w-full rounded-lg border bg-card py-2 pl-3 pr-9 text-sm" />
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {groups.map((g) => {
          const base = g.id === "racks" ? ["Pylontech", "Hithium"] : [];
          const brands = [...new Set([...base, ...g.rows.map(brandOf)])].sort((a, b) => brandRank(a) - brandRank(b));
          const id = tab + ":" + g.id;
          return (
            <Folder key={id} title={g.title} count={g.rows.length} open={isOpen(id)} onToggle={() => toggle(id)} level={0}>
              {!g.rows.length && <p className="py-3 text-center text-xs text-muted-foreground">لا توجد كتالوجات</p>}
              {brands.length <= 1
                ? g.rows.map(card)
                : brands.map((b) => {
                    const br = g.rows.filter((r) => brandOf(r) === b);
                    const bid = id + ":" + b;
                    return (
                      <Folder key={bid} title={b || "أخرى"} count={br.length} open={isOpen(bid)} onToggle={() => toggle(bid)} level={1}>
                        {br.length ? br.map(card) : <p className="py-3 text-center text-xs text-muted-foreground">لا توجد أصناف</p>}
                      </Folder>
                    );
                  })}
            </Folder>
          );
        })}
        {tab === "item" && !shown.length && <p className="py-10 text-center text-sm text-muted-foreground">لا توجد أصناف</p>}
      </div>
      {editing && <EditCard key={editing.key} r={editing} pw={pw} onClose={() => setEditing(null)} onSaved={() => { refetch(); setEditing(null); }} />}
      {adding && <NewItemCard rows={rows} pw={pw} onClose={() => setAdding(false)} onSaved={async (key) => { setAdding(false); await refetch(); setRuleKey(key); }} />}
      {ruleItem && <AutoRulesDialog key={ruleItem.key} item={ruleItem as CatItem} items={rows as CatItem[]} pw={pw} onClose={() => setRuleKey(null)} onSaved={() => { refetch(); setRuleKey(null); }} />}
    </div>
  );
}

function EditCard({ r, pw, onClose, onSaved }: { r: Row; pw: string; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(saveCatalogItem);
  const [name, setName] = useState(r.name);
  const [price, setPrice] = useState(r.price == null ? "" : String(r.price));
  const [unit, setUnit] = useState(r.unit ?? "");
  const [pdf, setPdf] = useState(r.pdf_url ?? "");
  const [active, setActive] = useState(r.active);
  const [specs, setSpecs] = useState<string[]>(specsOf(r));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setBusy(true); setMsg("");
    try {
      await save({ data: { pw, key: r.key, name, unit: unit || null, price: price === "" ? null : Number(price), pdf_url: pdf, active, specs: specs.map((s) => s.trim()).filter(Boolean) } });
      onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b p-3">
          <button onClick={submit} disabled={busy} className="flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> {busy ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <span className="flex-1 truncate text-sm font-bold">تعديل الصنف</span>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {msg && <p className="px-3 pt-2 text-xs text-destructive">{msg}</p>}
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <label className="block text-xs text-muted-foreground">اسم الصنف
            <textarea value={name} onChange={(e) => setName(e.target.value)} rows={3} className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" />
          </label>
          {r.kind === "item" ? (
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-muted-foreground">السعر $
                <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" />
              </label>
              <label className="flex-1 text-xs text-muted-foreground">الوحدة
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" />
              </label>
            </div>
          ) : (
            <label className="block text-xs text-muted-foreground"><FileText className="inline h-3.5 w-3.5" /> رابط PDF
              <input value={pdf} onChange={(e) => setPdf(e.target.value)} dir="ltr" className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> مفعّل</label>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">المواصفات</p>
            <div className="space-y-1.5">
              {specs.map((s, i) => (
                <div key={i} className="flex gap-1">
                  <textarea value={s} rows={Math.max(1, Math.ceil(s.length / 40))} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 resize-none rounded-md border bg-background p-1.5 text-sm" />
                  <button onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="حذف" className="rounded-md p-1 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setSpecs([...specs, ""])} className="mt-2 flex items-center gap-1 rounded-md border px-3 py-1 text-xs"><Plus className="h-3.5 w-3.5" /> إضافة سطر</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewItemCard({ rows, pw, onClose, onSaved }: { rows: Row[]; pw: string; onClose: () => void; onSaved: (key: string) => void }) {
  const create = useServerFn(createCatalogItem);
  const cats = [...new Map(rows.filter((r) => r.kind === "item").map((r) => [r.category, r.category_title ?? r.category])).entries()];
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("حبة");
  const [cat, setCat] = useState(cats[0]?.[0] ?? "other");
  const [specs, setSpecs] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    if (!name.trim()) return setMsg("اكتب اسم الصنف");
    if (!(Number(price) >= 0) || price === "") return setMsg("اكتب السعر");
    setBusy(true); setMsg("");
    try {
      const r = await create({ data: { pw, name, price: Number(price), unit: unit.trim() || null, category: cat, category_title: cats.find(([k]) => k === cat)?.[1] ?? null, specs: specs.map((s) => s.trim()).filter(Boolean) } });
      onSaved(r.key);
    } catch (e) { setMsg(e instanceof Error ? e.message : "خطأ"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border bg-card sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b p-3">
          <button onClick={submit} disabled={busy} className="flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "جارٍ الحفظ..." : "حفظ"}</button>
          <span className="flex-1 truncate text-sm font-bold">إضافة صنف جديد</span>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {msg && <p className="px-3 pt-2 text-xs text-destructive">{msg}</p>}
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <label className="block text-xs text-muted-foreground">اسم الصنف
            <textarea value={name} onChange={(e) => setName(e.target.value)} rows={2} className="mt-1 w-full rounded-md border bg-background p-2 text-sm text-foreground" />
          </label>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-muted-foreground">السعر $
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>
            <label className="flex-1 text-xs text-muted-foreground">الوحدة
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">الفئة
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground">
              {cats.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">المواصفات</p>
            <div className="space-y-1.5">
              {specs.map((s, i) => (
                <div key={i} className="flex gap-1">
                  <input value={s} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? e.target.value : x)))} className="flex-1 rounded-md border bg-background p-1.5 text-sm" />
                  <button onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="حذف" className="rounded-md p-1 text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setSpecs([...specs, ""])} className="mt-2 flex items-center gap-1 rounded-md border px-3 py-1 text-xs"><Plus className="h-3.5 w-3.5" /> إضافة سطر</button>
          </div>
          <p className="text-[11px] text-muted-foreground">بعد الحفظ تختار لأي عروض يُضاف هذا الصنف تلقائيًا.</p>
        </div>
      </div>
    </div>
  );
}

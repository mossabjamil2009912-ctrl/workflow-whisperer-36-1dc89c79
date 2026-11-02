import { useEffect, useState } from "react";
import { needsUpdate } from "@/lib/app-update";

const KEY = "actes_update_tried";

async function applyUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) {
    await reg.update().catch(() => {});
    const sw = reg.installing ?? reg.waiting;
    if (sw) await new Promise<void>((res) => {
      const t = setTimeout(res, 20000);
      sw.addEventListener("statechange", () => { if (sw.state === "activated") { clearTimeout(t); res(); } });
    });
  }
  if ("caches" in window) await caches.delete("pages").catch(() => {});
  location.reload();
}

// Blocks the app with an update screen when a newer version is published; offline it lets the app open.
export function UpdateGate() {
  const [state, setState] = useState<"none" | "update" | "failed">("none");
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const check = async () => {
      if (!navigator.onLine) return;
      const r = await fetch(`/api/public/app-version?t=${Date.now()}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      const remote: string | undefined = r?.version;
      const s = needsUpdate(__APP_VERSION__, remote, sessionStorage.getItem(KEY) === remote);
      setState(s);
      if (s === "update" && remote) { sessionStorage.setItem(KEY, remote); await applyUpdate(); }
    };
    void check();
    const id = setInterval(check, 5 * 60_000);
    const onVis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  if (state === "none") return null;
  return (
    <div dir="rtl" className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
      <h2 className="text-xl font-bold">يوجد تحديث جديد</h2>
      {state === "update" ? (
        <p className="text-muted-foreground">جارٍ التنزيل... لا تغلق التطبيق</p>
      ) : (
        <>
          <p className="text-destructive">تعذّر التحديث</p>
          <button onClick={() => { sessionStorage.removeItem(KEY); setState("update"); void applyUpdate(); }}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">إعادة المحاولة</button>
        </>
      )}
    </div>
  );
}

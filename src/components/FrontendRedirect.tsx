import { useEffect, useState } from "react";
import { getFrontendUrl } from "@/lib/crm.functions";
import { DEFAULT_FRONTEND_URL } from "@/lib/server-url-rules";

const LS = "actes_frontend_url";

// Installed apps open on the old published host; move them to the saved frontend URL.
// The URL is kept on the device so the move still works if the old host stops answering.
export function FrontendRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const here = window.location.host;
    if (here !== new URL(DEFAULT_FRONTEND_URL).host) return; // preview, dev or already on the new host
    const go = (url: string) => {
      let to: URL;
      try { to = new URL(url); } catch { return; }
      if (to.host === here) return;
      setTarget(url);
      const dest = to.origin + window.location.pathname + window.location.search + window.location.hash;
      setTimeout(() => window.location.replace(dest), 1500);
    };
    const saved = localStorage.getItem(LS);
    if (saved) go(saved);
    const check = () => {
      if (!navigator.onLine) return;
      getFrontendUrl().then(({ url }) => {
        if (url === DEFAULT_FRONTEND_URL) localStorage.removeItem(LS); else localStorage.setItem(LS, url);
        go(url);
      }).catch(() => {});
    };
    check();
    const id = setInterval(check, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  if (!target) return null;
  return (
    <div dir="rtl" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-primary px-3 py-2 text-sm text-primary-foreground">
      انتقل التطبيق إلى رابط جديد، جارٍ التحويل...
      <a href={target} className="rounded bg-primary-foreground px-2 py-0.5 font-semibold text-primary">فتح الرابط الجديد</a>
    </div>
  );
}

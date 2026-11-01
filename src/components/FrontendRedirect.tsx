import { useEffect, useState } from "react";
import { getFrontendUrl } from "@/lib/crm.functions";

// Installed apps open on the old published host; if a new frontend URL is saved, move them there.
export function FrontendRedirect() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.onLine) return;
    getFrontendUrl().then(({ url, defaultUrl }) => {
      const here = window.location.host;
      if (here !== new URL(defaultUrl).host) return; // preview, dev or already on the new host
      const to = new URL(url);
      if (to.host === here) return;
      setTarget(url);
      const dest = to.origin + window.location.pathname + window.location.search + window.location.hash;
      setTimeout(() => window.location.replace(dest), 1500);
    }).catch(() => {});
  }, []);
  if (!target) return null;
  return (
    <div dir="rtl" className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-3 bg-primary px-3 py-2 text-sm text-primary-foreground">
      انتقل التطبيق إلى رابط جديد، جارٍ التحويل...
      <a href={target} className="rounded bg-primary-foreground px-2 py-0.5 font-semibold text-primary">فتح الرابط الجديد</a>
    </div>
  );
}

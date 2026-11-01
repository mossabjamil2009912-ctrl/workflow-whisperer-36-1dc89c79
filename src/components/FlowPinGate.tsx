import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

const PIN = "2027";
const KEY = "actes_flow_unlocked";

export function FlowPinGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => { if (sessionStorage.getItem(KEY) === "1") setOk(true); }, []);

  if (ok) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (v === PIN) { sessionStorage.setItem(KEY, "1"); setOk(true); }
    else { setErr(true); setV(""); }
  };

  return (
    <form onSubmit={submit} dir="rtl" className="mx-auto flex max-w-xs flex-col items-center gap-3 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Lock className="h-5 w-5" /></span>
      <h2 className="text-lg font-bold">شاشة المسار مقفلة</h2>
      <p className="text-sm text-muted-foreground">أدخل الرمز للدخول</p>
      <input type="password" inputMode="numeric" autoFocus value={v} onChange={(e) => { setV(e.target.value); setErr(false); }}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center text-lg tracking-widest" />
      {err && <p className="text-sm text-destructive">الرمز غير صحيح</p>}
      <button type="submit" className="w-full rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground">دخول</button>
    </form>
  );
}

// Pure validation for the bot server (n8n) URL — shared by server and UI, no secrets here.
export const DEFAULT_SERVER_URL = "https://n8n.srv1994780.hstgr.cloud";

export function normalizeServerUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return { ok: false, error: "الرابط غير صالح" }; }
  if (u.protocol !== "https:") return { ok: false, error: "يجب أن يبدأ الرابط بـ https://" };
  if (u.username || u.password) return { ok: false, error: "لا تضع اسم مستخدم أو كلمة مرور داخل الرابط" };
  if ((u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) return { ok: false, error: "اكتب عنوان الخادم فقط بدون مسار" };
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || h === "localhost" || /\.(local|internal|localhost|lan|home|corp)$/.test(h)) return { ok: false, error: "لا يُسمح بالعناوين المحلية أو الداخلية" };
  if (/^\d+(\.\d+){3}$/.test(h)) {
    const [a = 0, b = 0] = h.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224)
      return { ok: false, error: "لا يُسمح بالعناوين المحلية أو الداخلية" };
  }
  if (h.includes(":")) return { ok: false, error: "استخدم اسم نطاق بدلاً من عنوان IPv6" };
  return { ok: true, url: `https://${u.host}` };
}

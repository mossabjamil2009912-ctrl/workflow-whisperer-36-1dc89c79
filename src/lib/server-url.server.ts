import { DEFAULT_SERVER_URL, normalizeServerUrl } from "./server-url-rules";

// Single source of the bot server (n8n) base URL; stored in app_settings key "server_url".
let cache: { url: string; at: number } | null = null;
const TTL = 30_000;

export function clearServerUrlCache() { cache = null; }

export async function getServerUrl(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL) return cache.url;
  let url = DEFAULT_SERVER_URL;
  try {
    const { supabaseAdmin } = await import("@/lib/db.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "server_url").maybeSingle();
    const n = typeof data?.value === "string" ? normalizeServerUrl(data.value) : null;
    if (n?.ok) url = n.url;
  } catch (e) { console.error("server_url read failed", e); }
  cache = { url, at: Date.now() };
  return url;
}

export async function testServerUrl(url: string): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    if (r.ok) return { ok: true, message: "الاتصال ناجح" };
    return { ok: false, message: `الخادم رد بخطأ (${r.status})` };
  } catch {
    return { ok: false, message: "تعذّر الوصول إلى الخادم" };
  }
}

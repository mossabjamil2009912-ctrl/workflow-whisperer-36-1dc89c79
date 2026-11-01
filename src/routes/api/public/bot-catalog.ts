import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// Single source of truth for the WhatsApp bot: items, prices and datasheet PDF links managed in the dashboard.
export const Route = createFileRoute("/api/public/bot-catalog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const got = Buffer.from(request.headers.get("x-bot-secret") ?? "");
        const exp = Buffer.from(process.env["BOT_INGEST_SECRET"] ?? "");
        if (!exp.length || got.length !== exp.length || !timingSafeEqual(got, exp)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data, error } = await supabaseAdmin.from("catalog_items").select("*").eq("active", true).order("sort");
        if (error) return new Response(error.message, { status: 500 });
        const prices: Record<string, number> = {};
        const items: Record<string, unknown> = {};
        const autoRules: Record<string, unknown> = {};
        const files: Record<string, { filename: string | null; caption: string; link: string }> = {};
        // Datasheets live in the repo under /datasheets; give the bot an absolute link on whatever domain serves this app.
        const origin = new URL(request.url).origin;
        for (const r of data) {
          if (r.kind === "datasheet") {
            const link = r.pdf_url?.startsWith("/") ? origin + r.pdf_url : r.pdf_url;
            if (link) files[r.key.replace(/^pdf:/, "")] = { filename: r.label, caption: "📄 المواصفات الفنية: " + r.name, link };
          } else {
            if (r.price != null) prices[r.key] = Number(r.price);
            if (Array.isArray(r.auto_rules) && r.auto_rules.length) autoRules[r.key] = r.auto_rules;
            items[r.key] = { name: r.name, unit: r.unit, price: r.price == null ? null : Number(r.price), category: r.category, label: r.label, specs: r.specs };
          }
        }
        const { data: st } = await supabaseAdmin.from("app_settings").select("value").eq("key", "kwh_price").maybeSingle();
        const kwh_price = st ? Number(st.value) : 290;
        // Edited bot texts from the "المسار" screen: TEXT = [original fragment, new], BTN = [button id, original title, new title, new desc].
        const { data: bt } = await supabaseAdmin.from("bot_texts").select("kind,original,value,btn_id,desc_value");
        const BOT_TEXTS = { TEXT: [] as [string, string][], BTN: [] as [string, string, string | null, string | null][] };
        for (const r of bt ?? []) {
          if (r.kind === "button") BOT_TEXTS.BTN.push([r.btn_id ?? "", r.original, r.value, r.desc_value]);
          else if (r.value != null) BOT_TEXTS.TEXT.push([r.original, r.value]);
        }
        BOT_TEXTS.TEXT.sort((a, b) => b[0].length - a[0].length);
        // Added steps: shown when the customer presses trigger_id (title matched against original or edited title).
        const { data: steps } = await supabaseAdmin.from("bot_steps").select("id,trigger_id,trigger_title,body,kind,list_button,options").eq("active", true);
        const BOT_STEPS = (steps ?? []).map((s) => {
          const edited = BOT_TEXTS.BTN.find((b) => b[0] === s.trigger_id && b[1] === s.trigger_title)?.[2];
          return { ...s, trigger_titles: [s.trigger_title, edited].filter(Boolean) };
        });
        return Response.json({ settings: { kwh_price }, KWH_PRICE: kwh_price, updated_at: new Date().toISOString(), ITEM_PRICES: prices, ITEMS: items, CATALOG_FILES: files, AUTO_RULES: autoRules, BOT_TEXTS, BOT_STEPS });
      },
    },
  },
});

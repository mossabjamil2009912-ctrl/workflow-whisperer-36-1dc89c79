import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// Called by the WhatsApp bot before auto-replying: if staff took over this customer in the CRM, the bot stays silent.
export const Route = createFileRoute("/api/public/bot-paused")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = Buffer.from(request.headers.get("x-bot-secret") ?? "");
        const exp = Buffer.from(process.env["BOT_INGEST_SECRET"] ?? "");
        if (!exp.length || got.length !== exp.length || !timingSafeEqual(got, exp)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let raw: { phone?: unknown };
        try { raw = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const tail = String(raw.phone ?? "").replace(/\D/g, "").slice(-9);
        if (tail.length < 9) return Response.json({ paused: false });
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data } = await supabaseAdmin.from("customers").select("bot_paused").like("phone", `%${tail}`).limit(1);
        return Response.json({ paused: !!data?.[0]?.bot_paused });
      },
    },
  },
});

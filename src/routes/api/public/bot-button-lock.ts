import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

// Called by the WhatsApp bot on every button/list reply: only the FIRST reply to a given bot message is accepted.
// Atomic via primary-key insert, so simultaneous taps on the same message can never both pass.
export const Route = createFileRoute("/api/public/bot-button-lock")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = Buffer.from(request.headers.get("x-bot-secret") ?? "");
        const exp = Buffer.from(process.env["BOT_INGEST_SECRET"] ?? "");
        if (!exp.length || got.length !== exp.length || !timingSafeEqual(got, exp)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let raw: { context_id?: unknown; phone?: unknown; choice?: unknown };
        try { raw = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const context_id = String(raw.context_id ?? "").slice(0, 200);
        if (!context_id) return Response.json({ allowed: true });
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { error } = await (supabaseAdmin as any).from("bot_button_locks").insert({
          context_id,
          phone: String(raw.phone ?? "").slice(0, 30),
          choice: String(raw.choice ?? "").slice(0, 200),
        });
        if (!error) return Response.json({ allowed: true });
        if (error.code === "23505") return Response.json({ allowed: false });
        console.error("bot-button-lock failed", error.message);
        return Response.json({ allowed: true }); // fail open so the bot never stalls
      },
    },
  },
});

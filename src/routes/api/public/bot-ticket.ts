import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const s = (n: number) => z.string().max(n).nullish().transform((v) => v ?? null);
const Body = z.object({
  phone: z.string().min(3).max(32),
  name: s(120), city: s(120), device: s(120), issue_type: s(120),
  description: s(4000), media_id: s(200), media_type: s(40),
});

export const Route = createFileRoute("/api/public/bot-ticket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = Buffer.from(request.headers.get("x-bot-secret") ?? "");
        const exp = Buffer.from(process.env["BOT_INGEST_SECRET"] ?? "");
        if (!exp.length || got.length !== exp.length || !timingSafeEqual(got, exp)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let raw: unknown;
        try { raw = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
        const p = Body.safeParse(raw);
        if (!p.success) return new Response(p.error.message, { status: 400 });
        const d = p.data;
        const phone = d.phone.replace(/[^\d]/g, "");
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data: c } = await supabaseAdmin.from("customers").select("id").eq("phone", phone).maybeSingle();
        const { data: t, error } = await supabaseAdmin.from("support_tickets").insert({
          phone, customer_id: c?.id ?? null, name: d.name, city: d.city, device: d.device,
          issue_type: d.issue_type, description: d.description, media_id: d.media_id, media_type: d.media_type,
        }).select("ticket_no").single();
        if (error || !t) return new Response(error?.message ?? "insert failed", { status: 500 });
        return Response.json({ ok: true, ticket_no: t.ticket_no });
      },
    },
  },
});

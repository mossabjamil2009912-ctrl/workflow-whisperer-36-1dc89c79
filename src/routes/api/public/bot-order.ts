import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const s = (n: number) => z.string().max(n).nullish().transform((v) => v ?? null);
const Body = z.object({
  phone: z.string().min(3).max(32),
  name: s(120), city: s(120), invoice_no: s(80), amount: s(80), method: s(120), details: s(4000),
});

export const Route = createFileRoute("/api/public/bot-order")({
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
        const { error } = await supabaseAdmin.from("orders").insert({
          phone, customer_id: c?.id ?? null, name: d.name, city: d.city,
          invoice_no: d.invoice_no, amount: d.amount, method: d.method, details: d.details,
        });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});

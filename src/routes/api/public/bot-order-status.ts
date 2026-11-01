import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

// Called by the WhatsApp bot when finance presses confirm/reject on WhatsApp.
// Keeps the CRM and WhatsApp in sync: an invoice already decided in the CRM cannot be re-decided.
const Body = z.object({
  phone: z.string().min(3).max(32),
  status: z.enum(["confirmed", "cancelled"]),
});

export const Route = createFileRoute("/api/public/bot-order-status")({
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
        const digits = p.data.phone.replace(/\D/g, "");
        const tail = digits.slice(-9);
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data: rows, error } = await supabaseAdmin
          .from("orders").select("id,status,phone").like("phone", `%${tail}`)
          .order("created_at", { ascending: false }).limit(1);
        if (error) return new Response(error.message, { status: 500 });
        const last = rows?.[0];
        if (!last) return Response.json({ ok: true, found: false });
        if (last.status !== "pending") {
          return Response.json({ ok: false, found: true, status: last.status });
        }
        const { error: uerr } = await supabaseAdmin.from("orders")
          .update({ status: p.data.status, decided_at: new Date().toISOString() }).eq("id", last.id);
        if (uerr) return new Response(uerr.message, { status: 500 });
        return Response.json({ ok: true, found: true, status: p.data.status });
      },
    },
  },
});

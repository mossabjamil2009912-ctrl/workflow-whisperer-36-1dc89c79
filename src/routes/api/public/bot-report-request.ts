import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { parseTilt } from "@/lib/pvsyst-calc";

// Called by the WhatsApp bot when a customer asks for a PVsyst report or SLD diagram.
// The report is not generated automatically: staff review and send it from the CRM.
const s = (n: number) => z.string().max(n).nullish().transform((v) => v ?? null);
const Body = z.object({
  phone: z.string().min(3).max(32),
  kind: z.enum(["pvsyst", "sld"]),
  name: s(120),
  system: s(300),
  city: z.enum(["sanaa", "aden", "other"]).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lon: z.number().min(-180).max(180).nullish(),
  tilt: z.union([z.number(), z.string().max(10)]).nullish(),
  azimuth: z.enum(["s", "n", "e", "w", "ns", "ew"]).nullish(),
});

export const Route = createFileRoute("/api/public/bot-report-request")({
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
        const phone = p.data.phone.replace(/\D/g, "");
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data: c } = await supabaseAdmin.from("customers").select("id").like("phone", `%${phone.slice(-9)}`).limit(1).maybeSingle();
        const { error } = await supabaseAdmin.from("report_requests").insert({
          phone, customer_id: c?.id ?? null, name: p.data.name, system_label: p.data.system, kind: p.data.kind,
          city: p.data.city ?? null, lat: p.data.lat ?? null, lon: p.data.lon ?? null, tilt: parseTilt(p.data.tilt), azimuth: p.data.azimuth ?? null,
        });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});

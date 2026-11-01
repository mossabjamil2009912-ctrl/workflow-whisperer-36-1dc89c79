import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

// يربط ملف PDF الذي أرسله البوت (عرض سعر/دراسة/مخطط) بفقاعته في المحادثة
const Body = z.object({
  phone: z.string().min(3).max(32),
  text: z.string().max(300),
  media_id: z.string().min(1).max(200),
  file_name: z.string().max(300).optional().nullable(),
  mime: z.string().max(120).optional().nullable(),
});

export const Route = createFileRoute("/api/public/bot-media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = Buffer.from(request.headers.get("x-bot-secret") ?? "");
        const exp = Buffer.from(process.env["BOT_INGEST_SECRET"] ?? "");
        if (!exp.length || got.length !== exp.length || !timingSafeEqual(got, exp)) return new Response("Unauthorized", { status: 401 });
        const p = Body.safeParse(await request.json().catch(() => null));
        if (!p.success) return new Response(p.error.message, { status: 400 });
        const d = p.data;
        const { supabaseAdmin } = await import("@/lib/db.server");
        const { data: c } = await supabaseAdmin.from("customers").select("id").eq("phone", d.phone.replace(/[^\d+]/g, "")).maybeSingle();
        if (!c) return Response.json({ ok: false });
        // ننتظر قليلاً حتى يُسجَّل الحوار نفسه، حتى لا تسبق فقاعة الملف رسالة العميل
        let m: { id: string } | null = null;
        for (let i = 0; i < 4 && !m; i++) {
          if (i) await new Promise((r) => setTimeout(r, 1500));
          const since = new Date(Date.now() - 10 * 60000).toISOString();
          const { data } = await supabaseAdmin.from("messages").select("id")
            .eq("customer_id", c.id).eq("direction", "bot").eq("kind", "pdf").eq("text", d.text).is("media_id", null)
            .gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
          m = data;
        }
        const patch = { media_id: d.media_id, file_name: d.file_name ?? null, mime: d.mime ?? "application/pdf" };
        if (m) await supabaseAdmin.from("messages").update(patch).eq("id", m.id);
        else await supabaseAdmin.from("messages").insert({ customer_id: c.id, direction: "bot", kind: "pdf", text: d.text, ...patch });
        return Response.json({ ok: true });
      },
    },
  },
});

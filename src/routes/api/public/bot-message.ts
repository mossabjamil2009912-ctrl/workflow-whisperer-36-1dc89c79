import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const Body = z.object({
  phone: z.string().min(3).max(32),
  name: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  stage: z.enum(["new", "quote", "sld", "cod", "buy", "human"]).optional().nullable(),
  system: z.string().max(300).optional().nullable(),
  direction: z.enum(["customer", "bot"]).default("customer"),
  kind: z.enum(["text", "button", "pdf", "image", "audio", "video", "document", "sticker"]).default("text"),
  media_id: z.string().max(200).optional().nullable(),
  media_url: z.string().url().max(1000).optional().nullable(),
  mime: z.string().max(120).optional().nullable(),
  file_name: z.string().max(300).optional().nullable(),
  text: z.string().max(4000).default(""),
});

export const Route = createFileRoute("/api/public/bot-message")({
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
        const items = Array.isArray(raw) ? raw : [raw];
        const { supabaseAdmin } = await import("@/lib/db.server");
        const batchAt = Date.now(); let seq = 0;

        for (const it of items) {
          const p = Body.safeParse(it);
          if (!p.success) return new Response(p.error.message, { status: 400 });
          const d = p.data;
          const phone = d.phone.replace(/[^\d+]/g, "");
          if (!d.text.trim() && !d.stage && !d.system) continue;

          const { data: existing } = await supabaseAdmin
            .from("customers").select("id, unread, stage").eq("phone", phone).maybeSingle();

          // «عرض سعر» فقط عند طلب عرض السعر الرسمي (إرسال PDF العرض/الكتالوجات)، لا عند «المنظومة المناسبة»
          let stage = d.stage ?? null;
          if (stage === "quote") {
            const official = d.kind === "pdf" || /عرض\s*(ال)?سعر\s*رسمي|ACTES-C\d|كتالوج|كاتلوج|catalog/i.test(d.text);
            if (!official) stage = existing?.stage && existing.stage !== "quote" ? null : (existing ? null : "new");
          }

          const patch: {
            last_at: string; last_message?: string; name?: string; city?: string;
            stage?: string; system?: string; unread?: number;
          } = { last_at: new Date().toISOString() };
          if (d.text.trim()) patch.last_message = d.kind === "pdf" ? `📄 ${d.text}` : d.text;
          if (d.name) patch.name = d.name;
          if (d.city) patch.city = d.city;
          if (stage) patch.stage = stage;
          if (d.system) patch.system = d.system;
          const movedStage = !!stage && stage !== existing?.stage;

          let id = existing?.id;
          if (id) {
            if (d.direction === "customer" || movedStage) patch.unread = (existing?.unread ?? 0) + 1;
            await supabaseAdmin.from("customers").update(patch).eq("id", id);
          } else {
            const { data: ins, error } = await supabaseAdmin
              .from("customers")
              .insert({ phone, ...patch, unread: d.direction === "customer" ? 1 : 0 })
              .select("id").single();
            if (error) return new Response(error.message, { status: 500 });
            id = ins.id;
          }
          if (d.text.trim()) {
            // توقيت تصاعدي داخل الدفعة يحفظ نفس ترتيب واتساب
            await supabaseAdmin.from("messages").insert({
              created_at: new Date(batchAt + seq++).toISOString(),
              customer_id: id!, direction: d.direction, kind: d.kind, text: d.text,
              media_id: d.media_id ?? null, media_url: d.media_url ?? null, mime: d.mime ?? null, file_name: d.file_name ?? null,
            });
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});

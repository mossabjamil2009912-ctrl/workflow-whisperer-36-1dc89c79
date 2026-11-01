import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { SUPPORT_KB } from "@/lib/support-kb";

const Body = z.object({
  device: z.string().max(200).nullish(),
  issue: z.string().max(200).nullish(),
  description: z.string().min(1).max(4000),
});

const INSTRUCTIONS = `أنت مهندس الدعم الفني لشركة أكتس لاستيراد أنظمة الطاقة الشمسية في اليمن. ترد على العميل عبر واتساب بالعربية البسيطة باسم أكتس فقط، ولا تذكر أنك ذكاء اصطناعي ولا تذكر أي شركة أو مصدر خارجي.
المطلوب: شخّص المشكلة وأعطِ العميل خطوات حل آمنة وبسيطة يستطيع تطبيقها بنفسه (3-6 خطوات مرقمة، جملة قصيرة لكل خطوة).
قواعد السلامة: لا تطلب أبداً فتح الإنفرتر أو البطارية أو لمس أطراف مكشوفة. عند وجود دخان أو رائحة احتراق أو شرارة أو سخونة شديدة أو انتفاخ بطارية أو جهد ألواح زائد: اطلب فصل جميع القواطع فوراً، واجعل escalate=true و urgent=true.
اجعل escalate=true أيضاً إذا كانت المشكلة تحتاج قطعة غيار أو فحص ميداني أو لا يمكن حلها عن بعد، أو إذا كان الوصف غير مفهوم إطلاقاً.
لا تتجاوز 900 حرف في reply. لا تستخدم Markdown عدا *نجمة* للعنوان.
المعرفة الفنية:
${SUPPORT_KB}`;

const SCHEMA = {
  name: "diagnosis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "reply", "escalate", "urgent"],
    properties: {
      title: { type: "string", description: "تشخيص مختصر للعطل" },
      reply: { type: "string", description: "خطوات الحل للعميل" },
      escalate: { type: "boolean" },
      urgent: { type: "boolean" },
    },
  },
};

export const Route = createFileRoute("/api/public/bot-diagnose")({
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
        const { askAI, AiError } = await import("@/lib/ai.server");
        try {
          const txt = await askAI({
            instructions: INSTRUCTIONS,
            input: `الجهاز: ${p.data.device ?? "غير محدد"}\nنوع العطل: ${p.data.issue ?? "غير محدد"}\nوصف العميل: ${p.data.description}`,
            schema: SCHEMA,
          });
          const j = JSON.parse(txt) as { title: string; reply: string; escalate: boolean; urgent: boolean };
          return Response.json({ ok: true, ...j });
        } catch (e) {
          const status = e instanceof AiError ? e.status : 500;
          console.error("diagnose failed", e);
          return Response.json({ ok: false, escalate: true }, { status: status === 429 || status === 402 ? status : 200 });
        }
      },
    },
  },
});

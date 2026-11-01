import { createFileRoute } from "@tanstack/react-router";

// يعرض ملفات واتساب (صور، صوت، PDF) داخل لوحة المحادثات — الرابط موقّع برمز مشتق من كلمة مرور اللوحة
export const Route = createFileRoute("/api/public/crm-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const id = (u.searchParams.get("id") ?? "").replace(/[^0-9A-Za-z_-]/g, "");
        const t = u.searchParams.get("t") ?? "";
        const name = (u.searchParams.get("n") ?? "file").replace(/["\r\n]/g, "");
        if (!id || !process.env["DASHBOARD_PASSWORD"]) return new Response("Not found", { status: 404 });
        const { mediaToken } = await import("@/lib/media-token.server");
        if (t !== (await mediaToken(id))) return new Response("Unauthorized", { status: 401 });
        const r = await fetch(`https://n8n.srv1994780.hstgr.cloud/webhook/actes-media?id=${id}`, {
          headers: { "x-bot-secret": process.env["BOT_INGEST_SECRET"] ?? "" },
        });
        if (!r.ok) return new Response("الملف غير متاح (ربما انتهت صلاحيته في واتساب)", { status: 404 });
        return new Response(r.body, {
          headers: {
            "Content-Type": r.headers.get("content-type") ?? "application/octet-stream",
            "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
            "Cache-Control": "private, max-age=86400",
          },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Daily backup: copies every app table as JSON into the private GitHub repo below.
const REPO = "mossabjamil2009912-ctrl/actes-crm-data-backup";
const GATEWAY = "https://connector-gateway.lovable.dev/github";
const TABLES = [
  "customers",
  "messages",
  "catalog_items",
  "quotes",
  "orders",
  "support_tickets",
  "report_requests",
  "preset_reports",
  "app_settings",
  "bot_texts",
  "bot_steps",
] as const;

function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export const Route = createFileRoute("/api/public/jobs/github-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;

        const lovableKey = process.env["LOVABLE_API_KEY"];
        const ghKey = process.env["GITHUB_API_KEY"];
        if (!lovableKey || !ghKey) return new Response("GitHub not configured", { status: 500 });
        const headers = {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": ghKey,
          "Content-Type": "application/json",
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const date = new Date().toISOString().slice(0, 10);
        const results: Record<string, string> = {};

        for (const table of TABLES) {
          const rows: unknown[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabaseAdmin
              .from(table)
              .select("*")
              .range(from, from + 999);
            if (error) throw new Error(`${table}: ${error.message}`);
            rows.push(...(data ?? []));
            if (!data || data.length < 1000) break;
          }

          const path = `data/${table}.json`;
          const url = `${GATEWAY}/repos/${REPO}/contents/${path}`;
          const existing = await fetch(url, { headers });
          const sha = existing.ok ? ((await existing.json()) as { sha?: string }).sha : undefined;
          const put = await fetch(url, {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `نسخة ${date}: ${table} (${rows.length})`,
              content: toBase64(JSON.stringify(rows, null, 1)),
              ...(sha ? { sha } : {}),
            }),
          });
          if (!put.ok) {
            const body = await put.text();
            console.error(`GitHub backup failed [${put.status}] ${table}: ${body}`);
            results[table] = `error ${put.status}`;
          } else {
            results[table] = `${rows.length}`;
          }
        }

        return Response.json({ success: true, date, results });
      },
    },
  },
});

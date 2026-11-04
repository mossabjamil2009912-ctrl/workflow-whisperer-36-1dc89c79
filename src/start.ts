import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
// Also trust the Vercel-hosted frontend (vercel.json proxies /_serverFn here).
const isTrustedOrigin = (origin: string, reqUrl: string) => {
  if (origin === new URL(reqUrl).origin) return true;
  try {
    const h = new URL(origin).hostname;
    return new URL(origin).protocol === "https:" && h.endsWith(".vercel.app") && h.startsWith("workflow-whisperer-36-");
  } catch {
    return false;
  }
};

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  secFetchSite: (v, ctx) =>
    v === "same-origin" ||
    (v === "cross-site" && isTrustedOrigin(ctx.request.headers.get("Origin") ?? "", ctx.request.url)),
  origin: (o, ctx) => isTrustedOrigin(o, ctx.request.url),
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));

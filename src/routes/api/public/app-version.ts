import { createFileRoute } from "@tanstack/react-router";

// Public: returns only the current build version so installed apps know when to update.
export const Route = createFileRoute("/api/public/app-version")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ version: __APP_VERSION__ }), {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }),
    },
  },
});

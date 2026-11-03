// Vercel build only: generate /sw.js for the static SPA output (same caching as vite.config.ts).
import { generateSW } from "workbox-build";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

// The forced-update check must compare against THIS Vercel build, not the Lovable build.
const js = readdirSync("dist/client/assets").filter((f) => f.endsWith(".js"));
let version = null;
for (const f of js) {
  const m = readFileSync(`dist/client/assets/${f}`, "utf8").match(/__ACTES_BUILD__:"(\d+)"/);
  if (m) { version = m[1]; break; }
}
if (!version) throw new Error("build version not found in bundle");
writeFileSync("dist/client/app-version.json", JSON.stringify({ version }));
const { count } = await generateSW({
  globDirectory: "dist/client",
  globPatterns: ["**/*.{js,css,woff2,png,svg,ico,webp,jpg}"],
  globIgnores: ["datasheets/**"],
  swDest: "dist/client/sw.js",
  skipWaiting: true,
  clientsClaim: true,
  navigateFallback: null,
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  runtimeCaching: [
    { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"), handler: "NetworkFirst", options: { cacheName: "pages", networkTimeoutSeconds: 4 } },
    { urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com", handler: "StaleWhileRevalidate", options: { cacheName: "fonts" } },
  ],
});
console.log(`sw.js: precached ${count} files`);

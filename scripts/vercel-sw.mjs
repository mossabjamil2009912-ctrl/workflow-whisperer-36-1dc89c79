// Vercel build only: generate /sw.js for the static SPA output (same caching as vite.config.ts).
import { generateSW } from "workbox-build";
import { writeFileSync } from "node:fs";

// The forced-update check must compare against THIS Vercel build (same APP_VERSION as vite.config.ts).
const version = process.env.APP_VERSION;
if (!version) throw new Error("APP_VERSION missing");
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

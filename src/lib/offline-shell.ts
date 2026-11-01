// Keeps a copy of the app's start page in the offline cache, so the installed app opens
// with no internet instead of showing the browser's "no connection" page.
// The service worker reads this same cache (named "pages") when a page can't be reached.
const PAGES_CACHE = "pages";

export async function saveShell() {
  if (typeof window === "undefined" || !("caches" in window) || !navigator.onLine) return;
  try {
    const url = `${location.origin}/`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || res.status !== 200) return;
    const cache = await caches.open(PAGES_CACHE);
    await cache.put(new Request(url, { cache: "reload" }), res);
  } catch {
    /* the copy from a previous visit stays in place */
  }
}

/** True once a copy of the start page is on the device. */
export async function hasShell() {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  try {
    const cache = await caches.open(PAGES_CACHE);
    return !!(await cache.match(new Request(`${location.origin}/`, { cache: "reload" })));
  } catch {
    return false;
  }
}

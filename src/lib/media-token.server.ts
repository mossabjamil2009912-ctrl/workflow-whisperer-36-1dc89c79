export async function mediaToken(id: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(process.env["DASHBOARD_PASSWORD"] ?? ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("media:" + id));
  return Array.from(new Uint8Array(sig)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

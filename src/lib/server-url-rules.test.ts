import { describe, it, expect } from "vitest";
import { normalizeServerUrl } from "./server-url-rules";

describe("normalizeServerUrl", () => {
  it("accepts a public https host", () => {
    expect(normalizeServerUrl("https://n8n.example.com/")).toEqual({ ok: true, url: "https://n8n.example.com" });
  });
  it("rejects http", () => expect(normalizeServerUrl("http://n8n.example.com").ok).toBe(false));
  it("rejects localhost", () => expect(normalizeServerUrl("https://localhost").ok).toBe(false));
  it("rejects private IPs", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.20.0.1", "169.254.169.254"])
      expect(normalizeServerUrl(`https://${ip}`).ok).toBe(false);
  });
  it("rejects internal names", () => expect(normalizeServerUrl("https://n8n.internal").ok).toBe(false));
});

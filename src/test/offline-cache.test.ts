import { describe, it, expect, vi, beforeEach } from "vitest";

// idb-keyval needs a real IndexedDB; keep the on-device copy in memory for the test.
const store = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v); },
}));

import { offlineQuery, snapshotTime } from "@/lib/offline-cache";

const KEY = 'actes-snapshot:["orders"]';
const setOnline = (v: boolean) => Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("offlineQuery — النسخة المحفوظة على الجهاز", () => {
  beforeEach(() => { store.clear(); setOnline(true); });

  it("بعد كل تحميل ناجح يحفظ نسخة على الجهاز", async () => {
    const q = offlineQuery({ queryKey: ["orders"], queryFn: async () => [{ id: "1" }] });
    expect(await q.queryFn()).toEqual([{ id: "1" }]);
    await flush();
    expect(store.get(KEY)).toMatchObject({ data: [{ id: "1" }] });
    expect(await snapshotTime(["orders"])).toBeTypeOf("number");
  });

  it("دون إنترنت يعرض المحفوظ ولا يكلّم السيرفر", async () => {
    const live = vi.fn(async () => [{ id: "fresh" }]);
    await offlineQuery({ queryKey: ["orders"], queryFn: live }).queryFn();
    await flush();
    setOnline(false);
    const offline = offlineQuery({ queryKey: ["orders"], queryFn: live });
    expect(await offline.queryFn()).toEqual([{ id: "fresh" }]);
    expect(live).toHaveBeenCalledTimes(1);
  });

  it("لو الطلب فشل والنسخة محفوظة يعرض المحفوظ بدل الخطأ", async () => {
    const ok = async () => [{ id: "saved" }];
    await offlineQuery({ queryKey: ["orders"], queryFn: ok }).queryFn();
    await flush();
    const broken = offlineQuery({ queryKey: ["orders"], queryFn: async () => { throw new Error("fetch failed"); } });
    expect(await broken.queryFn()).toEqual([{ id: "saved" }]);
  });

  it("دون إنترنت وبدون نسخة محفوظة يرفع الخطأ بدل أن يكذب", async () => {
    setOnline(false);
    const q = offlineQuery({ queryKey: ["tickets"], queryFn: async () => [{ id: "x" }] });
    await expect(q.queryFn()).rejects.toThrow("offline");
  });
});

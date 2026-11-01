import { describe, it, expect } from "vitest";
import { sendBlocker } from "@/lib/report-rules";

describe("report request sending", () => {
  it("cannot send without an uploaded file", () => expect(sendBlocker({ status: "pending" }, null)).not.toBeNull());
  it("cannot send an already-sent request twice", () => expect(sendBlocker({ status: "sent" }, { path: "x" })).not.toBeNull());
  it("pending with file can be sent", () => expect(sendBlocker({ status: "pending" }, { path: "x" })).toBeNull());
});

import { matchPreset } from "@/lib/report-rules";
describe("automatic report match", () => {
  const titles = ["8 كيلو — بطارية 16 كيلو — 8 ألواح 720W", "8 كيلو — بطارية 32 كيلو — 16 لوح 720W", "12 كيلو 3 فاز · 18 لوح 720W · بطارية 32"];
  it("picks the closest 8 kW system", () => expect(matchPreset("إنفرتر 8 كيلو | ألواح: 15 | بطاريات: 32 كيلو", titles)).toBe(titles[1]));
  it("needs the same phase", () => expect(matchPreset("إنفرتر 12 كيلو | ألواح: 18 | بطاريات: 32 كيلو", titles)).toBeNull());
  it("no ready file for a 50 kW system", () => expect(matchPreset("إنفرتر سوليس 50 كيلو وات 3 فاز × 2 | ألواح: 240 (172.8 ك.و) | بطاريات: 352 كيلو", titles)).toBeNull());
});

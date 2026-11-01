// On-device queue for agent text messages written while offline; flushed when the connection returns.
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";

export type Pending = { lid: string; id: string; text: string; at: string };
const KEY = "actes-outbox";
let items: Pending[] = [];
let loaded = false;
const subs = new Set<(p: Pending[]) => void>();
const emit = () => { subs.forEach((f) => f(items)); void set(KEY, items); };

async function load() {
  if (loaded) return;
  loaded = true;
  items = ((await get(KEY)) as Pending[] | undefined) ?? [];
  subs.forEach((f) => f(items));
}

export function enqueue(id: string, text: string) {
  items = [...items, { lid: `${Date.now()}-${items.length}`, id, text, at: new Date().toISOString() }];
  emit();
}

export function usePending(id?: string) {
  const [p, setP] = useState<Pending[]>([]);
  useEffect(() => {
    const f = (all: Pending[]) => setP(id ? all.filter((x) => x.id === id) : all);
    subs.add(f); void load().then(() => f(items));
    return () => { subs.delete(f); };
  }, [id]);
  return p;
}

let flushing = false;
/** Sends queued messages in order; stops at the first failure and keeps the rest. */
export async function flush(send: (m: Pending) => Promise<unknown>) {
  await load();
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    while (items.length && navigator.onLine) {
      const m = items[0]!;
      await send(m);
      items = items.slice(1);
      emit();
    }
  } catch { /* retry on next online event */ } finally { flushing = false; }
}

export const isNetworkError = (e: unknown) =>
  !navigator.onLine || (e instanceof TypeError) || /fetch|network|Failed to/i.test(String((e as Error)?.message ?? e));

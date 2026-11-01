// On-device copy of every screen's data, so the installed app still opens and shows
// the last-known customers, chats, orders, tickets, catalog and quotes with no internet.
import { get, set } from "idb-keyval";

const PREFIX = "actes-snapshot:";

type Stamped<T> = { data: T; at: number };

/** Remembers the newest successful copy of a screen's data on the device. */
export async function saveSnapshot<T>(key: string, data: T) {
  try {
    await set(PREFIX + key, { data, at: Date.now() } satisfies Stamped<T>);
  } catch {
    /* storage full or blocked — the app keeps working from memory */
  }
}

/** The copy saved on the device, or undefined if this screen was never opened online. */
export async function loadSnapshot<T>(key: string): Promise<T | undefined> {
  try {
    const v = await get<Stamped<T>>(PREFIX + key);
    return v?.data;
  } catch {
    return undefined;
  }
}

/** When the on-device copy of a screen was written (ms since epoch), or null. */
export async function snapshotTime(queryKey: readonly unknown[]): Promise<number | null> {
  try {
    const v = await get<Stamped<unknown>>(PREFIX + JSON.stringify(queryKey));
    return v?.at ?? null;
  } catch {
    return null;
  }
}

export type OfflineQueryOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  refetchInterval?: number;
  staleTime?: number;
};

/**
 * Same query, but the result is copied to the device on every success and read back
 * from the device when the internet is missing or the request fails.
 */
export function offlineQuery<T>({ queryKey, queryFn, refetchInterval, staleTime }: OfflineQueryOptions<T>) {
  const key = JSON.stringify(queryKey);
  return {
    queryKey,
    ...(refetchInterval !== undefined ? { refetchInterval } : {}),
    ...(staleTime !== undefined ? { staleTime } : {}),
    queryFn: async (): Promise<T> => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const cached = await loadSnapshot<T>(key);
        if (cached !== undefined) return cached;
        throw new Error("offline");
      }
      try {
        const data = await queryFn();
        void saveSnapshot(key, data);
        return data;
      } catch (e) {
        const cached = await loadSnapshot<T>(key);
        if (cached !== undefined) return cached;
        throw e;
      }
    },
  };
}

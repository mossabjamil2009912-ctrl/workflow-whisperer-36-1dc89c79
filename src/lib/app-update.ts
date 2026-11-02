// Forced-update rules: update when the published version differs, but try each version only once per session.
export function needsUpdate(local: string, remote: string | null | undefined, attempted: boolean): "none" | "update" | "failed" {
  if (!remote || remote === local) return "none";
  return attempted ? "failed" : "update";
}

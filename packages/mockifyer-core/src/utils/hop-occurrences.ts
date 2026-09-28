/**
 * A replayed or always-refreshed hop keeps its stored `requestId`, so every call to it
 * (and every child that names it as parent) shares one id across runs. Pick the call a
 * child belongs to: the latest parent call that started at or before the child, else the
 * earliest parent call. `parentStartsMs` must be sorted ascending.
 *
 * Self-contained on purpose: the Atlas live page embeds this function's source.
 *
 * @returns index into `parentStartsMs`, or -1 when there is no parent call
 */
export function pickHopOccurrenceIndex(parentStartsMs: readonly number[], childStartMs: number): number {
  if (parentStartsMs.length === 0) return -1;
  if (!isFinite(childStartMs)) return parentStartsMs.length - 1;
  let picked = 0;
  for (let i = 0; i < parentStartsMs.length; i++) {
    if (parentStartsMs[i] <= childStartMs) picked = i;
  }
  return picked;
}

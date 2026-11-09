/**
 * Last write wins, per record: `incoming` replaces `existing` when it was
 * changed later. On a tie the existing copy stays, so every device and the
 * server settle on the same record.
 */
export function isNewer(
  incoming: { updatedAt: string },
  existing: { updatedAt: string } | undefined,
): boolean {
  if (!existing) return true;
  return Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt);
}

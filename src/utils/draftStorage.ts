/** Keep personal drafts separate on a shared browser or Windows installation. */
export function draftKeyForUser(userId: string | null | undefined, entityKey: string): string {
  return userId ? `shab-draft-v2:${userId}:${entityKey}` : '';
}

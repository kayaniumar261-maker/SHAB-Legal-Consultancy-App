function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function nameFromEmail(email: string | null | undefined): string | null {
  const localPart = email?.split('@')[0]?.trim();
  if (!localPart) return null;

  const words = localPart
    .split(/[._-]+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`);

  return words.length > 0 ? words.join(' ') : null;
}

export function resolveUserDisplayName(
  profileName: string | null | undefined,
  metadataName: unknown,
  email: string | null | undefined,
): string {
  return normalizeName(profileName)
    ?? normalizeName(metadataName)
    ?? nameFromEmail(email)
    ?? 'User';
}


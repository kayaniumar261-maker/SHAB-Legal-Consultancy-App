export function getAuthSetupRedirectUrl(): string {
  const configured = String(import.meta.env.VITE_AUTH_REDIRECT_URL || '').trim();

  if (configured) {
    const target = new URL(configured);
    if (target.protocol !== 'https:' && target.hostname !== '127.0.0.1' && target.hostname !== 'localhost') {
      throw new Error('The configured authentication redirect must use HTTPS.');
    }
    return target.toString();
  }

  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    return new URL('/auth/setup', window.location.origin).toString();
  }

  throw new Error('Password setup requires a configured secure browser address.');
}

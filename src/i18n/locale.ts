import { useSyncExternalStore } from 'react';
import arabic from './ar.json';

export type Language = 'en' | 'ar';
const STORAGE_KEY = 'shab-interface-language';
const listeners = new Set<() => void>();
const arabicLabels = new Map(Object.entries(arabic).map(([key, value]) => [key.toLocaleLowerCase('en'), value]));
function readLanguage(): Language {
  try { return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en'; }
  catch { return 'en'; }
}
let language = readLanguage();
function applyDirection() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}
applyDirection();
export function setLanguage(next: Language) {
  if (next !== 'en' && next !== 'ar') return;
  language = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Private browsing still supports switching. */ }
  applyDirection();
  listeners.forEach((listener) => listener());
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      language = readLanguage();
      applyDirection();
      listeners.forEach((listener) => listener());
    }
  });
}
export function useLocale() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => language,
    () => 'en' as Language,
  );
}
export function getLocale(english = 'en-AE') {
  return language === 'ar' ? 'ar-AE' : english;
}
/** Only developer-owned UI messages belong here; never translate record values. */
export function tr(message: string | null | undefined, values: readonly unknown[] = []): string {
  if (message == null) return '';
  const translated = language === 'ar'
    ? (arabic as Record<string, string>)[message] ?? arabicLabels.get(message.toLocaleLowerCase('en')) ?? message
    : message;
  return translated.replace(/\{(\d+)\}/g, (token, index: string) =>
    Number(index) < values.length ? String(values[Number(index)] ?? '') : token,
  );
}

/** Translate only fixed enum codes; submitted values and user-authored fields stay untouched. */
export function trEnum(value: string | null | undefined): string {
  if (value == null) return tr('Not set');
  const friendly = value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  if (language === 'ar' && friendly.toLowerCase() === 'open') return 'مفتوح';
  return tr(friendly);
}

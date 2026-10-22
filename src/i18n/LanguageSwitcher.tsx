import { Languages } from 'lucide-react';
import { setLanguage, useLocale } from './locale';
import './rtl.css';

export function LanguageSwitcher() {
  const language = useLocale();
  return <div className="language-switcher">
    <Languages size={17} aria-hidden="true" />
    <label className="sr-only" htmlFor="interface-language">Language / اللغة</label>
    <select id="interface-language" value={language} onChange={(event) => setLanguage(event.target.value === 'ar' ? 'ar' : 'en')}>
      <option value="en" lang="en">English</option>
      <option value="ar" lang="ar">العربية</option>
    </select>
  </div>;
}

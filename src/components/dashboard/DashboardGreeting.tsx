import { tr, getLocale, useLocale } from '../../i18n/locale';
import { CloudSun, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAccessProfile } from '../../hooks/useAccessProfile';
import { useAuth } from '../../hooks/useAuth';
import { resolveUserDisplayName } from '../../utils/userDisplayName';

const LOCATIONS = {
  Sharjah: { latitude: 25.3463, longitude: 55.4209 },
  Dubai: { latitude: 25.2048, longitude: 55.2708 },
  'Abu Dhabi': { latitude: 24.4539, longitude: 54.3773 },
} as const;

type LocationName = keyof typeof LOCATIONS;

function greetingFor(hour: number) {
  if (hour < 12) return tr('Good morning');
  if (hour < 18) return tr('Good afternoon');
  return tr('Good evening');
}

export function DashboardGreeting() {
  const language = useLocale();
  const { profile } = useAccessProfile();
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [location, setLocation] = useState<LocationName>(() =>
    (() => {
      const saved = localStorage.getItem('shab-dashboard-location');
      return saved && saved in LOCATIONS ? saved as LocationName : 'Sharjah';
    })(),
  );
  const [temperature, setTemperature] = useState<number | null>(null);
  const displayName = resolveUserDisplayName(
    profile?.full_name,
    user?.user_metadata?.full_name,
    user?.email,
  );
  const firstName = displayName.trim().split(/\s+/)[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('shab-dashboard-location', location);
    const place = LOCATIONS[location];
    const controller = new AbortController();
    void fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m&timezone=Asia%2FDubai`,
      { signal: controller.signal },
    )
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Weather unavailable')))
      .then((payload) => setTemperature(Number(payload.current?.temperature_2m)))
      .catch(() => setTemperature(null));
    return () => controller.abort();
  }, [location]);

  const formattedDate = useMemo(() => new Intl.DateTimeFormat(getLocale("en-AE"), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now), [now, language]);

  const compactDate = useMemo(() => new Intl.DateTimeFormat(getLocale("en-AE"), {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(now), [now, language]);

  return (
    <section className="dashboard-greeting">
      <div>
        <h2>{greetingFor(now.getHours())}, {firstName}</h2>
        <p>{tr("Here's what's happening at SHAB Legal Consultants FZC today.")}</p>
      </div>
      <div className="dashboard-context">
        <time dateTime={now.toISOString()}>
          <span className="dashboard-date-full">{formattedDate}</span>
          <span className="dashboard-date-compact">{compactDate}</span>
        </time>
        <label>
          <MapPin size={14} />
          <select value={location} onChange={(event) => setLocation(event.target.value as LocationName)}>
            {Object.keys(LOCATIONS).map((name) => <option key={name} value={name}>{tr(name)}</option>)}
          </select>
        </label>
        <span><CloudSun size={18} />{temperature === null ? tr("Weather unavailable") : tr("{0}°C", [Math.round(temperature)])}</span>
      </div>
    </section>
  );
}

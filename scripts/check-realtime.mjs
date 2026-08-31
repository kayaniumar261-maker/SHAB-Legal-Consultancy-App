import fs from 'node:fs';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const requireMatch = (condition, message) => {
  if (!condition) failures.push(message);
};

const hook = read('src/hooks/useRealtimeRefresh.ts');
const migration = read(
  'supabase/migrations/20260824000100_realtime_operational_sync.sql',
);

for (const contract of [
  "channel.on(",
  "'postgres_changes'",
  'window.setTimeout',
  "document.visibilityState === 'hidden'",
  'supabase.removeChannel(channel)',
]) {
  requireMatch(
    hook.includes(contract),
    `Realtime hook contract is missing: ${contract}`,
  );
}

for (const page of [
  'Dashboard',
  'Clients',
  'Cases',
  'Tasks',
  'Hearings',
  'Calendar',
  'Documents',
]) {
  const source = read(`src/pages/${page}.tsx`);

  requireMatch(
    source.includes("from '../hooks/useRealtimeRefresh'"),
    `${page} does not import realtime refresh support.`,
  );
  requireMatch(
    source.includes('useRealtimeRefresh('),
    `${page} does not subscribe to relevant live records.`,
  );
}

for (const table of ['clients', 'cases', 'tasks', 'hearings', 'documents']) {
  requireMatch(
    migration.includes(`'${table}'`),
    `Realtime publication migration is missing table: ${table}`,
  );
}

if (failures.length) {
  console.error('Realtime regression checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Realtime regression checks passed.');

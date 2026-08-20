import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const requireMatch = (condition, message) => { if (!condition) failures.push(message); };

const main = read('src/main.tsx');
const app = read('src/App.tsx');
const dashboard = read('src/pages/Dashboard.tsx');

requireMatch(main.includes('HashRouter') && main.includes("window.location.protocol === 'file:'"), 'Electron file sessions must use HashRouter.');
requireMatch(dashboard.includes('<Link') && dashboard.includes('to={to}'), 'Executive Alerts must use React Router Link navigation.');
requireMatch(!dashboard.includes('href={to}'), 'Executive Alerts must not use document-level href navigation.');
requireMatch(app.includes('path="/auth/setup"'), 'Public password-setup route is missing.');

for (const route of ['/payments', '/tasks', '/hearings']) {
  requireMatch(app.includes(`path="${route}"`), `Required Executive Alert destination is missing: ${route}`);
}

function allSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? allSourceFiles(target) : /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

const source = allSourceFiles('src').map(read).join('\n');
requireMatch(source.includes('navigate(item.to)'), 'Notification navigation contract was not found.');
requireMatch(source.includes('navigate(result.to)'), 'Global Search navigation contract was not found.');

if (failures.length) {
  console.error('Navigation regression checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Navigation regression checks passed.');

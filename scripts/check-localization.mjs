import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const arabic = JSON.parse(fs.readFileSync('src/i18n/ar.json', 'utf8'));
const sources = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file)) sources.push(file);
  }
}
walk('src');
let messages = 0;
for (const file of sources) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'tr' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const key = node.arguments[0].text;
      assert.ok(arabic[key]?.trim(), `${file}: missing Arabic translation for ${key}`);
      const allowed = new Set(key.match(/\{\d+\}/g) ?? []);
      for (const token of arabic[key].match(/\{\d+\}/g) ?? []) assert.ok(allowed.has(token), `${key}: unexpected ${token}`);
      messages++;
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'option' && node.getText(source).includes('tr(')) {
      assert.ok(node.openingElement.attributes.properties.some((attribute) => attribute.name?.getText(source) === 'value'), `${file}: translated option must retain its original submitted value`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
// Exercise the real preference store without accessing production accounts.
const storage = new Map();
let storageHandler;
const document = { documentElement: { lang: '', dir: '' } };
function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; }, ...globals });
  return module.exports;
}
const environment = {
  document,
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  window: { addEventListener: (event, handler) => { if (event === 'storage') storageHandler = handler; } },
};
let notify = 0;
const locale = load('src/i18n/locale.ts', {
  react: { useSyncExternalStore(subscribe, snapshot) { subscribe(() => notify++); return snapshot(); } },
  './ar.json': arabic,
}, environment);
assert.equal(locale.useLocale(), 'en');
assert.equal(document.documentElement.dir, 'ltr');
assert.equal(locale.tr('Clients'), 'Clients');
locale.setLanguage('ar');
assert.equal(locale.useLocale(), 'ar');
assert.equal(document.documentElement.lang, 'ar');
assert.equal(document.documentElement.dir, 'rtl');
assert.equal(locale.tr('Clients'), 'العملاء');
assert.equal(locale.tr('Showing {0} of {1}', [12, 31]), 'عرض 12 من 31');
assert.equal(locale.trEnum('in_progress'), 'قيد التنفيذ');
assert.equal(locale.trEnum('open'), 'مفتوح');
assert.equal(locale.tr('Unknown custom message'), 'Unknown custom message');
assert.equal(locale.tr(null), '');
assert.equal(locale.getLocale(), 'ar-AE');
assert.ok(notify > 0);
assert.equal(load('src/i18n/locale.ts', { react: {}, './ar.json': arabic }, environment).getLocale(), 'ar-AE', 'language survives reload');
storage.set('shab-interface-language', 'en');
storageHandler({ key: 'shab-interface-language' });
// Read using a fresh store because the second load owns the storage listener.
assert.equal(load('src/i18n/locale.ts', { react: {}, './ar.json': arabic }, environment).getLocale(), 'en-AE');
locale.setLanguage('en');
assert.equal(document.documentElement.dir, 'ltr');
assert.equal(locale.getLocale('en-GB'), 'en-GB');
const blockedStorage = load('src/i18n/locale.ts', { react: {}, './ar.json': arabic }, { document, localStorage: { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } } });
blockedStorage.setLanguage('ar');
assert.equal(document.documentElement.dir, 'rtl');

// Ordering must be applied to the full query before range() slices each page.
const calls = [];
const fixtures = ['Zain', 'Ali', 'Mona', 'Bashir', 'أحمد', 'خالد'];
const query = {
  select() { return this; }, eq() { return this; }, or() { return this; },
  order(column, options) { calls.push(['order', column, options]); return this; },
  range(from, to) {
    calls.push(['range', from, to]);
    const first = calls.find((call) => call[0] === 'order');
    const names = [...fixtures].sort((a, b) => a.localeCompare(b));
    if (!first[2].ascending) names.reverse();
    return Promise.resolve({ data: names.slice(from, to + 1).map((full_name) => ({ id: full_name, full_name })), count: fixtures.length, error: null });
  },
};
const clients = load('src/services/clientService.ts', { '../lib/supabase': { supabase: { from: () => query } }, '../utils/searchFilter': { containsFilterValue: (text) => text } });
const first = await clients.getClients({ page: 1, pageSize: 2 });
assert.equal(calls[0][1], 'full_name');
assert.equal(calls[0][2].ascending, true);
assert.equal(calls.at(-2)[1], 'id', 'unique tie-breaker for equal names');
assert.deepEqual(calls.at(-1), ['range', 0, 1]);
assert.equal(first.count, fixtures.length);
calls.length = 0;
const second = await clients.getClients({ page: 2, pageSize: 2, search: 'a' });
assert.deepEqual(calls.at(-1), ['range', 2, 3]);
assert.equal(new Set([...first.data, ...second.data].map((client) => client.id)).size, 4);
calls.length = 0;
await clients.getClients({ sortBy: 'created_at', sortDirection: 'desc' });
assert.equal(calls[0][1], 'created_at');
assert.equal(calls[0][2].ascending, false);
console.log(`Localization checks passed: ${messages} translated messages, direction, preference persistence, storage failures, interpolation, enum labels, global client pagination.`);

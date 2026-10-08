import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function load(file, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency ${name} in ${file}`);
    },
    console: { error() {}, warn() {}, info() {} },
    URL, Request, Response, AbortController, AbortSignal, DOMException,
    setTimeout, clearTimeout,
    ...globals,
  }, { filename: file });
  return module.exports;
}

function hooks() {
  const state = [], effects = [], timers = new Map(), listeners = new Map();
  let nextTimer = 0;
  const react = {
    useState(value) {
      const index = state.push(value) - 1;
      return [value, (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useRef: (current) => ({ current }),
    useCallback: (callback) => callback,
    useEffect: (callback) => { effects.push(callback); },
  };
  const window = {
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  return {
    state, react, window, listeners,
    start: () => effects.map((effect) => effect()),
    async tick() {
      const pending = [...timers.values()]; timers.clear();
      pending.forEach((callback) => callback()); await flush();
    },
  };
}

// Reconnect must reconcile changes missed during the outage; throws are caught.
{
  const h = hooks(), channels = [], failures = [];
  let refreshed = 0;
  const supabase = {
    channel() {
      const channel = { on(_event, _filter, callback) { this.change = callback; return this; }, subscribe(callback) { this.status = callback; return this; } };
      channels.push(channel); return channel;
    },
    async removeChannel() {},
  };
  const document = { visibilityState: 'visible', addEventListener: h.window.addEventListener, removeEventListener: h.window.removeEventListener };
  const { useRealtimeRefresh } = load('src/hooks/useRealtimeRefresh.ts', { react: h.react, '../lib/supabase': { supabase } }, {
    window: h.window, navigator: { onLine: true }, document,
    console: { error: (...args) => failures.push(args), warn() {} },
  });
  useRealtimeRefresh(['cases'], () => { refreshed++; if (refreshed === 1) throw new Error('Simulated refresh failure'); });
  const cleanup = h.start().at(-1);
  channels[0].status('SUBSCRIBED');
  channels[0].status('CHANNEL_ERROR'); await h.tick();
  assert.equal(channels.length, 2);
  assert.equal(refreshed, 0, 'Reconcile after subscription, not before it');
  channels[1].status('SUBSCRIBED'); await h.tick();
  assert.equal(refreshed, 1); assert.equal(failures.length, 1);
  channels[1].change(); await h.tick(); assert.equal(refreshed, 2);
  channels[1].status('CLOSED'); await h.tick();
  channels[2].status('SUBSCRIBED'); await h.tick(); assert.equal(refreshed, 3);
  cleanup(); channels[2].change(); await h.tick(); assert.equal(refreshed, 3);
}

// Auth callback cannot call another auth API while Supabase's lock is held.
// A late profile response cannot restore access after sign-out.
{
  const h = hooks(), initial = deferred(), profileRequest = deferred();
  let callback, sessionCalls = 0;
  const supabase = { auth: {
    getSession() { sessionCalls++; return sessionCalls === 1 ? initial.promise : Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null }); },
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
  } };
  const { useAccessProfile } = load('src/hooks/useAccessProfile.ts', {
    react: h.react, '../lib/supabase': { supabase }, '../services/accessControlService': { getMyAccessProfile: () => profileRequest.promise },
  }, { window: h.window });
  useAccessProfile(); const [cleanup] = h.start();
  callback('SIGNED_IN', { user: { id: 'test-user' } });
  assert.equal(sessionCalls, 1);
  await h.tick(); assert.equal(sessionCalls, 2);
  callback('SIGNED_OUT', null);
  profileRequest.resolve({ is_active: true }); initial.resolve({ data: { session: { user: { id: 'old-user' } } } }); await flush();
  assert.equal(h.state[0], null); assert.equal(h.state[1], false);
  cleanup();
}

// Session restoration failures release the loading screen; late sessions are ignored.
for (const rejection of [false, true]) {
  const h = hooks(), initial = deferred(); let callback;
  const supabase = { auth: {
    getSession: () => initial.promise,
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: async () => ({ error: new Error('Sign-out failed') }),
  } };
  const { useAuth } = load('src/hooks/useAuth.ts', { react: h.react, '../lib/supabase': { supabase } });
  const auth = useAuth(); h.start();
  if (rejection) initial.reject(new Error('Connection unavailable'));
  else { callback('SIGNED_OUT', null); initial.resolve({ data: { session: { user: { id: 'old-user' } } } }); }
  await flush(); assert.equal(h.state[1], null); assert.equal(h.state[2], false);
  await assert.rejects(auth.signOut(), /Sign-out failed/);
}

// A database refusal must never remove the stored document file.
for (const failure of ['database', 'storage', null]) {
  const operations = [];
  const supabase = {
    from() { return { delete() { return { eq() { return { select() { return { async single() { operations.push('database'); return { error: failure === 'database' ? { message: 'Deletion denied' } : null, data: { id: 'document' } }; } }; } }; } }; } }; },
    storage: { from() { return { async remove() { operations.push('storage'); return { error: failure === 'storage' ? { message: 'Storage offline' } : null }; } }; } },
  };
  const service = load('src/services/documentService.ts', {
    '../lib/supabase': { supabase }, '../utils/searchFilter': { containsFilterValue() {} },
  });
  const deletion = service.deleteDocument({ id: 'document', storage_bucket: 'legal-documents', storage_path: 'test.pdf' });
  if (failure) await assert.rejects(deletion, failure === 'database' ? /Deletion denied/ : /record was deleted.*file could not be removed/);
  else await deletion;
  assert.deepEqual(operations, failure === 'database' ? ['database'] : ['database', 'storage']);
}

// AI authentication must fail closed before spending provider tokens.
for (const scenario of ['missing', 'anonymous', 'inactive', 'null-body', 'active', 'empty-provider']) {
  let handler; const requests = [];
  const environment = { SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'test-key', OPENAI_API_KEY: 'test-provider-key', OPENAI_MODEL: 'test-model' };
  load('supabase/functions/shab-ai/index.ts', {}, {
    Deno: { env: { get: (name) => environment[name] }, serve: (fn) => { handler = fn; } },
    async fetch(url) {
      requests.push(url);
      if (url.endsWith('/auth/v1/user')) return Response.json(scenario === 'anonymous' ? { error: 'Invalid user' } : { id: 'test-user' }, { status: scenario === 'anonymous' ? 401 : 200 });
      if (url.endsWith('/rpc/shab_is_active_app_user')) return Response.json(scenario !== 'inactive');
      return Response.json(scenario === 'empty-provider' ? null : { output_text: 'Test response', id: 'test-response' });
    },
  });
  const response = await handler(new Request('https://project.example/functions/v1/shab-ai', {
    method: 'POST', headers: scenario === 'missing' ? {} : { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario === 'null-body' ? null : { prompt: 'A fictional test prompt' }),
  }));
  const expected = { missing: 401, anonymous: 401, inactive: 403, 'null-body': 400, active: 200, 'empty-provider': 502 };
  assert.equal(response.status, expected[scenario], scenario);
  assert.equal(requests.filter((url) => url.includes('api.openai.com')).length, ['active', 'empty-provider'].includes(scenario) ? 1 : 0);
}

// Desktop permits its own hash routes and sends web links to the system browser.
{
  const { isAppDocument, isExternalWebUrl } = require('../electron/navigation.cjs');
  const indexPath = path.resolve('dist', 'index.html');
  assert.equal(isAppDocument(`${pathToFileURL(indexPath).href}#/cases`, indexPath), true);
  for (const value of ['https://attacker.example', 'file:///etc/passwd', 'javascript:alert(1)', 'not-a-url']) assert.equal(isAppDocument(value, indexPath), false);
  assert.equal(isExternalWebUrl('https://example.com/document'), true);
  assert.equal(isExternalWebUrl('javascript:alert(1)'), false);
}

// Totals must include rows beyond the server's page cap, even a smaller cap.
{
  const { readAllRows } = load('src/services/paginatedRead.ts');
  const data = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const actual = await readAllRows(() => ({ async range(from, to) {
    return { data: data.slice(from, Math.min(to + 1, from + 250)), error: null };
  } }));
  assert.equal(actual.length, 1201); assert.equal(new Set(actual.map((row) => row.id)).size, 1201);
  await assert.rejects(readAllRows(() => ({ async range() { return { data: null, error: { message: 'Read failed' } }; } })), /Read failed/);
}

// Unallocated foreign-currency client funds must not acquire a phantom AED balance.
{
  const datasets = { client_fund_receipts: [{ id: 'receipt', client_id: 'client', currency: 'USD', amount: 100 }] };
  const supabase = { from(table) { return { select() { return { in() { return { order() { return table; } }; } }; } }; } };
  const { getClientFinanceSummaries } = load('src/services/financeSummaryService.ts', {
    '../lib/supabase': { supabase }, './paginatedRead': { readAllRows: async (query) => datasets[query()] ?? [] },
  });
  const summary = (await getClientFinanceSummaries(['client'])).client;
  assert.equal(summary.currency, 'USD'); assert.equal(summary.hasMixedCurrencies, false); assert.equal(summary.netCollected, 100);
}

// Personal drafts cannot be restored under another account or before sign-in.
{
  const { draftKeyForUser } = load('src/utils/draftStorage.ts');
  const storage = new Map();
  storage.set(draftKeyForUser('user-a', 'new-case'), 'Private draft');
  assert.equal(storage.get(draftKeyForUser('user-b', 'new-case')), undefined);
  assert.equal(draftKeyForUser(null, 'new-case'), '');
  assert.notEqual(draftKeyForUser('user-a', 'case-one'), draftKeyForUser('user-a', 'case-two'));
}

// An unissued draft must not appear as billed or overdue in finance widgets.
{
  const supabase = { from() { return { select() { return { order() { return 'invoices'; } }; } }; } };
  const { getFinanceSummary } = load('src/services/invoiceService.ts', {
    '../lib/supabase': { supabase }, './paginatedRead': { readAllRows: async () => [
      { status: 'draft', total_amount: 900, paid_amount: 0, balance_amount: 900, due_date: '2000-01-01' },
      { status: 'issued', total_amount: 100, paid_amount: 0, balance_amount: 100, due_date: null },
    ] },
  });
  const summary = await getFinanceSummary();
  assert.equal(summary.totalBilled, 100); assert.equal(summary.invoiceCount, 1); assert.equal(summary.overdue, 0);
}

console.log('Behavior checks passed: reconnect, auth lifecycle, document deletion, AI authorization, desktop navigation, complete financial reads, currency handling, draft isolation, invoice status.');

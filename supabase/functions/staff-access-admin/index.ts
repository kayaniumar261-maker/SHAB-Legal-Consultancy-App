import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};
const admins = new Set(['umar@shabgroup.com', 'haider@shabgroup.com', 'siyab@shabgroup.com']);
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function allowedRedirect(value: string) {
  try {
    const candidate = new URL(value);
    const configured = Deno.env.get('STAFF_AUTH_REDIRECT_URL')?.trim();
    if (configured) {
      const approved = new URL(configured);
      if (candidate.origin === approved.origin && candidate.pathname === approved.pathname) return true;
    }
    return candidate.protocol === 'http:' &&
      (candidate.hostname === '127.0.0.1' || candidate.hostname === 'localhost') &&
      (candidate.port === '5173' || candidate.port === '4173') &&
      candidate.pathname === '/auth/setup';
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!url || !anon || !service || !authorization) return reply({ ok: false, error: 'Missing secure function configuration.' }, 401);

    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) return reply({ ok: false, error: 'Authentication required.' }, 401);
    const { data: isAdmin, error: roleError } = await caller.rpc('shab_is_administrator');
    if (roleError || !isAdmin) return reply({ ok: false, error: 'Administrator access required.' }, 403);

    const body = await request.json();
    const action = String(body.action || '');
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const redirectTo = String(body.redirectTo || '').trim();
    if (!email || !email.includes('@')) return reply({ ok: false, error: 'A valid email is required.' }, 400);
    if (!allowedRedirect(redirectTo)) return reply({ ok: false, error: 'The password-setup redirect is not approved.' }, 400);
    const administratorAction = action === 'invite_administrator';
    if (administratorAction && !admins.has(email)) return reply({ ok: false, error: 'This email is not an approved administrator.' }, 403);
    if (!administratorAction && action !== 'resend_invite' && admins.has(email)) return reply({ ok: false, error: 'Use the protected administrator invitation control.' }, 400);

    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    if (action === 'invite' || action === 'invite_administrator') {
      if (!fullName) return reply({ ok: false, error: 'Full name is required.' }, 400);
      const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo });
      if (error) return reply({ ok: false, error: error.message }, 400);
      return reply({ ok: true, email });
    }
    if (action === 'resend_invite') {
      const { error } = await admin.auth.resend({ type: 'invite', email, options: { emailRedirectTo: redirectTo } });
      if (error) return reply({ ok: false, error: error.message }, 400);
      return reply({ ok: true, email });
    }
    return reply({ ok: false, error: 'Unsupported account action.' }, 400);
  } catch (error) {
    return reply({ ok: false, error: error instanceof Error ? error.message : 'Unexpected function error.' }, 500);
  }
});

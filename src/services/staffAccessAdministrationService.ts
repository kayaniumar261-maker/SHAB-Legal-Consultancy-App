import { supabase } from '../lib/supabase';
import { getAuthSetupRedirectUrl } from './authRedirectService';

export type AccessAccount = {
  user_id: string;
  email: string;
  full_name: string | null;
  access_role: 'administrator' | 'operations_staff';
  is_active: boolean;
  staff_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AccessAuditEntry = {
  id: number;
  target_user_id: string;
  target_email: string;
  action: string;
  previous_is_active: boolean | null;
  new_is_active: boolean | null;
  performed_by_email: string | null;
  created_at: string;
};

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function listAccessAccounts(): Promise<AccessAccount[]> {
  const { data, error } = await supabase.rpc('shab_admin_list_access_accounts');
  if (error) throw new Error(error.message);
  return (data ?? []) as AccessAccount[];
}

export async function listAccessAudit(): Promise<AccessAuditEntry[]> {
  const { data, error } = await supabase.rpc('shab_admin_list_access_audit', { p_limit: 30 });
  if (error) throw new Error(error.message);
  return (data ?? []) as AccessAuditEntry[];
}

export async function setAccountActive(userId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc('shab_admin_set_account_active', {
    p_user_id: userId,
    p_is_active: active,
  });
  if (error) throw new Error(error.message);
}

export async function inviteOperationsStaff(input: { email: string; fullName: string }) {
  const { data, error } = await supabase.functions.invoke('staff-access-admin', {
    body: { action: 'invite', email: input.email, fullName: input.fullName, redirectTo: getAuthSetupRedirectUrl() },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || 'Unable to invite staff account.');
  return data as { ok: true; email: string };
}

export async function inviteApprovedAdministrator(input: { email: string; fullName: string }) {
  const { data, error } = await supabase.functions.invoke('staff-access-admin', {
    body: { action: 'invite_administrator', email: input.email, fullName: input.fullName, redirectTo: getAuthSetupRedirectUrl() },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || 'Unable to invite administrator.');
  return data as { ok: true; email: string };
}

export async function resendStaffInvite(email: string) {
  try {
    const { data, error } = await supabase.functions.invoke('staff-access-admin', {
      body: { action: 'resend_invite', email, redirectTo: getAuthSetupRedirectUrl() },
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Unable to resend invitation.');
  } catch (error) {
    throw new Error(message(error, 'Unable to resend invitation.'));
  }
}

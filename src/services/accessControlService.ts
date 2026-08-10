import { supabase } from '../lib/supabase';

export type AccessRole = 'administrator' | 'operations_staff';

export type AccessProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  access_role: AccessRole;
  is_active: boolean;
};

export async function getMyAccessProfile(): Promise<AccessProfile | null> {
  const { data, error } = await supabase.rpc('shab_get_my_access_profile');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AccessProfile[];
  return rows[0] ?? null;
}

export function isAdministrator(profile: AccessProfile | null): boolean {
  return Boolean(profile?.is_active && profile.access_role === 'administrator');
}

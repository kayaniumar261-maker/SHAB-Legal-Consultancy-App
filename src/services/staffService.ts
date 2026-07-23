import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Staff, StaffInsert, StaffUpdate } from '../types/staff';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getStaff(): Promise<Staff[]> {
  const result = await supabase.from('staff').select('*').order('full_name', { ascending: true });
  return handleError(result);
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const result = await supabase.from('staff').select('*').eq('id', id).single();
  if (result.error) {
    if (result.error.code === 'PGRST116') return null;
    throw new Error(result.error.message);
  }
  return result.data;
}

export async function createStaff(data: StaffInsert): Promise<Staff> {
  const result = await supabase.from('staff').insert(data).select().single();
  return handleError(result);
}

export async function updateStaff(id: string, data: StaffUpdate): Promise<Staff> {
  const result = await supabase.from('staff').update(data).eq('id', id).select().single();
  return handleError(result);
}

export async function deleteStaff(id: string): Promise<void> {
  const result = await supabase.from('staff').delete().eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

export async function countStaff(): Promise<number> {
  const result = await supabase.from('staff').select('id', { count: 'exact' });
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

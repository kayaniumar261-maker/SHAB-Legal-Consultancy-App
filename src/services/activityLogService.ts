import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ActivityLog, ActivityLogInsert } from '../types/activity_log';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getRecentActivity(limit = 10): Promise<ActivityLog[]> {
  const result = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  return handleError(result);
}

export async function createActivityLog(data: ActivityLogInsert): Promise<ActivityLog> {
  const result = await supabase.from('activity_logs').insert(data).select().single();
  return handleError(result);
}

import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Notification, NotificationInsert } from '../types/notification';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getNotifications(userId?: string): Promise<Notification[]> {
  const query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
  if (userId) query.eq('user_id', userId);
  const result = await query;
  return handleError(result);
}

export async function markNotificationRead(id: string): Promise<void> {
  const result = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

export async function createNotification(data: NotificationInsert): Promise<Notification> {
  const result = await supabase.from('notifications').insert(data).select().single();
  return handleError(result);
}

import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Hearing, HearingInsert, HearingUpdate, HearingFilterOptions, HearingStatus } from '../types/hearing';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getHearings(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: HearingFilterOptions;
} = {}): Promise<{ data: Hearing[]; count: number }> {
  const { page = 1, pageSize = 12, search = '', filters = {} } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('hearings')
    .select(
      `
      id,
      case_id,
      assigned_staff_id,
      title,
      hearing_at,
      end_at,
      court,
      courtroom,
      location,
      hearing_type,
      status,
      outcome,
      notes,
      reminder_minutes,
      created_by,
      created_at,
      updated_at
      `,
      { count: 'exact' }
    );

  // Apply filters
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.hearing_type) query = query.eq('hearing_type', filters.hearing_type);
  if (filters.assigned_staff_id) query = query.eq('assigned_staff_id', filters.assigned_staff_id);
  
  if (filters.startDate) {
    query = query.gte('hearing_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('hearing_at', filters.endDate);
  }

  // Apply search to case_id, title, court via text search
  if (search) {
    const searchLower = search.toLowerCase();
    query = query.or(`title.ilike.%${searchLower}%,court.ilike.%${searchLower}%`);
  }

  query = query.order('hearing_at', { ascending: true }).range(from, to);

  const result = await query;
  const data = handleError(result);
  return { data, count: result.count ?? 0 };
}

export async function getHearingById(id: string): Promise<Hearing> {
  const result = await supabase
    .from('hearings')
    .select('*')
    .eq('id', id)
    .single();
  return handleError(result);
}

export async function getHearingsByCase(caseId: string): Promise<Hearing[]> {
  const result = await supabase
    .from('hearings')
    .select('*')
    .eq('case_id', caseId)
    .order('hearing_at', { ascending: true });
  return handleError(result);
}

export async function getHearingsToday(): Promise<Hearing[]> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(new Date().getTime() + 86400000).toISOString().slice(0, 10);
  
  const result = await supabase
    .from('hearings')
    .select('*')
    .gte('hearing_at', `${today}T00:00:00`)
    .lt('hearing_at', `${tomorrow}T00:00:00`)
    .in('status', ['Scheduled', 'Adjourned'])
    .order('hearing_at', { ascending: true });
  return handleError(result);
}

export async function createHearing(data: HearingInsert): Promise<Hearing> {
  const result = await supabase
    .from('hearings')
    .insert(data)
    .select()
    .single();
  return handleError(result);
}

export async function updateHearing(id: string, data: HearingUpdate): Promise<Hearing> {
  const result = await supabase
    .from('hearings')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  return handleError(result);
}

export async function deleteHearing(id: string): Promise<void> {
  const result = await supabase
    .from('hearings')
    .delete()
    .eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

export async function markHearingCompleted(id: string): Promise<Hearing> {
  return updateHearing(id, { status: 'Completed' });
}

export async function markHearingAdjourned(id: string): Promise<Hearing> {
  return updateHearing(id, { status: 'Adjourned' });
}

export async function markHearingCancelled(id: string): Promise<Hearing> {
  return updateHearing(id, { status: 'Cancelled' });
}

export async function getCaseOptions(): Promise<Array<{ id: string; case_number: string; client_name: string }>> {
  const result = await supabase
    .from('cases')
    .select(
      `
      id,
      case_number,
      clients (full_name)
      `
    )
    .eq('status', 'Open')
    .order('case_number', { ascending: true });
  
  const data = handleError(result);
  return data.map((item: any) => ({
    id: item.id,
    case_number: item.case_number,
    client_name: item.clients?.full_name || 'Unknown',
  }));
}

export async function getStaffOptions(): Promise<Array<{ id: string; full_name: string }>> {
  const result = await supabase
    .from('staff')
    .select('id, full_name')
    .order('full_name', { ascending: true });
  return handleError(result);
}

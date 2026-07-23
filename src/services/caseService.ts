import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Client } from '../types/client';
import type {
  Case,
  CaseInsert,
  CaseListResult,
  CaseUpdate,
  CaseFilterOptions,
  CaseWithRelations,
} from '../types/case';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return result.data;
}

export async function getCases(
  options: CaseFilterOptions = {},
): Promise<CaseListResult & { data: CaseWithRelations[] }> {
  const {
    search,
    status = 'all',
    priority = 'all',
    clientId = 'all',
    caseType = 'all',
    sortBy = 'filing_date',
    sortOrder = 'desc',
    page = 1,
    pageSize = 12,
  } = options;

  const query = supabase
    .from('cases')
    // include related client and staff (alias to match relation fields)
    .select('*, client:clients(id,full_name,email), assigned_staff:staff(id,full_name,email)', { count: 'exact' });

  if (status !== 'all') {
    query.eq('status', status);
  }

  if (priority !== 'all') {
    query.eq('priority', priority);
  }

  if (clientId !== 'all') {
    query.eq('client_id', clientId);
  }

  if (caseType !== 'all') {
    query.ilike('case_type', `%${caseType}%`);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query.or(
      `case_number.ilike.${term},case_type.ilike.${term},court.ilike.${term},opponent.ilike.${term},opponent_lawyer.ilike.${term},assigned_lawyer.ilike.${term},description.ilike.${term},internal_notes.ilike.${term}`,
    );
  }

  query.order(sortBy, { ascending: sortOrder === 'asc' });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const result = await query.range(from, to);
  const data = handleError(result) as unknown as CaseWithRelations[];

  return {
    data,
    count: result.count ?? 0,
  };
}

export async function getCaseById(id: string): Promise<CaseWithRelations | null> {
  const result = await supabase
    .from('cases')
    .select('*, client:clients(id,full_name,email), assigned_staff:staff(id,full_name,email)')
    .eq('id', id)
    .single();

  if (result.error) {
    if (result.error.code === 'PGRST116') {
      return null;
    }

    throw new Error(result.error.message);
  }

  return result.data as CaseWithRelations;
}

export async function createCase(data: CaseInsert): Promise<Case> {
  const result = await supabase
    .from('cases')
    .insert(data)
    .select()
    .single();

  return handleError(result);
}

export async function updateCase(
  id: string,
  data: CaseUpdate,
): Promise<Case> {
  const result = await supabase
    .from('cases')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  return handleError(result);
}

export async function deleteCase(id: string): Promise<void> {
  const result = await supabase
    .from('cases')
    .delete()
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export type ClientOption = Pick<Client, 'id' | 'full_name'>;

export async function getClientOptions(): Promise<ClientOption[]> {
  const result = await supabase
    .from('clients')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  return handleError(result);
}

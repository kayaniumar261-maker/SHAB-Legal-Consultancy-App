import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Client } from '../types/client';

export type ClientInsert = Omit<
  Client,
  'id' | 'created_at' | 'updated_at'
>;

export type ClientUpdate = Partial<ClientInsert>;

export type ClientFilterOptions = {
  search?: string;
  status?: Client['status'] | 'all';
  clientType?: Client['client_type'] | 'all';
  page?: number;
  pageSize?: number;
};

export type ClientListResult = {
  data: Client[];
  count: number;
};

function handleError<T>(result: {
  error: PostgrestError | null;
  data: T | null;
}) {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return result.data;
}

export async function getClients(
  options: ClientFilterOptions = {},
): Promise<ClientListResult> {
  const {
    search,
    status = 'all',
    clientType = 'all',
    page = 1,
    pageSize = 12,
  } = options;

  const query = supabase
    .from('clients')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query.eq('status', status);
  }

  if (clientType !== 'all') {
    query.eq('client_type', clientType);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query.or(
      `full_name.ilike.${term},email.ilike.${term},phone.ilike.${term},company_name.ilike.${term},emirates_id.ilike.${term},passport_number.ilike.${term}`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const result = await query.range(from, to);

  const data = handleError(result);
  return {
    data,
    count: result.count ?? 0,
  };
}

export async function getClientById(
  id: string,
): Promise<Client | null> {
  const result = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (result.error) {
    if (result.error.code === 'PGRST116') {
      return null;
    }

    throw new Error(result.error.message);
  }

  return result.data;
}

export async function createClient(
  data: ClientInsert,
): Promise<Client> {
  const result = await supabase
    .from('clients')
    .insert(data)
    .select()
    .single();

  return handleError(result);
}

export async function updateClient(
  id: string,
  data: ClientUpdate,
): Promise<Client> {
  const result = await supabase
    .from('clients')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  return handleError(result);
}

export async function deleteClient(
  id: string,
): Promise<void> {
  const result = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

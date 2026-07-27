import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Client } from '../types/client';

export type ClientRiskLevel = 'low' | 'medium' | 'high';

export type ClientOverview = Client & {
  client_code?: string | null;
  legacy_client_id?: string | null;
  contact_person?: string | null;
  whatsapp?: string | null;
  secondary_phone?: string | null;
  secondary_email?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  emirate?: string | null;
  city?: string | null;
  area?: string | null;
  postal_address?: string | null;
  vat_number?: string | null;
  client_since?: string | null;
  source?: string | null;
  assigned_lawyer_id?: string | null;
  assigned_case_manager_id?: string | null;
  risk_level?: ClientRiskLevel | null;
  is_vip?: boolean | null;
  vip?: boolean | null;
  is_blacklisted?: boolean | null;
  preferred_language?: string | null;
  preferred_contact_method?: string | null;
  next_follow_up_at?: string | null;
  marketing_consent?: boolean | null;
  imported_from?: string | null;
  imported_at?: string | null;
  total_cases?: number | null;
  active_cases?: number | null;
  closed_cases?: number | null;
  total_hearings?: number | null;
  total_documents?: number | null;
  total_fees?: number | string | null;
  total_paid?: number | string | null;
  outstanding_balance?: number | string | null;
};

export type ClientInsert = Omit<
  Client,
  'id' | 'created_at' | 'updated_at'
> &
  Partial<
    Pick<
      ClientOverview,
      | 'legacy_client_id'
      | 'contact_person'
      | 'whatsapp'
      | 'secondary_phone'
      | 'secondary_email'
      | 'date_of_birth'
      | 'gender'
      | 'country'
      | 'emirate'
      | 'city'
      | 'area'
      | 'postal_address'
      | 'vat_number'
      | 'client_since'
      | 'source'
      | 'assigned_lawyer_id'
      | 'assigned_case_manager_id'
      | 'risk_level'
      | 'is_vip'
      | 'is_blacklisted'
      | 'preferred_language'
      | 'preferred_contact_method'
      | 'next_follow_up_at'
      | 'marketing_consent'
      | 'imported_from'
      | 'imported_at'
    >
  >;

export type ClientUpdate = Partial<ClientInsert>;

export type ClientFilterOptions = {
  search?: string;
  status?: Client['status'] | 'all';
  clientType?: Client['client_type'] | 'all';
  page?: number;
  pageSize?: number;
  sortBy?:
    | 'created_at'
    | 'updated_at'
    | 'full_name'
    | 'client_code'
    | 'outstanding_balance'
    | 'total_cases';
  sortDirection?: 'asc' | 'desc';
};

export type ClientListResult = {
  data: ClientOverview[];
  count: number;
};

type SupabaseResult<T> = {
  error: PostgrestError | null;
  data: T | null;
};

function handleError<T>(
  result: SupabaseResult<T>,
  fallbackMessage = 'No data returned from Supabase.',
): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error(fallbackMessage);
  }

  return result.data;
}

function escapeSearchTerm(value: string): string {
  return value
    .replace(/[%_]/g, (match) => `\\${match}`)
    .replace(/,/g, '\\,');
}

function normalizePage(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function normalizePageSize(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return 12;
  }

  return Math.min(100, Math.max(1, Math.floor(value)));
}

export async function getClients(
  options: ClientFilterOptions = {},
): Promise<ClientListResult> {
  const {
    search,
    status = 'all',
    clientType = 'all',
    sortBy = 'created_at',
    sortDirection = 'desc',
  } = options;

  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);

  let query = supabase
    .from('client_overview')
    .select('*', { count: 'exact' });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (clientType !== 'all') {
    query = query.eq('client_type', clientType);
  }

  const trimmedSearch = search?.trim();

  if (trimmedSearch) {
    const term = `%${escapeSearchTerm(trimmedSearch)}%`;

    query = query.or(
      [
        `client_code.ilike.${term}`,
        `legacy_client_id.ilike.${term}`,
        `full_name.ilike.${term}`,
        `company_name.ilike.${term}`,
        `contact_person.ilike.${term}`,
        `email.ilike.${term}`,
        `secondary_email.ilike.${term}`,
        `phone.ilike.${term}`,
        `whatsapp.ilike.${term}`,
        `secondary_phone.ilike.${term}`,
        `emirates_id.ilike.${term}`,
        `passport_number.ilike.${term}`,
        `trade_license_number.ilike.${term}`,
      ].join(','),
    );
  }

  query = query.order(sortBy, {
    ascending: sortDirection === 'asc',
    nullsFirst: false,
  });

  if (sortBy !== 'created_at') {
    query = query.order('created_at', {
      ascending: false,
      nullsFirst: false,
    });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const result = await query.range(from, to);
  const data = handleError(
    result as SupabaseResult<ClientOverview[]>,
    'Unable to load clients.',
  );

  return {
    data: data.map((client) => ({
      ...client,
      vip: client.is_vip ?? client.vip ?? false,
      total_cases: Number(client.total_cases ?? 0),
      active_cases: Number(client.active_cases ?? 0),
      closed_cases: Number(client.closed_cases ?? 0),
      total_hearings: Number(client.total_hearings ?? 0),
      total_documents: Number(client.total_documents ?? 0),
      total_fees: Number(client.total_fees ?? 0),
      total_paid: Number(client.total_paid ?? 0),
      outstanding_balance: Number(client.outstanding_balance ?? 0),
    })),
    count: result.count ?? 0,
  };
}

export async function getClientById(
  id: string,
): Promise<ClientOverview | null> {
  const result = await supabase
    .from('client_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return null;
  }

  const client = result.data as ClientOverview;

  return {
    ...client,
    vip: client.is_vip ?? client.vip ?? false,
    total_cases: Number(client.total_cases ?? 0),
    active_cases: Number(client.active_cases ?? 0),
    closed_cases: Number(client.closed_cases ?? 0),
    total_hearings: Number(client.total_hearings ?? 0),
    total_documents: Number(client.total_documents ?? 0),
    total_fees: Number(client.total_fees ?? 0),
    total_paid: Number(client.total_paid ?? 0),
    outstanding_balance: Number(client.outstanding_balance ?? 0),
  };
}

export async function createClient(
  data: ClientInsert,
): Promise<Client> {
  const result = await supabase
    .from('clients')
    .insert(data)
    .select('*')
    .single();

  return handleError(
    result as SupabaseResult<Client>,
    'Unable to create client.',
  );
}

export async function updateClient(
  id: string,
  data: ClientUpdate,
): Promise<Client> {
  const result = await supabase
    .from('clients')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  return handleError(
    result as SupabaseResult<Client>,
    'Unable to update client.',
  );
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
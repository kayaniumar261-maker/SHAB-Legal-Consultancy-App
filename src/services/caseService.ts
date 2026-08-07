import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { getCaseFinanceSummaries } from './financeSummaryService';
import type { Client } from '../types/client';
import type {
  Case,
  CaseActivity,
  CaseActivityInsert,
  CaseFilterOptions,
  CaseInsert,
  CaseListResult,
  CaseNote,
  CaseNoteInsert,
  CaseStatusHistory,
  CaseUpdate,
  CaseWithRelations,
} from '../types/case';

type SupabaseResult<T> = {
  error: PostgrestError | null;
  data: T | null;
};

function handleError<T>(result: SupabaseResult<T>): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return result.data;
}

function normalizeCase(record: CaseWithRelations): CaseWithRelations {
  const numericFields: Array<keyof Case> = [
    'case_value',
    'claim_amount',
    'settlement_amount',
    'judgment_amount',
    'recovered_amount',
    'professional_fees',
    'court_fees',
    'expert_fees',
    'execution_fees',
    'other_expenses',
    'total_billed',
    'total_paid',
    'outstanding_balance',
    'success_fee_percentage',
    'completion_percentage',
  ];

  const normalized = { ...record } as CaseWithRelations;

  numericFields.forEach((field) => {
    const value = normalized[field];

    if (value !== null && value !== undefined) {
      (normalized as unknown as Record<string, unknown>)[field] = Number(value);
    }
  });

  return normalized;
}

const caseRelationsSelect = `
  *,
  client:clients!cases_client_id_fkey(
    id,
    full_name,
    email,
    phone
  ),
  assigned_staff:staff!cases_assigned_staff_id_fkey(
    id,
    full_name,
    email
  ),
  responsible_lawyer:staff!cases_responsible_lawyer_id_fkey(
    id,
    full_name,
    email
  ),
  case_manager:staff!cases_case_manager_id_fkey(
    id,
    full_name,
    email
  ),
  legal_assistant:staff!cases_legal_assistant_id_fkey(
    id,
    full_name,
    email
  )
`;

export async function getCases(
  options: CaseFilterOptions = {},
): Promise<CaseListResult & { data: CaseWithRelations[] }> {
  const {
    search,
    status = 'all',
    priority = 'all',
    riskLevel = 'all',
    clientId = 'all',
    assignedStaffId = 'all',
    caseType = 'all',
    court = 'all',
    isArchived = false,
    requiresUrgentAction,
    sortBy = 'filing_date',
    sortOrder = 'desc',
    page = 1,
    pageSize = 12,
  } = options;

  const normalizedPage = Math.max(1, page);
  const normalizedPageSize = Math.max(1, pageSize);

  const query = supabase
    .from('cases')
    .select(caseRelationsSelect, { count: 'exact' });

  if (status !== 'all') {
    query.eq('status', status);
  }

  if (priority !== 'all') {
    query.eq('priority', priority);
  }

  if (riskLevel !== 'all') {
    query.eq('risk_level', riskLevel);
  }

  if (clientId !== 'all') {
    query.eq('client_id', clientId);
  }

  if (assignedStaffId !== 'all') {
    query.or(
      [
        `assigned_staff_id.eq.${assignedStaffId}`,
        `responsible_lawyer_id.eq.${assignedStaffId}`,
        `case_manager_id.eq.${assignedStaffId}`,
        `legal_assistant_id.eq.${assignedStaffId}`,
      ].join(','),
    );
  }

  if (caseType !== 'all') {
    query.ilike('case_type', `%${caseType}%`);
  }

  if (court !== 'all') {
    query.ilike('court', `%${court}%`);
  }

  query.eq('is_archived', isArchived);

  if (typeof requiresUrgentAction === 'boolean') {
    query.eq('requires_urgent_action', requiresUrgentAction);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;

    query.or(
      [
        `case_number.ilike.${term}`,
        `matter_number.ilike.${term}`,
        `legacy_case_number.ilike.${term}`,
        `external_reference.ilike.${term}`,
        `file_reference.ilike.${term}`,
        `case_type.ilike.${term}`,
        `practice_area.ilike.${term}`,
        `case_category.ilike.${term}`,
        `case_stage.ilike.${term}`,
        `court.ilike.${term}`,
        `court_case_number.ilike.${term}`,
        `police_case_number.ilike.${term}`,
        `prosecution_number.ilike.${term}`,
        `execution_number.ilike.${term}`,
        `appeal_number.ilike.${term}`,
        `cassation_number.ilike.${term}`,
        `opponent_name.ilike.${term}`,
        `opponent_company.ilike.${term}`,
        `opponent_lawyer.ilike.${term}`,
        `opponent_law_firm.ilike.${term}`,
        `assigned_lawyer.ilike.${term}`,
        `description.ilike.${term}`,
        `facts_summary.ilike.${term}`,
        `internal_notes.ilike.${term}`,
      ].join(','),
    );
  }

  query.order(sortBy, {
    ascending: sortOrder === 'asc',
    nullsFirst: false,
  });

  const from = (normalizedPage - 1) * normalizedPageSize;
  const to = from + normalizedPageSize - 1;

  const result = await query.range(from, to);

  if (result.error) {
    throw new Error(result.error.message);
  }

  const data = (result.data ?? []) as unknown as CaseWithRelations[];

  return {
    data: data.map(normalizeCase),
    count: result.count ?? 0,
  };
}

export async function getCaseById(
  id: string,
): Promise<CaseWithRelations | null> {
  const result = await supabase
    .from('cases')
    .select(caseRelationsSelect)
    .eq('id', id)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data) {
    return null;
  }

  return normalizeCase(result.data as unknown as CaseWithRelations);
}

export async function createCase(data: CaseInsert): Promise<Case> {
  const result = await supabase
    .from('cases')
    .insert(data)
    .select()
    .single();

  return normalizeCase(
    handleError(result) as unknown as CaseWithRelations,
  );
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

  return normalizeCase(
    handleError(result) as unknown as CaseWithRelations,
  );
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

export type StaffOption = {
  id: string;
  full_name: string;
};

export async function getStaffOptions(): Promise<StaffOption[]> {
  const result = await supabase
    .from('staff')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  return handleError(result);
}

export type CaseDashboardStats = {
  total: number;
  active: number;
  inCourt: number;
  appeals: number;
  urgent: number;
  upcomingHearings: number;
  overdueActions: number;
  totalClaimValue: number;
  recoveredAmount: number;
  outstandingBalance: number;
};

export async function getCaseDashboardStats(
  clientId?: string,
): Promise<CaseDashboardStats> {
  let query = supabase
    .from('cases')
    .select(
      `
        id,
        status,
        priority,
        requires_urgent_action,
        next_hearing_at,
        next_action_at,
        claim_amount,
        recovered_amount
      `,
    )
    .eq('is_archived', false);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  const records = result.data ?? [];
  const financeSummaries = await getCaseFinanceSummaries(
    records.map((record) => String(record.id)),
  );
  const now = new Date();
  const upcomingLimit = new Date(now);
  upcomingLimit.setDate(upcomingLimit.getDate() + 30);

  return records.reduce<CaseDashboardStats>(
    (stats, record) => {
      const status = String(record.status ?? '').toLowerCase();
      const priority = String(record.priority ?? '').toLowerCase();

      stats.total += 1;

      if (!['closed'].includes(status)) {
        stats.active += 1;
      }

      if (status === 'in_court' || status === 'in court') {
        stats.inCourt += 1;
      }

      if (status === 'appeal') {
        stats.appeals += 1;
      }

      if (
        priority === 'urgent' ||
        Boolean(record.requires_urgent_action)
      ) {
        stats.urgent += 1;
      }

      if (record.next_hearing_at) {
        const nextHearing = new Date(record.next_hearing_at);

        if (
          !Number.isNaN(nextHearing.getTime()) &&
          nextHearing >= now &&
          nextHearing <= upcomingLimit
        ) {
          stats.upcomingHearings += 1;
        }
      }

      if (record.next_action_at) {
        const nextAction = new Date(record.next_action_at);

        if (
          !Number.isNaN(nextAction.getTime()) &&
          nextAction < now &&
          status !== 'closed'
        ) {
          stats.overdueActions += 1;
        }
      }

      stats.totalClaimValue += Number(record.claim_amount ?? 0);
      stats.recoveredAmount += Number(record.recovered_amount ?? 0);
      const finance = financeSummaries[String(record.id)];

      if (finance && !finance.hasMixedCurrencies) {
        stats.outstandingBalance += finance.outstanding;
      }

      return stats;
    },
    {
      total: 0,
      active: 0,
      inCourt: 0,
      appeals: 0,
      urgent: 0,
      upcomingHearings: 0,
      overdueActions: 0,
      totalClaimValue: 0,
      recoveredAmount: 0,
      outstandingBalance: 0,
    },
  );
}

export async function getCaseActivities(
  caseId: string,
): Promise<CaseActivity[]> {
  const result = await supabase
    .from('case_activities')
    .select('*')
    .eq('case_id', caseId)
    .order('activity_at', { ascending: false });

  return handleError(result);
}

export async function createCaseActivity(
  data: CaseActivityInsert,
): Promise<CaseActivity> {
  const result = await supabase
    .from('case_activities')
    .insert(data)
    .select()
    .single();

  return handleError(result);
}

export async function getCaseStatusHistory(
  caseId: string,
): Promise<CaseStatusHistory[]> {
  const result = await supabase
    .from('case_status_history')
    .select('*')
    .eq('case_id', caseId)
    .order('changed_at', { ascending: false });

  return handleError(result);
}

export async function getCaseNotes(
  caseId: string,
): Promise<CaseNote[]> {
  const result = await supabase
    .from('case_notes')
    .select('*')
    .eq('case_id', caseId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  return handleError(result);
}

export async function createCaseNote(
  data: CaseNoteInsert,
): Promise<CaseNote> {
  const result = await supabase
    .from('case_notes')
    .insert(data)
    .select()
    .single();

  return handleError(result);
}

export async function updateCaseNote(
  id: string,
  data: Partial<Pick<CaseNote, 'note' | 'is_private' | 'is_pinned'>>,
): Promise<CaseNote> {
  const result = await supabase
    .from('case_notes')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  return handleError(result);
}

export async function deleteCaseNote(id: string): Promise<void> {
  const result = await supabase
    .from('case_notes')
    .delete()
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type {
  Hearing,
  HearingInsert,
  HearingUpdate,
  HearingFilterOptions,
} from '../types/hearing';

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

function normaliseStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? null;
}

/* =========================================================
   DASHBOARD TYPES
========================================================= */

export type DashboardHearing = {
  id: string;
  hearing_at: string;
  court: string | null;
  courtroom: string | null;
  status: string | null;
  notes: string | null;
  case_id: string | null;
  case_number: string | null;
  case_type: string | null;
  client_name: string | null;
};

/* =========================================================
   MAIN HEARINGS LIST
========================================================= */

export async function getHearings(
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    filters?: HearingFilterOptions;
  } = {},
): Promise<{
  data: Hearing[];
  count: number;
}> {
  const {
    page = 1,
    pageSize = 12,
    search = '',
    filters = {},
  } = options;

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
      {
        count: 'exact',
      },
    );

  if (filters.status) {
    query = query.eq(
      'status',
      normaliseStatus(filters.status),
    );
  }

  if (filters.hearing_type) {
    query = query.eq(
      'hearing_type',
      filters.hearing_type,
    );
  }

  if (filters.assigned_staff_id) {
    query = query.eq(
      'assigned_staff_id',
      filters.assigned_staff_id,
    );
  }

  if (filters.startDate) {
    query = query.gte(
      'hearing_at',
      filters.startDate,
    );
  }

  if (filters.endDate) {
    query = query.lte(
      'hearing_at',
      filters.endDate,
    );
  }

  if (search.trim()) {
    const term = search
      .trim()
      .replace(/,/g, '');

    query = query.or(
      `title.ilike.%${term}%,court.ilike.%${term}%,courtroom.ilike.%${term}%,location.ilike.%${term}%`,
    );
  }

  const result = await query
    .order('hearing_at', {
      ascending: true,
    })
    .range(from, to);

  const data = handleError(result);

  return {
    data: data as Hearing[],
    count: result.count ?? 0,
  };
}

/* =========================================================
   SINGLE HEARING
========================================================= */

export async function getHearingById(
  id: string,
): Promise<Hearing | null> {
  const result = await supabase
    .from('hearings')
    .select('*')
    .eq('id', id)
    .single();

  if (result.error) {
    if (result.error.code === 'PGRST116') {
      return null;
    }

    throw new Error(result.error.message);
  }

  return result.data as Hearing;
}

/* =========================================================
   HEARINGS BY CASE
========================================================= */

export async function getHearingsByCase(
  caseId: string,
): Promise<Hearing[]> {
  const result = await supabase
    .from('hearings')
    .select('*')
    .eq('case_id', caseId)
    .order('hearing_at', {
      ascending: true,
    });

  return handleError(result) as Hearing[];
}

/* =========================================================
   HEARINGS TODAY
========================================================= */

export async function getHearingsToday(): Promise<
  Hearing[]
> {
  const start = new Date();

  start.setHours(
    0,
    0,
    0,
    0,
  );

  const end = new Date(start);

  end.setDate(
    end.getDate() + 1,
  );

  const result = await supabase
    .from('hearings')
    .select('*')
    .gte(
      'hearing_at',
      start.toISOString(),
    )
    .lt(
      'hearing_at',
      end.toISOString(),
    )
    .in('status', [
      'scheduled',
      'adjourned',
      'pending',
    ])
    .order('hearing_at', {
      ascending: true,
    });

  return handleError(result) as Hearing[];
}

/* =========================================================
   UPCOMING HEARINGS
========================================================= */

export async function getUpcomingHearings(
  limit = 5,
): Promise<DashboardHearing[]> {
  const now = new Date().toISOString();

  const result = await supabase
    .from('hearings')
    .select(`
      id,
      hearing_at,
      court,
      courtroom,
      status,
      notes,
      case_id,
      case:cases (
        case_number,
        case_type,
        client:clients (
          full_name
        )
      )
    `)
    .gte(
      'hearing_at',
      now,
    )
    .not(
      'status',
      'in',
      '("completed","cancelled")',
    )
    .order(
      'hearing_at',
      {
        ascending: true,
      },
    )
    .limit(limit);

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  return (
    result.data ?? []
  ).map((row: any) => ({
    id: row.id,
    hearing_at: row.hearing_at,
    court:
      row.court ?? null,
    courtroom:
      row.courtroom ?? null,
    status:
      row.status ?? null,
    notes:
      row.notes ?? null,
    case_id:
      row.case_id ?? null,
    case_number:
      row.case?.case_number ??
      null,
    case_type:
      row.case?.case_type ??
      null,
    client_name:
      row.case?.client?.full_name ??
      null,
  }));
}

/* =========================================================
   HEARINGS FOR MONTH
========================================================= */

export async function getHearingsForMonth(
  year: number,
  month: number,
): Promise<DashboardHearing[]> {
  const start = new Date(
    year,
    month,
    1,
  );

  const end = new Date(
    year,
    month + 1,
    1,
  );

  const result = await supabase
    .from('hearings')
    .select(`
      id,
      hearing_at,
      court,
      courtroom,
      status,
      notes,
      case_id,
      case:cases (
        case_number,
        case_type,
        client:clients (
          full_name
        )
      )
    `)
    .gte(
      'hearing_at',
      start.toISOString(),
    )
    .lt(
      'hearing_at',
      end.toISOString(),
    )
    .order(
      'hearing_at',
      {
        ascending: true,
      },
    );

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  return (
    result.data ?? []
  ).map((row: any) => ({
    id: row.id,
    hearing_at: row.hearing_at,
    court:
      row.court ?? null,
    courtroom:
      row.courtroom ?? null,
    status:
      row.status ?? null,
    notes:
      row.notes ?? null,
    case_id:
      row.case_id ?? null,
    case_number:
      row.case?.case_number ??
      null,
    case_type:
      row.case?.case_type ??
      null,
    client_name:
      row.case?.client?.full_name ??
      null,
  }));
}

/* =========================================================
   CREATE
========================================================= */

export async function createHearing(
  data: HearingInsert,
): Promise<Hearing> {
  const payload = {
    ...data,

    status: data.status
      ? normaliseStatus(data.status)
      : 'scheduled',
  };

  const result = await supabase
    .from('hearings')
    .insert(payload)
    .select()
    .single();

  return handleError(
    result,
  ) as Hearing;
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateHearing(
  id: string,
  data: HearingUpdate,
): Promise<Hearing> {
  const payload = {
    ...data,

    ...(data.status
      ? {
          status:
            normaliseStatus(
              data.status,
            ),
        }
      : {}),
  };

  const result = await supabase
    .from('hearings')
    .update(payload)
    .eq(
      'id',
      id,
    )
    .select()
    .single();

  return handleError(
    result,
  ) as Hearing;
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteHearing(
  id: string,
): Promise<void> {
  const result = await supabase
    .from('hearings')
    .delete()
    .eq(
      'id',
      id,
    );

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }
}

/* =========================================================
   STATUS ACTIONS
========================================================= */

export async function markHearingCompleted(
  id: string,
): Promise<Hearing> {
  return updateHearing(
    id,
    {
      status: 'Completed',
    },
  );
}

export async function markHearingAdjourned(
  id: string,
): Promise<Hearing> {
  return updateHearing(
    id,
    {
      status: 'Adjourned',
    },
  );
}

export async function markHearingCancelled(
  id: string,
): Promise<Hearing> {
  return updateHearing(
    id,
    {
      status: 'Cancelled',
    },
  );
}

/* =========================================================
   CASE OPTIONS
========================================================= */

export type HearingCaseOption = {
  id: string;
  case_number: string;
  client_name: string;
};

export async function getCaseOptions(): Promise<
  HearingCaseOption[]
> {
  const result = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      client:clients (
        full_name
      )
    `)
    .in(
      'status',
      [
        'open',
        'active',
        'pending',
      ],
    )
    .order(
      'case_number',
      {
        ascending: true,
      },
    );

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  return (
    result.data ?? []
  ).map((item: any) => ({
    id:
      item.id,

    case_number:
      item.case_number,

    client_name:
      item.client?.full_name ??
      'Unknown',
  }));
}

/* =========================================================
   STAFF OPTIONS
========================================================= */

export type HearingStaffOption = {
  id: string;
  full_name: string;
};

export async function getStaffOptions(): Promise<
  HearingStaffOption[]
> {
  const result = await supabase
    .from('staff')
    .select(
      'id, full_name',
    )
    .order(
      'full_name',
      {
        ascending: true,
      },
    );

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  return (
    result.data ?? []
  ) as HearingStaffOption[];
}
/* =========================================================
   HEARINGS BY CLIENT
========================================================= */

export type ClientHearing = {
  id: string;
  case_id: string | null;
  case_number: string | null;
  case_type: string | null;
  hearing_at: string;
  end_at: string | null;
  title: string | null;
  court: string | null;
  courtroom: string | null;
  location: string | null;
  hearing_type: string | null;
  status: string | null;
  outcome: string | null;
  notes: string | null;
  assigned_staff_name: string | null;
};

export async function getHearingsByClient(
  clientId: string,
): Promise<ClientHearing[]> {
  const result = await supabase
    .from('hearings')
    .select(`
      id,
      case_id,
      hearing_at,
      end_at,
      title,
      court,
      courtroom,
      location,
      hearing_type,
      status,
      outcome,
      notes,
      assigned_staff:staff (
        full_name
      ),
      case:cases!inner (
        id,
        client_id,
        case_number,
        case_type
      )
    `)
    .eq(
      'case.client_id',
      clientId,
    )
    .order(
      'hearing_at',
      {
        ascending: false,
      },
    );

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  return (
    result.data ?? []
  ).map((row: any) => ({
    id:
      row.id,

    case_id:
      row.case_id ?? null,

    case_number:
      row.case?.case_number ??
      null,

    case_type:
      row.case?.case_type ??
      null,

    hearing_at:
      row.hearing_at,

    end_at:
      row.end_at ?? null,

    title:
      row.title ?? null,

    court:
      row.court ?? null,

    courtroom:
      row.courtroom ?? null,

    location:
      row.location ?? null,

    hearing_type:
      row.hearing_type ?? null,

    status:
      row.status ?? null,

    outcome:
      row.outcome ?? null,

    notes:
      row.notes ?? null,

    assigned_staff_name:
      row.assigned_staff?.full_name ??
      null,
  }));
}
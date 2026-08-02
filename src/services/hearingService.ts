import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import {
  logCaseTimelineEvent,
  formatTimelineDate,
  formatTimelineLabel,
} from './caseTimelineService';


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
    caseId?: string;
    clientId?: string;
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
    caseId,
    clientId,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let clientCaseIds: string[] | null = null;

  if (clientId) {
    const caseResult = await supabase
      .from('cases')
      .select('id')
      .eq('client_id', clientId);

    if (caseResult.error) {
      throw new Error(
        caseResult.error.message,
      );
    }

    clientCaseIds = (
      caseResult.data ?? []
    ).map((record) => record.id);

    if (clientCaseIds.length === 0) {
      return {
        data: [],
        count: 0,
      };
    }
  }

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

  if (caseId) {
    query = query.eq(
      'case_id',
      caseId,
    );
  }

  if (
    clientCaseIds &&
    clientCaseIds.length > 0
  ) {
    query = query.in(
      'case_id',
      clientCaseIds,
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
   CASE HEARING SYNCHRONISATION

   The hearings table is the source of truth for hearing dates.
   Whenever a hearing changes, recalculate the parent case so
   Cases, Clients, Dashboard and other modules remain aligned.
========================================================= */

async function syncCaseHearingDates(caseId: string | null | undefined) {
  if (!caseId) return;

  const result = await supabase
    .from('hearings')
    .select('hearing_at, status')
    .eq('case_id', caseId)
    .order('hearing_at', {
      ascending: true,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const hearings = result.data ?? [];

  const validHearings = hearings.filter((hearing) => {
    if (!hearing.hearing_at) return false;

    const status = normaliseStatus(hearing.status);

    return status !== 'cancelled';
  });

  const firstHearing =
    validHearings.length > 0
      ? validHearings[0].hearing_at
      : null;

  const now = Date.now();

  const nextHearing =
    validHearings.find((hearing) => {
      const status = normaliseStatus(hearing.status);

      if (
        status === 'completed' ||
        status === 'cancelled'
      ) {
        return false;
      }

      const hearingTime = new Date(
        hearing.hearing_at,
      ).getTime();

      return (
        !Number.isNaN(hearingTime) &&
        hearingTime >= now
      );
    })?.hearing_at ?? null;

  const caseResult = await supabase
    .from('cases')
    .update({
      first_hearing_at: firstHearing,
      next_hearing_at: nextHearing,
    })
    .eq('id', caseId);

  if (caseResult.error) {
    throw new Error(caseResult.error.message);
  }
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

  const hearing = handleError(
    result,
  ) as Hearing;

  await syncCaseHearingDates(
    hearing.case_id,
  );

  await logCaseTimelineEvent({
    caseId: hearing.case_id,
    activityType: 'hearing_created',
    title: 'Hearing Scheduled',
    description: [
      hearing.title,
      hearing.hearing_at
        ? formatTimelineDate(
            hearing.hearing_at,
          )
        : null,
      hearing.court ?? null,
    ]
      .filter(Boolean)
      .join(' · '),
  });

  return hearing;
}


/* =========================================================
   UPDATE
========================================================= */

export async function updateHearing(
  id: string,
  data: HearingUpdate,
): Promise<Hearing> {
  /*
   * Read the old case before updating because the hearing may
   * be moved from one matter to another.
   */
  const existingResult = await supabase
    .from('hearings')
    .select('case_id')
    .eq('id', id)
    .single();

  if (existingResult.error) {
    throw new Error(
      existingResult.error.message,
    );
  }

  const previousCaseId =
    existingResult.data?.case_id ?? null;

  const payload = {
    ...data,

    ...(data.status
      ? {
          status: normaliseStatus(
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

  const hearing = handleError(
    result,
  ) as Hearing;

  /*
   * Sync the old case as well as the new one. This matters
   * when an existing hearing is reassigned to another matter.
   */
  if (
    previousCaseId &&
    previousCaseId !== hearing.case_id
  ) {
    await syncCaseHearingDates(
      previousCaseId,
    );
  }

  await syncCaseHearingDates(
    hearing.case_id,
  );

  await logCaseTimelineEvent({
    caseId: hearing.case_id,
    activityType: 'hearing_created',
    title: 'Hearing Scheduled',
    description: [
      hearing.title,
      hearing.hearing_at
        ? formatTimelineDate(
            hearing.hearing_at,
          )
        : null,
      hearing.court ?? null,
    ]
      .filter(Boolean)
      .join(' · '),
  });

    await logCaseTimelineEvent({
    caseId: hearing.case_id,
    activityType:
      String(hearing.status)
        .toLowerCase() === 'completed'
        ? 'hearing_completed'
        : 'hearing_updated',
    title:
      String(hearing.status)
        .toLowerCase() === 'completed'
        ? 'Hearing Completed'
        : 'Hearing Updated',
    description: [
      hearing.title,
      hearing.status
        ? formatTimelineLabel(
            hearing.status,
          )
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
  });

  return hearing;

}


/* =========================================================
   DELETE
========================================================= */

export async function deleteHearing(
  id: string,
): Promise<void> {
  /*
   * Capture the parent matter before deletion because the
   * deleted row will no longer be available afterwards.
   */
  const existingResult = await supabase
    .from('hearings')
    .select('case_id')
    .eq('id', id)
    .single();

  if (existingResult.error) {
    throw new Error(
      existingResult.error.message,
    );
  }

  const caseId =
    existingResult.data?.case_id ?? null;

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

  await syncCaseHearingDates(
    caseId,
  );

  await logCaseTimelineEvent({
    caseId,
    activityType: 'hearing_deleted',
    title: 'Hearing Removed',
    description:
      'A hearing was removed from this matter.',
  });
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
  client_id: string;
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
      client_id,
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

    client_id:
      item.client_id,

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
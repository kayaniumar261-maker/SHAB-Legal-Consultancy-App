import { supabase } from '../lib/supabase';

export type CalendarEventType =
  | 'hearing'
  | 'task'
  | 'invoice'
  | 'case_action'
  | 'limitation'
  | 'follow_up';

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string | null;
  priority: string | null;
  clientId: string | null;
  caseId: string | null;
  hearingId: string | null;
  taskId: string | null;
  invoiceId: string | null;
  caseNumber: string | null;
  clientName: string | null;
  location: string | null;
  amount: number | null;
  currency: string | null;
  description: string | null;
  href: string;
};

type CalendarRange = {
  start: string;
  end: string;
};

type HearingRow = {
  id: string;
  case_id: string | null;
  title: string | null;
  hearing_at: string;
  end_at: string | null;
  court: string | null;
  courtroom: string | null;
  location: string | null;
  status: string | null;
  hearing_type: string | null;
};

type TaskRow = {
  id: string;
  case_id: string | null;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_at: string | null;
};

type InvoiceRow = {
  id: string;
  client_id: string;
  case_id: string | null;
  invoice_number: string;
  due_date: string | null;
  status: string | null;
  balance_amount: number | string | null;
  currency: string | null;
  description: string | null;
};

type CaseRow = {
  id: string;
  client_id: string | null;
  case_number: string | null;
  case_type: string | null;
  status: string | null;
  priority: string | null;
  next_action_at: string | null;
  limitation_date: string | null;
  next_follow_up_at: string | null;
};

type ClientRow = {
  id: string;
  full_name: string | null;
};

function getMonthRange(
  year: number,
  monthIndex: number,
): CalendarRange {
  const startDate = new Date(
    year,
    monthIndex,
    1,
  );

  const endDate = new Date(
    year,
    monthIndex + 1,
    1,
  );

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

function toDateOnlyIso(
  value: string,
): string {
  if (value.includes('T')) {
    return value;
  }

  return `${value}T09:00:00.000Z`;
}

function createCaseMap(
  rows: CaseRow[],
): Map<string, CaseRow> {
  return new Map(
    rows.map((row) => [
      row.id,
      row,
    ]),
  );
}

function createClientMap(
  rows: ClientRow[],
): Map<string, ClientRow> {
  return new Map(
    rows.map((row) => [
      row.id,
      row,
    ]),
  );
}

function getCaseNumber(
  caseId: string | null,
  caseMap: Map<string, CaseRow>,
): string | null {
  if (!caseId) {
    return null;
  }

  const row = caseMap.get(caseId);

  return (
    row?.case_number ??
    row?.case_type ??
    null
  );
}

function getClientName(
  clientId: string | null,
  clientMap: Map<string, ClientRow>,
): string | null {
  if (!clientId) {
    return null;
  }

  return (
    clientMap.get(clientId)
      ?.full_name ??
    null
  );
}

export async function getCalendarEventsForMonth(
  year: number,
  monthIndex: number,
  includeFinancial = false,
): Promise<CalendarEvent[]> {
  const range =
    getMonthRange(
      year,
      monthIndex,
    );

  const [
    hearingsResult,
    tasksResult,
    invoicesResult,
    casesResult,
    clientsResult,
  ] = await Promise.all([
    supabase
      .from('hearings')
      .select(`
        id,
        case_id,
        title,
        hearing_at,
        end_at,
        court,
        courtroom,
        location,
        status,
        hearing_type
      `)
      .gte(
        'hearing_at',
        range.start,
      )
      .lt(
        'hearing_at',
        range.end,
      )
      .order(
        'hearing_at',
        {
          ascending: true,
        },
      ),

    supabase
      .from('tasks')
      .select(`
        id,
        case_id,
        client_id,
        title,
        description,
        status,
        priority,
        due_at
      `)
      .not(
        'due_at',
        'is',
        null,
      )
      .gte(
        'due_at',
        range.start,
      )
      .lt(
        'due_at',
        range.end,
      )
      .order(
        'due_at',
        {
          ascending: true,
        },
      ),

    includeFinancial
      ? supabase
          .from('invoices')
      .select(`
        id,
        client_id,
        case_id,
        invoice_number,
        due_date,
        status,
        balance_amount,
        currency,
        description
      `)
      .not(
        'due_date',
        'is',
        null,
      )
      .gte(
        'due_date',
        range.start.slice(
          0,
          10,
        ),
      )
      .lt(
        'due_date',
        range.end.slice(
          0,
          10,
        ),
      )
          .order(
            'due_date',
            {
              ascending: true,
            },
          )
      : Promise.resolve({ data: [], error: null }),

    supabase
      .from('cases')
      .select(`
        id,
        client_id,
        case_number,
        case_type,
        status,
        priority,
        next_action_at,
        limitation_date,
        next_follow_up_at
      `),

    supabase
      .from('clients')
      .select(`
        id,
        full_name
      `),
  ]);

  const errors = [
    hearingsResult.error,
    tasksResult.error,
    invoicesResult.error,
    casesResult.error,
    clientsResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(
      errors
        .map((error) =>
          error?.message ??
          'Calendar query failed.',
        )
        .join(' | '),
    );
  }

  const hearings =
    (hearingsResult.data ??
      []) as HearingRow[];

  const tasks =
    (tasksResult.data ??
      []) as TaskRow[];

  const invoices =
    (invoicesResult.data ??
      []) as InvoiceRow[];

  const cases =
    (casesResult.data ??
      []) as CaseRow[];

  const clients =
    (clientsResult.data ??
      []) as ClientRow[];

  const caseMap =
    createCaseMap(cases);

  const clientMap =
    createClientMap(clients);

  const events: CalendarEvent[] =
    [];

  for (const hearing of hearings) {
    const relatedCase =
      hearing.case_id
        ? caseMap.get(
            hearing.case_id,
          )
        : undefined;

    const clientId =
      relatedCase?.client_id ??
      null;

    events.push({
      id: `hearing:${hearing.id}`,
      type: 'hearing',
      title:
        hearing.title ||
        hearing.hearing_type ||
        'Court Hearing',
      startsAt:
        hearing.hearing_at,
      endsAt:
        hearing.end_at,
      status:
        hearing.status,
      priority: null,
      clientId,
      caseId:
        hearing.case_id,
      hearingId:
        hearing.id,
      taskId: null,
      invoiceId: null,
      caseNumber:
        getCaseNumber(
          hearing.case_id,
          caseMap,
        ),
      clientName:
        getClientName(
          clientId,
          clientMap,
        ),
      location:
        [
          hearing.court,
          hearing.courtroom,
          hearing.location,
        ]
          .filter(Boolean)
          .join(' · ') ||
        null,
      amount: null,
      currency: null,
      description:
        hearing.hearing_type,
      href:
        `/hearings?hearingId=${hearing.id}`,
    });
  }

  for (const task of tasks) {
    if (!task.due_at) {
      continue;
    }

    const relatedCase =
      task.case_id
        ? caseMap.get(
            task.case_id,
          )
        : undefined;

    const clientId =
      task.client_id ??
      relatedCase?.client_id ??
      null;

    events.push({
      id: `task:${task.id}`,
      type: 'task',
      title: task.title,
      startsAt:
        task.due_at,
      endsAt: null,
      status:
        task.status,
      priority:
        task.priority,
      clientId,
      caseId:
        task.case_id,
      hearingId: null,
      taskId:
        task.id,
      invoiceId: null,
      caseNumber:
        getCaseNumber(
          task.case_id,
          caseMap,
        ),
      clientName:
        getClientName(
          clientId,
          clientMap,
        ),
      location: null,
      amount: null,
      currency: null,
      description:
        task.description,
      href:
        `/tasks?taskId=${task.id}`,
    });
  }

  for (const invoice of invoices) {
    if (!invoice.due_date) {
      continue;
    }

    events.push({
      id: `invoice:${invoice.id}`,
      type: 'invoice',
      title:
        `Invoice ${invoice.invoice_number} due`,
      startsAt:
        toDateOnlyIso(
          invoice.due_date,
        ),
      endsAt: null,
      status:
        invoice.status,
      priority:
        invoice.status ===
          'overdue'
          ? 'Urgent'
          : null,
      clientId:
        invoice.client_id,
      caseId:
        invoice.case_id,
      hearingId: null,
      taskId: null,
      invoiceId:
        invoice.id,
      caseNumber:
        getCaseNumber(
          invoice.case_id,
          caseMap,
        ),
      clientName:
        getClientName(
          invoice.client_id,
          clientMap,
        ),
      location: null,
      amount:
        Number(
          invoice.balance_amount ??
            0,
        ),
      currency:
        invoice.currency ??
        'AED',
      description:
        invoice.description,
      href:
        `/payments?tab=invoices&invoiceId=${invoice.id}`,
    });
  }

  for (const caseRecord of cases) {
    const common = {
      clientId:
        caseRecord.client_id,
      caseId:
        caseRecord.id,
      hearingId: null,
      taskId: null,
      invoiceId: null,
      caseNumber:
        caseRecord.case_number ??
        caseRecord.case_type ??
        null,
      clientName:
        getClientName(
          caseRecord.client_id,
          clientMap,
        ),
      location: null,
      amount: null,
      currency: null,
      status:
        caseRecord.status,
      priority:
        caseRecord.priority,
      href:
        `/cases/${caseRecord.id}`,
    };

    if (
      caseRecord.next_action_at &&
      caseRecord.next_action_at >=
        range.start &&
      caseRecord.next_action_at <
        range.end
    ) {
      events.push({
        id:
          `case-action:${caseRecord.id}`,
        type: 'case_action',
        title:
          `Next action — ${
            caseRecord.case_number ??
            caseRecord.case_type ??
            'Matter'
          }`,
        startsAt:
          caseRecord.next_action_at,
        endsAt: null,
        description:
          'Case next action deadline.',
        ...common,
      });
    }

    if (
      caseRecord.limitation_date
    ) {
      const startsAt =
        toDateOnlyIso(
          caseRecord.limitation_date,
        );

      if (
        startsAt >=
          range.start &&
        startsAt <
          range.end
      ) {
        events.push({
          id:
            `limitation:${caseRecord.id}`,
          type: 'limitation',
          title:
            `Limitation deadline — ${
              caseRecord.case_number ??
              caseRecord.case_type ??
              'Matter'
            }`,
          startsAt,
          endsAt: null,
          description:
            'Legal limitation deadline.',
          ...common,
        });
      }
    }

    if (
      caseRecord.next_follow_up_at &&
      caseRecord.next_follow_up_at >=
        range.start &&
      caseRecord.next_follow_up_at <
        range.end
    ) {
      events.push({
        id:
          `follow-up:${caseRecord.id}`,
        type: 'follow_up',
        title:
          `Case follow-up — ${
            caseRecord.case_number ??
            caseRecord.case_type ??
            'Matter'
          }`,
        startsAt:
          caseRecord.next_follow_up_at,
        endsAt: null,
        description:
          'Scheduled case follow-up.',
        ...common,
      });
    }
  }

  return events.sort(
    (a, b) =>
      new Date(
        a.startsAt,
      ).getTime() -
      new Date(
        b.startsAt,
      ).getTime(),
  );
}

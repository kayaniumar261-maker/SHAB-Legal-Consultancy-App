import { supabase } from '../lib/supabase';

export type GlobalSearchCategory =
  | 'Clients'
  | 'Cases'
  | 'Tasks'
  | 'Hearings'
  | 'Documents'
  | 'Invoices'
  | 'Staff';

export type GlobalSearchResult = {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle: string;
  meta?: string;
  to: string;
};

export type GlobalSearchResponse = {
  results: GlobalSearchResult[];
  errors: string[];
};

function sanitiseSearch(value: string): string {
  return value
    .trim()
    .replace(/[%_,]/g, ' ')
    .replace(/\s+/g, ' ');
}

export async function searchEverything(
  searchValue: string,
  limitPerCategory = 5,
): Promise<GlobalSearchResponse> {
  const search = sanitiseSearch(searchValue);

  if (search.length < 2) {
    return {
      results: [],
      errors: [],
    };
  }

  const term = `%${search}%`;

  const searches = await Promise.allSettled([
    supabase
      .from('clients')
      .select(`
        id,
        full_name,
        company_name,
        email
      `)
      .or(
        [
          `full_name.ilike.${term}`,
          `company_name.ilike.${term}`,
          `email.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),

    supabase
      .from('cases')
      .select(`
        id,
        case_number,
        matter_number,
        case_type,
        court_case_number
      `)
      .or(
        [
          `case_number.ilike.${term}`,
          `matter_number.ilike.${term}`,
          `case_type.ilike.${term}`,
          `court_case_number.ilike.${term}`,
          `opponent_name.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),

    supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        case_id
      `)
      .or(
        [
          `title.ilike.${term}`,
          `description.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),

    supabase
      .from('hearings')
      .select(`
        id,
        title,
        hearing_at,
        court,
        case_id
      `)
      .or(
        [
          `title.ilike.${term}`,
          `court.ilike.${term}`,
          `courtroom.ilike.${term}`,
          `location.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),

    supabase
      .from('documents')
      .select(`
        id,
        name,
        document_type,
        case_id
      `)
      .or(
        [
          `name.ilike.${term}`,
          `document_type.ilike.${term}`,
          `description.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),

    supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        status,
        total_amount,
        client_id,
        case_id
      `)
      .or(
        [
          `invoice_number.ilike.${term}`,
          `description.ilike.${term}`,
          `notes.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),

    supabase
      .from('staff')
      .select(`
        id,
        full_name,
        role,
        email
      `)
      .or(
        [
          `full_name.ilike.${term}`,
          `role.ilike.${term}`,
          `email.ilike.${term}`,
        ].join(','),
      )
      .limit(limitPerCategory),
  ]);

  const results: GlobalSearchResult[] = [];
  const errors: string[] = [];

  const [
    clientsResult,
    casesResult,
    tasksResult,
    hearingsResult,
    documentsResult,
    invoicesResult,
    staffResult,
  ] = searches;

  if (clientsResult.status === 'fulfilled') {
    if (clientsResult.value.error) {
      errors.push(clientsResult.value.error.message);
    } else {
      for (const client of clientsResult.value.data ?? []) {
        results.push({
          id: `client-${client.id}`,
          category: 'Clients',
          title:
            client.full_name ||
            client.company_name ||
            'Unnamed client',
          subtitle:
            client.company_name ||
            client.email ||
            'Client record',
          to: `/clients/${client.id}`,
        });
      }
    }
  } else {
    errors.push(String(clientsResult.reason));
  }

  if (casesResult.status === 'fulfilled') {
    if (casesResult.value.error) {
      errors.push(casesResult.value.error.message);
    } else {
      for (const caseRecord of casesResult.value.data ?? []) {
        results.push({
          id: `case-${caseRecord.id}`,
          category: 'Cases',
          title:
            caseRecord.matter_number ||
            caseRecord.case_number ||
            'Legal matter',
          subtitle:
            caseRecord.case_type ||
            caseRecord.court_case_number ||
            'Case record',
          to: `/cases/${caseRecord.id}`,
        });
      }
    }
  } else {
    errors.push(String(casesResult.reason));
  }

  if (tasksResult.status === 'fulfilled') {
    if (tasksResult.value.error) {
      errors.push(tasksResult.value.error.message);
    } else {
      for (const task of tasksResult.value.data ?? []) {
        results.push({
          id: `task-${task.id}`,
          category: 'Tasks',
          title: task.title,
          subtitle:
            task.description ||
            formatLabel(task.status) ||
            'Task',
          to: `/tasks?taskId=${task.id}`,
        });
      }
    }
  } else {
    errors.push(String(tasksResult.reason));
  }

  if (hearingsResult.status === 'fulfilled') {
    if (hearingsResult.value.error) {
      errors.push(hearingsResult.value.error.message);
    } else {
      for (const hearing of hearingsResult.value.data ?? []) {
        results.push({
          id: `hearing-${hearing.id}`,
          category: 'Hearings',
          title:
            hearing.title ||
            'Court hearing',
          subtitle:
            hearing.court ||
            formatDateTime(hearing.hearing_at),
          meta: formatDateTime(hearing.hearing_at),
          to: `/hearings?hearingId=${hearing.id}`,
        });
      }
    }
  } else {
    errors.push(String(hearingsResult.reason));
  }

  if (documentsResult.status === 'fulfilled') {
    if (documentsResult.value.error) {
      errors.push(documentsResult.value.error.message);
    } else {
      for (const documentRecord of documentsResult.value.data ?? []) {
        results.push({
          id: `document-${documentRecord.id}`,
          category: 'Documents',
          title: documentRecord.name,
          subtitle:
            documentRecord.document_type ||
            'Document',
          to: `/documents?documentId=${documentRecord.id}`,
        });
      }
    }
  } else {
    errors.push(String(documentsResult.reason));
  }

  if (invoicesResult.status === 'fulfilled') {
    if (invoicesResult.value.error) {
      errors.push(invoicesResult.value.error.message);
    } else {
      for (const invoice of invoicesResult.value.data ?? []) {
        results.push({
          id: `invoice-${invoice.id}`,
          category: 'Invoices',
          title: invoice.invoice_number,
          subtitle: formatLabel(invoice.status),
          meta: formatCurrency(invoice.total_amount),
          to: `/payments?tab=invoices&invoiceId=${invoice.id}`,
        });
      }
    }
  } else {
    errors.push(String(invoicesResult.reason));
  }

  if (staffResult.status === 'fulfilled') {
    if (staffResult.value.error) {
      errors.push(staffResult.value.error.message);
    } else {
      for (const member of staffResult.value.data ?? []) {
        results.push({
          id: `staff-${member.id}`,
          category: 'Staff',
          title: member.full_name,
          subtitle:
            formatLabel(member.role) ||
            member.email ||
            'Staff member',
          to: `/staff/${member.id}`,
        });
      }
    }
  } else {
    errors.push(String(staffResult.reason));
  }

  return {
    results,
    errors,
  };
}

function formatLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return 'Date not scheduled';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date not scheduled';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

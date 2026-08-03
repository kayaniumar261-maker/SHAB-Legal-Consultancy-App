import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type {
  Invoice,
  InvoiceInsert,
  InvoiceUpdate,
} from '../types/invoice';

function handleError<T>(result: {
  error: PostgrestError | null;
  data: T | null;
}): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error(
      'No data returned from Supabase.',
    );
  }

  return result.data;
}

export async function getInvoices(
  options: {
    status?: string;
    clientId?: string;
    caseId?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  data: Invoice[];
  count: number;
}> {
  const {
    page = 1,
    pageSize = 12,
    status,
    clientId,
    caseId,
  } = options;

  const from =
    (page - 1) * pageSize;

  const to =
    from + pageSize - 1;

  let query = supabase
    .from('invoices')
    .select('*', {
      count: 'exact',
    });

  if (status) {
    query =
      query.eq(
        'status',
        status,
      );
  }

  if (clientId) {
    query =
      query.eq(
        'client_id',
        clientId,
      );
  }

  if (caseId) {
    query =
      query.eq(
        'case_id',
        caseId,
      );
  }

  const result =
    await query
      .order(
        'issue_date',
        {
          ascending: false,
        },
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      )
      .range(
        from,
        to,
      );

  const data =
    handleError(
      result,
    ) as Invoice[];

  return {
    data,
    count:
      result.count ?? 0,
  };
}

export async function getOutstandingInvoicesAmount(): Promise<number> {
  const result =
    await supabase
      .from('invoices')
      .select(
        'balance_amount',
      )
      .in(
        'status',
        [
          'issued',
          'overdue',
          'partially_paid',
        ],
      );

  const rows =
    handleError(
      result,
    ) as Array<{
      balance_amount:
        | number
        | string
        | null;
    }>;

  return rows.reduce(
    (
      total,
      invoice,
    ) =>
      total +
      Number(
        invoice
          .balance_amount ??
          0,
      ),
    0,
  );
}


export type FinanceAgingSummary = {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
};

export type FinanceSummary = {
  invoiceCount: number;
  paidInvoiceCount: number;
  overdueInvoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  overdue: number;
  collectionRate: number;
  aging: FinanceAgingSummary;
};

type FinanceSummaryRow = {
  status: string | null;
  due_date: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  balance_amount: number | string | null;
};

export async function getFinanceSummary(
  options: {
    clientId?: string;
    caseId?: string;
  } = {},
): Promise<FinanceSummary> {
  let query = supabase
    .from('invoices')
    .select(`
      status,
      due_date,
      total_amount,
      paid_amount,
      balance_amount
    `);

  if (options.clientId) {
    query = query.eq(
      'client_id',
      options.clientId,
    );
  }

  if (options.caseId) {
    query = query.eq(
      'case_id',
      options.caseId,
    );
  }

  const result = await query;

  const rows = handleError(
    result,
  ) as FinanceSummaryRow[];

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0,
  );

  const summary: FinanceSummary = {
    invoiceCount: 0,
    paidInvoiceCount: 0,
    overdueInvoiceCount: 0,
    totalBilled: 0,
    totalPaid: 0,
    outstanding: 0,
    overdue: 0,
    collectionRate: 0,
    aging: {
      current: 0,
      days1To30: 0,
      days31To60: 0,
      days61To90: 0,
      daysOver90: 0,
    },
  };

  for (const invoice of rows) {
    const status =
      invoice.status
        ?.trim()
        .toLowerCase() ??
      '';

    if (
      status === 'cancelled' ||
      status === 'written_off'
    ) {
      continue;
    }

    const totalAmount = Number(
      invoice.total_amount ?? 0,
    );

    const paidAmount = Number(
      invoice.paid_amount ?? 0,
    );

    const balanceAmount = Math.max(
      0,
      Number(
        invoice.balance_amount ?? 0,
      ),
    );

    summary.invoiceCount += 1;
    summary.totalBilled += totalAmount;
    summary.totalPaid += paidAmount;
    summary.outstanding += balanceAmount;

    if (
      status === 'paid' ||
      (
        totalAmount > 0 &&
        balanceAmount <= 0
      )
    ) {
      summary.paidInvoiceCount += 1;
    }

    if (
      balanceAmount <= 0
    ) {
      continue;
    }

    if (!invoice.due_date) {
      summary.aging.current +=
        balanceAmount;

      continue;
    }

    const dueDate = new Date(
      `${invoice.due_date}T00:00:00`,
    );

    if (
      Number.isNaN(
        dueDate.getTime(),
      )
    ) {
      summary.aging.current +=
        balanceAmount;

      continue;
    }

    const differenceInDays = Math.floor(
      (
        today.getTime() -
        dueDate.getTime()
      ) /
        86_400_000,
    );

    if (differenceInDays <= 0) {
      summary.aging.current +=
        balanceAmount;

      continue;
    }

    summary.overdueInvoiceCount += 1;
    summary.overdue += balanceAmount;

    if (differenceInDays <= 30) {
      summary.aging.days1To30 +=
        balanceAmount;
    } else if (
      differenceInDays <= 60
    ) {
      summary.aging.days31To60 +=
        balanceAmount;
    } else if (
      differenceInDays <= 90
    ) {
      summary.aging.days61To90 +=
        balanceAmount;
    } else {
      summary.aging.daysOver90 +=
        balanceAmount;
    }
  }

  summary.collectionRate =
    summary.totalBilled > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              summary.totalPaid /
              summary.totalBilled
            ) * 100,
          ),
        )
      : 0;

  return summary;
}

export async function createInvoice(
  data: InvoiceInsert,
): Promise<Invoice> {
  const payload = {
    ...data,

    amount:
      data.total_amount,
  };

  const result =
    await supabase
      .from('invoices')
      .insert(payload)
      .select()
      .single();

  return handleError(
    result,
  ) as Invoice;
}

export async function updateInvoice(
  id: string,
  data: InvoiceUpdate,
): Promise<Invoice> {
  const payload = {
    ...data,

    ...(data.total_amount !==
    undefined
      ? {
          amount:
            data.total_amount,
        }
      : {}),
  };

  const result =
    await supabase
      .from('invoices')
      .update(payload)
      .eq(
        'id',
        id,
      )
      .select()
      .single();

  return handleError(
    result,
  ) as Invoice;
}

export async function cancelInvoice(
  id: string,
  reason: string,
): Promise<Invoice> {
  const result = await supabase.rpc(
    'shab_cancel_invoice',
    {
      p_invoice_id: id,
      p_reason: reason,
    },
  );

  return handleError(result) as Invoice;
}

export async function deleteInvoice(
  id: string,
): Promise<void> {
  const result =
    await supabase
      .from('invoices')
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
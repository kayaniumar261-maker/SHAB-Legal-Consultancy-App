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
    throw new Error('No data returned from Supabase.');
  }

  return result.data;
}

export async function getInvoices(
  options: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ data: Invoice[]; count: number }> {
  const {
    page = 1,
    pageSize = 12,
    status,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  const result = await query
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const data = handleError(result) as Invoice[];

  return {
    data,
    count: result.count ?? 0,
  };
}

export async function getOutstandingInvoicesAmount(): Promise<number> {
  const result = await supabase
    .from('invoices')
    .select('balance_amount')
    .in('status', ['sent', 'overdue', 'partial']);

  const rows = handleError(result) as Array<{
    balance_amount: number | string | null;
  }>;

  return rows.reduce(
    (total, invoice) =>
      total + Number(invoice.balance_amount ?? 0),
    0
  );
}

export async function createInvoice(
  data: InvoiceInsert
): Promise<Invoice> {
  const payload = {
    ...data,
    amount: data.total_amount,
  };

  const result = await supabase
    .from('invoices')
    .insert(payload)
    .select()
    .single();

  return handleError(result) as Invoice;
}

export async function updateInvoice(
  id: string,
  data: InvoiceUpdate
): Promise<Invoice> {
  const payload = {
    ...data,
    ...(data.total_amount !== undefined
      ? { amount: data.total_amount }
      : {}),
  };

  const result = await supabase
    .from('invoices')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  return handleError(result) as Invoice;
}

export async function deleteInvoice(
  id: string
): Promise<void> {
  const result = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}
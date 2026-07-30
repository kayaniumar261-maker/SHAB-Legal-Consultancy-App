import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  Payment,
  PaymentInsert,
  PaymentUpdate,
} from '../types/payment';

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

export async function getPayments(
  options: {
    page?: number;
    pageSize?: number;
    status?: string;
    clientId?: string;
  } = {}
): Promise<{ data: Payment[]; count: number }> {
  const {
    page = 1,
    pageSize = 12,
    status,
    clientId,
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('payments')
    .select('*', { count: 'exact' });

  if (status) {
    query = query.eq('status', status);
  }

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const result = await query
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  const data = handleError(result) as Payment[];

  return {
    data,
    count: result.count ?? 0,
  };
}

export async function createPayment(
  data: PaymentInsert
): Promise<Payment> {
  const result = await supabase
    .from('payments')
    .insert(data)
    .select()
    .single();

  return handleError(result) as Payment;
}

export async function updatePayment(
  id: string,
  data: PaymentUpdate
): Promise<Payment> {
  const result = await supabase
    .from('payments')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  return handleError(result) as Payment;
}

export async function deletePayment(
  id: string
): Promise<void> {
  const result = await supabase
    .from('payments')
    .delete()
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function getRevenueForMonth(
  year: number,
  month: number
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

  const nextMonth =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const result = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'completed')
    .gte('payment_date', startDate)
    .lt('payment_date', nextMonth);

  const rows = handleError(result) as Array<{
    amount: number | string | null;
  }>;

  return rows.reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0
  );
}
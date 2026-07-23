import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Payment, PaymentInsert, PaymentUpdate } from '../types/payment';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getPayments(options: { page?: number; pageSize?: number } = {}): Promise<{ data: Payment[]; count: number }> {
  const { page = 1, pageSize = 12 } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const result = await supabase.from('payments').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  const data = handleError(result);
  return { data, count: result.count ?? 0 };
}

export async function createPayment(data: PaymentInsert): Promise<Payment> {
  const result = await supabase.from('payments').insert(data).select().single();
  return handleError(result);
}

export async function updatePayment(id: string, data: PaymentUpdate): Promise<Payment> {
  const result = await supabase.from('payments').update(data).eq('id', id).select().single();
  return handleError(result);
}

export async function deletePayment(id: string): Promise<void> {
  const result = await supabase.from('payments').delete().eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

export async function getRevenueForMonth(year: number, month: number): Promise<number> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 1).toISOString();
  const result = await supabase.from('payments').select('amount').gte('paid_at', start).lt('paid_at', end);
  const rows = handleError(result) as Payment[];
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0);
}

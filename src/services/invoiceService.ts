import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Invoice, InvoiceInsert, InvoiceUpdate } from '../types/invoice';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getInvoices(options: { status?: string; page?: number; pageSize?: number } = {}): Promise<{ data: Invoice[]; count: number }> {
  const { page = 1, pageSize = 12, status } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = supabase.from('invoices').select('*', { count: 'exact' }).order('issued_at', { ascending: false });
  if (status) query.eq('status', status);
  const result = await query.range(from, to);
  const data = handleError(result);
  return { data, count: result.count ?? 0 };
}

export async function getOutstandingInvoicesAmount(): Promise<number> {
  const result = await supabase.from('invoices').select('amount').in('status', ['sent', 'overdue', 'partial']);
  const rows = handleError(result) as Invoice[];
  return rows.reduce((s, r) => s + (r.amount ?? 0), 0);
}

export async function createInvoice(data: InvoiceInsert): Promise<Invoice> {
  const result = await supabase.from('invoices').insert(data).select().single();
  return handleError(result);
}

export async function updateInvoice(id: string, data: InvoiceUpdate): Promise<Invoice> {
  const result = await supabase.from('invoices').update(data).eq('id', id).select().single();
  return handleError(result);
}

export async function deleteInvoice(id: string): Promise<void> {
  const result = await supabase.from('invoices').delete().eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

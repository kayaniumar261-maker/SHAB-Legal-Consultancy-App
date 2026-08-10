import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Invoice } from '../types/invoice';
import type {
  Expense,
  ExpenseActivity,
  ExpenseAttachment,
  ExpenseFilters,
  ExpenseInsert,
  ExpenseVendor,
  ExpenseVendorInsert,
  ExpenseStatus,
  ExpenseSummary,
  ExpenseUpdate,
  ExpenseWithRelations,
} from '../types/expense';

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No expense data returned from Supabase.');
  return result.data;
}

export async function getExpenses(filters: ExpenseFilters = {}): Promise<ExpenseWithRelations[]> {
  let query = supabase
    .from('expenses')
    .select(`
      *,
      client:clients(id, full_name),
      case:cases(id, case_number, matter_number),
      billed_invoice:invoices(id, invoice_number),
      vendor:expense_vendors(*)
    `)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.caseId) query = query.eq('case_id', filters.caseId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.expenseType) query = query.eq('expense_type', filters.expenseType);
  if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom);
  if (filters.dateTo) query = query.lte('expense_date', filters.dateTo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseWithRelations[];
}

export async function getVendorBills(): Promise<ExpenseWithRelations[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`*, client:clients(id, full_name), case:cases(id, case_number, matter_number), billed_invoice:invoices(id, invoice_number), vendor:expense_vendors(*)`)
    .not('vendor_id', 'is', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('expense_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseWithRelations[];
}

export async function createExpense(input: ExpenseInsert): Promise<Expense> {
  return unwrap(
    await supabase.from('expenses').insert(input).select().single(),
  ) as Expense;
}

export async function updateExpense(id: string, input: ExpenseUpdate): Promise<Expense> {
  return unwrap(
    await supabase.from('expenses').update(input).eq('id', id).select().single(),
  ) as Expense;
}

export async function changeExpenseStatus(
  id: string,
  status: ExpenseStatus,
  reason?: string,
): Promise<Expense> {
  return unwrap(
    await supabase.rpc('shab_change_expense_status', {
      p_expense_id: id,
      p_status: status,
      p_reason: reason ?? null,
    }),
  ) as Expense;
}

export async function createInvoiceFromRecoverableExpense(
  expenseId: string,
  issueDate: string,
  dueDate: string,
): Promise<Invoice> {
  return unwrap(
    await supabase.rpc('shab_bill_recoverable_disbursement', {
      p_expense_id: expenseId,
      p_issue_date: issueDate,
      p_due_date: dueDate,
    }),
  ) as Invoice;
}

export async function getExpenseActivity(expenseId: string): Promise<ExpenseActivity[]> {
  const { data, error } = await supabase
    .from('expense_activity')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseActivity[];
}

export async function getExpenseAttachments(expenseId: string): Promise<ExpenseAttachment[]> {
  const { data, error } = await supabase
    .from('expense_attachments')
    .select('*')
    .eq('expense_id', expenseId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseAttachment[];
}

export async function uploadExpenseAttachment(expenseId: string, file: File): Promise<ExpenseAttachment> {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('Upload a PDF, JPG, PNG or WebP file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Supporting documents cannot exceed 10 MB.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
  const storagePath = `${expenseId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from('expense-documents').upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) throw new Error(upload.error.message);
  const result = await supabase.from('expense_attachments').insert({
    expense_id: expenseId,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    file_size: file.size,
  }).select().single();
  if (result.error) {
    await supabase.storage.from('expense-documents').remove([storagePath]);
    throw new Error(result.error.message);
  }
  return result.data as ExpenseAttachment;
}

export async function getExpenseAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('expense-documents').createSignedUrl(storagePath, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteExpenseAttachment(attachment: ExpenseAttachment): Promise<void> {
  const storage = await supabase.storage.from('expense-documents').remove([attachment.storage_path]);
  if (storage.error) throw new Error(storage.error.message);
  const metadata = await supabase.from('expense_attachments').delete().eq('id', attachment.id);
  if (metadata.error) throw new Error(metadata.error.message);
}

export function summarizeExpenses(expenses: ExpenseWithRelations[]): ExpenseSummary {
  const active = expenses.filter((expense) => expense.status !== 'void');
  const total = (rows: ExpenseWithRelations[]) =>
    rows.reduce((sum, expense) => sum + Number(expense.total_amount ?? 0), 0);

  return {
    count: active.length,
    totalExpenses: total(active),
    firmOverheads: total(active.filter((expense) => expense.expense_type === 'firm_overhead')),
    clientDisbursements: total(active.filter((expense) => expense.expense_type === 'client_disbursement')),
    recoverableUnbilled: total(active.filter((expense) =>
      expense.recoverable_from_client && expense.reimbursement_status === 'unbilled',
    )),
    informationalInputVat: active.reduce(
      (sum, expense) => sum + Number(expense.input_vat_amount ?? 0),
      0,
    ),
  };
}

export async function getExpenseVendors(includeInactive = false): Promise<ExpenseVendor[]> {
  let query = supabase.from('expense_vendors').select('*').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpenseVendor[];
}

export async function createExpenseVendor(input: ExpenseVendorInsert): Promise<ExpenseVendor> {
  return unwrap(await supabase.from('expense_vendors').insert(input).select().single()) as ExpenseVendor;
}

export async function updateExpenseVendor(id: string, input: Partial<ExpenseVendorInsert>): Promise<ExpenseVendor> {
  return unwrap(await supabase.from('expense_vendors').update(input).eq('id', id).select().single()) as ExpenseVendor;
}

export async function getExpenseClientOptions(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, full_name')
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((client) => ({ id: client.id, name: client.full_name }));
}

export async function getExpenseCaseOptions(clientId?: string): Promise<Array<{
  id: string;
  clientId: string;
  label: string;
}>> {
  let query = supabase
    .from('cases')
    .select('id, client_id, case_number, matter_number, case_type')
    .order('created_at', { ascending: false });
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((caseRecord) => ({
    id: caseRecord.id,
    clientId: caseRecord.client_id,
    label: caseRecord.matter_number ?? caseRecord.case_number ?? caseRecord.case_type ?? 'Legal matter',
  }));
}

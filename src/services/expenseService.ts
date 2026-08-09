import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type {
  Expense,
  ExpenseFilters,
  ExpenseInsert,
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
      billed_invoice:invoices(id, invoice_number)
    `)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

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

import { supabase } from '../lib/supabase';

export type PayablesBillLine = {
  id: string;
  date: string;
  expenseNumber: string;
  supplierInvoice: string | null;
  vendor: string;
  category: string;
  currency: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  status: string;
};

export type PayablesPaymentLine = {
  id: string;
  date: string;
  expenseNumber: string;
  supplierInvoice: string | null;
  vendor: string;
  currency: string;
  amount: number;
  method: string;
  reference: string;
};

export type AccountingPayablesReport = {
  dateFrom: string;
  dateTo: string;
  currency: string | null;
  hasMixedCurrencies: boolean;
  totalBills: number;
  firmOverheads: number;
  clientDisbursements: number;
  informationalInputVat: number;
  paymentsMade: number;
  outstanding: number;
  overdue: number;
  bills: PayablesBillLine[];
  payments: PayablesPaymentLine[];
};

export async function getAccountingPayablesReport(dateFrom: string, dateTo: string): Promise<AccountingPayablesReport> {
  if (!dateFrom || !dateTo || dateFrom > dateTo) throw new Error('Enter a valid payables reporting period.');
  const [billResult, paymentResult] = await Promise.all([
    supabase.from('expenses')
      .select('id,expense_number,expense_date,expense_type,category,vendor_name,supplier_invoice_number,due_date,currency,net_amount,input_vat_amount,total_amount,paid_amount,status,vendor:expense_vendors(name)')
      .not('vendor_id', 'is', null).neq('status', 'void')
      .gte('expense_date', dateFrom).lte('expense_date', dateTo)
      .order('expense_date', { ascending: true }),
    supabase.from('expense_vendor_payments')
      .select('id,payment_date,amount,payment_method,payment_reference,expense:expenses(expense_number,supplier_invoice_number,vendor_name,currency,vendor:expense_vendors(name))')
      .gte('payment_date', dateFrom).lte('payment_date', dateTo)
      .order('payment_date', { ascending: true }),
  ]);
  if (billResult.error) throw new Error(billResult.error.message);
  if (paymentResult.error) throw new Error(paymentResult.error.message);

  const bills: PayablesBillLine[] = (billResult.data ?? []).map((row) => {
    const vendor = row.vendor as unknown as { name?: string } | null;
    const total = Number(row.total_amount ?? 0);
    const paid = Number(row.paid_amount ?? 0);
    return {
      id: row.id, date: row.expense_date, expenseNumber: row.expense_number,
      supplierInvoice: row.supplier_invoice_number, vendor: vendor?.name || row.vendor_name || 'Unknown vendor',
      category: row.category, currency: row.currency, netAmount: Number(row.net_amount ?? 0),
      vatAmount: Number(row.input_vat_amount ?? 0), totalAmount: total, paidAmount: paid,
      balance: Math.max(0, total - paid), dueDate: row.due_date, status: row.status,
    };
  });
  const payments: PayablesPaymentLine[] = (paymentResult.data ?? []).map((row) => {
    const expense = row.expense as unknown as { expense_number?: string; supplier_invoice_number?: string | null; vendor_name?: string | null; currency?: string; vendor?: { name?: string } | null } | null;
    return {
      id: row.id, date: row.payment_date, expenseNumber: expense?.expense_number || 'Unknown expense',
      supplierInvoice: expense?.supplier_invoice_number ?? null,
      vendor: expense?.vendor?.name || expense?.vendor_name || 'Unknown vendor',
      currency: expense?.currency || 'AED', amount: Number(row.amount ?? 0),
      method: row.payment_method, reference: row.payment_reference,
    };
  });
  const currencies = new Set([...bills.map((row) => row.currency), ...payments.map((row) => row.currency)]);
  const today = localDateKey();
  const sumBills = (filter: (row: PayablesBillLine) => boolean, field: 'totalAmount' | 'vatAmount' | 'balance') => bills.filter(filter).reduce((sum, row) => sum + row[field], 0);
  return {
    dateFrom, dateTo, currency: currencies.size === 1 ? [...currencies][0] : currencies.size ? null : 'AED',
    hasMixedCurrencies: currencies.size > 1,
    totalBills: sumBills(() => true, 'totalAmount'),
    firmOverheads: sumBills((row) => row.category !== '' && (billResult.data ?? []).find((item) => item.id === row.id)?.expense_type === 'firm_overhead', 'totalAmount'),
    clientDisbursements: sumBills((row) => (billResult.data ?? []).find((item) => item.id === row.id)?.expense_type === 'client_disbursement', 'totalAmount'),
    informationalInputVat: sumBills(() => true, 'vatAmount'),
    paymentsMade: payments.reduce((sum, row) => sum + row.amount, 0),
    outstanding: sumBills(() => true, 'balance'),
    overdue: sumBills((row) => row.balance > 0 && Boolean(row.dueDate && row.dueDate < today), 'balance'),
    bills, payments,
  };
}

function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

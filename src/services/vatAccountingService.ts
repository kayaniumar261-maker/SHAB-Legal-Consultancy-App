import { supabase } from '../lib/supabase';
import type { AccountingPeriod, VatReport, VatReportLine, VatTreatment } from '../types/vatAccounting';

export async function updateTaxSettings(input: {
  vatRegistered: boolean;
  taxRegistrationNumber: string | null;
  defaultVatRate: number;
  vatEffectiveDate: string | null;
}) {
  const { data, error } = await supabase.rpc('shab_update_tax_settings', {
    p_vat_registered: input.vatRegistered,
    p_tax_registration_number: input.taxRegistrationNumber,
    p_default_vat_rate: input.defaultVatRate,
    p_vat_effective_date: input.vatEffectiveDate,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getAccountingPeriods(): Promise<AccountingPeriod[]> {
  const { data, error } = await supabase.from('accounting_periods').select('*').order('period_start', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AccountingPeriod[];
}

export async function saveAccountingPeriod(input: { periodStart: string; periodEnd: string }): Promise<AccountingPeriod> {
  const { data, error } = await supabase.rpc('shab_save_accounting_period', {
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
  });
  if (error) throw new Error(error.message);
  return data as AccountingPeriod;
}

export async function setAccountingPeriodLock(input: { periodId: string; locked: boolean; reason: string }): Promise<AccountingPeriod> {
  const { data, error } = await supabase.rpc('shab_set_accounting_period_lock', {
    p_period_id: input.periodId,
    p_locked: input.locked,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  return data as AccountingPeriod;
}

export async function getVatReport(dateFrom: string, dateTo: string): Promise<VatReport> {
  if (!dateFrom || !dateTo || dateFrom > dateTo) throw new Error('Enter a valid VAT reporting period.');
  const [invoiceResult, creditResult] = await Promise.all([
    supabase.from('invoices').select('id,invoice_number,client_id,currency,subtotal,vat_amount,total_amount,vat_treatment,supply_date,issue_date,status').gte('supply_date', dateFrom).lte('supply_date', dateTo),
    supabase.from('credit_notes').select('id,credit_note_number,client_id,currency,subtotal,vat_amount,total_amount,vat_treatment,tax_point_date,issue_date,status').gte('tax_point_date', dateFrom).lte('tax_point_date', dateTo),
  ]);
  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (creditResult.error) throw new Error(creditResult.error.message);
  const lines: VatReportLine[] = [];
  for (const row of invoiceResult.data ?? []) {
    if (['draft', 'cancelled', 'written_off'].includes(row.status)) continue;
    lines.push({ id: row.id, documentNumber: row.invoice_number, documentType: 'invoice', taxDate: row.supply_date || row.issue_date, clientId: row.client_id, currency: row.currency, treatment: row.vat_treatment as VatTreatment, taxableAmount: Number(row.subtotal), vatAmount: Number(row.vat_amount), totalAmount: Number(row.total_amount) });
  }
  for (const row of creditResult.data ?? []) {
    if (row.status !== 'issued') continue;
    lines.push({ id: row.id, documentNumber: row.credit_note_number, documentType: 'credit_note', taxDate: row.tax_point_date || row.issue_date, clientId: row.client_id, currency: row.currency, treatment: row.vat_treatment as VatTreatment, taxableAmount: Number(row.subtotal), vatAmount: Number(row.vat_amount), totalAmount: Number(row.total_amount) });
  }
  lines.sort((a, b) => a.taxDate.localeCompare(b.taxDate) || a.documentNumber.localeCompare(b.documentNumber));
  const invoices = lines.filter((line) => line.documentType === 'invoice');
  const credits = lines.filter((line) => line.documentType === 'credit_note');
  const sum = (rows: VatReportLine[], field: 'taxableAmount' | 'vatAmount') => rows.reduce((total, row) => total + row[field], 0);
  const currencies = new Set(lines.map((line) => line.currency));
  const taxableSales = sum(invoices, 'taxableAmount'); const outputVat = sum(invoices, 'vatAmount');
  const creditedTaxableSales = sum(credits, 'taxableAmount'); const creditedVat = sum(credits, 'vatAmount');
  return { dateFrom, dateTo, currency: currencies.size === 1 ? [...currencies][0] : currencies.size ? null : 'AED', hasMixedCurrencies: currencies.size > 1, taxableSales, outputVat, creditedTaxableSales, creditedVat, netTaxableSales: taxableSales - creditedTaxableSales, netVat: outputVat - creditedVat, lines };
}

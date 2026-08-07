import {
  getFinancialLedger,
  type FinancialLedgerEntry,
  type FinancialLedgerEntryKind,
} from './financialLedgerService';
import { supabase } from '../lib/supabase';

export type ClientStatementRow = {
  id: string;
  kind: FinancialLedgerEntryKind;
  date: string;
  documentNumber: string;
  relatedDocumentNumber: string | null;
  caseId: string | null;
  caseReference: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  currency: string;
};

export type ClientStatement = {
  clientId: string;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  currency: string;
  mixedCurrency: boolean;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  rows: ClientStatementRow[];
};

export async function getClientStatement(options: {
  clientId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<ClientStatement> {
  const ledger = await getFinancialLedger({ clientId: options.clientId });
  const dateFrom = normalizeDate(options.dateFrom);
  const dateTo = normalizeDate(options.dateTo);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error('Statement start date cannot be after the end date.');
  }

  const entries = [...ledger.entries]
    .filter(isStatementEntry)
    .sort(compareEntries);
  const caseIds = [...new Set(entries.map((entry) => entry.caseId).filter((value): value is string => Boolean(value)))];
  const caseReferences = new Map<string, string>();
  if (caseIds.length) {
    const { data, error } = await supabase.from('cases').select('id, matter_number, case_number').in('id', caseIds);
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      caseReferences.set(item.id, item.matter_number || item.case_number || 'Matter');
    }
  }
  const currencies = new Set(entries.map((entry) => entry.currency || 'AED'));
  const currency = currencies.values().next().value ?? 'AED';
  let openingBalance = 0;

  if (dateFrom) {
    openingBalance = entries
      .filter((entry) => entry.date < dateFrom)
      .reduce((balance, entry) => balance + signedAmount(entry), 0);
  }

  let runningBalance = openingBalance;
  let totalDebits = 0;
  let totalCredits = 0;

  const rows = entries
    .filter((entry) => (!dateFrom || entry.date >= dateFrom) && (!dateTo || entry.date <= dateTo))
    .map((entry): ClientStatementRow => {
      const amount = signedAmount(entry);
      const debit = amount > 0 ? amount : 0;
      const credit = amount < 0 ? Math.abs(amount) : 0;
      runningBalance += amount;
      totalDebits += debit;
      totalCredits += credit;

      return {
        id: `${entry.kind}-${entry.id}`,
        kind: entry.kind,
        date: entry.date,
        documentNumber: entry.documentNumber,
        relatedDocumentNumber: entry.relatedDocumentNumber,
        caseId: entry.caseId,
        caseReference: entry.caseId ? caseReferences.get(entry.caseId) ?? null : null,
        description: entry.description,
        debit,
        credit,
        runningBalance,
        currency: entry.currency || currency,
      };
    });

  return {
    clientId: options.clientId,
    dateFrom,
    dateTo,
    generatedAt: new Date().toISOString(),
    currency,
    mixedCurrency: currencies.size > 1,
    openingBalance,
    totalDebits,
    totalCredits,
    closingBalance: runningBalance,
    rows,
  };
}

function isStatementEntry(entry: FinancialLedgerEntry): boolean {
  if (entry.kind === 'invoice') {
    return !['draft', 'cancelled', 'written_off'].includes(entry.status);
  }
  if (entry.kind === 'payment') {
    return entry.status === 'completed';
  }
  if (entry.kind === 'payment_allocation' || entry.kind === 'allocation_reversal') {
    return false;
  }
  return true;
}

function signedAmount(entry: FinancialLedgerEntry): number {
  const amount = Number(entry.amount || 0);
  return entry.kind === 'invoice' || entry.kind === 'payment_reversal' || entry.kind === 'client_fund_reversal'
    ? amount
    : -amount;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Statement dates must use YYYY-MM-DD format.');
  }
  return normalized;
}

function compareEntries(left: FinancialLedgerEntry, right: FinancialLedgerEntry): number {
  return left.date.localeCompare(right.date) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.documentNumber.localeCompare(right.documentNumber);
}

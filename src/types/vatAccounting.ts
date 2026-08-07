export type VatTreatment = 'exclusive' | 'inclusive' | 'zero_rated' | 'out_of_scope';
export type AccountingPeriodStatus = 'open' | 'locked';

export interface AccountingPeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: AccountingPeriodStatus;
  locked_at: string | null;
  locked_by: string | null;
  lock_reason: string | null;
  created_at: string;
}

export interface VatReportLine {
  id: string;
  documentNumber: string;
  documentType: 'invoice' | 'credit_note';
  taxDate: string;
  clientId: string;
  currency: string;
  treatment: VatTreatment;
  taxableAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface VatReport {
  dateFrom: string;
  dateTo: string;
  currency: string | null;
  hasMixedCurrencies: boolean;
  taxableSales: number;
  outputVat: number;
  creditedTaxableSales: number;
  creditedVat: number;
  netTaxableSales: number;
  netVat: number;
  lines: VatReportLine[];
}

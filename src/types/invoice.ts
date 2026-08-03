export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'written_off';

export interface Invoice {
  id: string;
  client_id: string;
  case_id: string | null;

  invoice_number: string;
  issue_date: string;
  due_date: string | null;

  status: InvoiceStatus;
  currency: string;

  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  discount_amount: number;

  total_amount: number;
  paid_amount: number;
  balance_amount: number;

  description: string | null;
  notes: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;

  issued_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;

  amount: number;
}

export type InvoiceInsert = Omit<
  Invoice,
  | 'id'
  | 'issued_at'
  | 'cancelled_at'
  | 'cancelled_by'
  | 'cancellation_reason'
  | 'created_at'
  | 'updated_at'
>;

export type InvoiceUpdate = Partial<InvoiceInsert>;
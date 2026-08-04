export type CreditNoteStatus = 'issued';

export interface CreditNote {
  id: string;
  credit_note_number: string;

  invoice_id: string;
  client_id: string;
  case_id: string | null;

  issue_date: string;

  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;

  currency: string;
  reason: string;
  status: CreditNoteStatus;

  created_by: string | null;
  created_at: string;
}

export type IssueCreditNoteInput = {
  invoice_id: string;
  subtotal: number;
  vat_rate: number;
  issue_date: string;
  reason: string;
};

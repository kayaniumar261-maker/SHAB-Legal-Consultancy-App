export interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partial';
  due_date: string | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
export type InvoiceUpdate = Partial<InvoiceInsert>;

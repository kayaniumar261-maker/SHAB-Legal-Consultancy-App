export type ExpenseType = 'firm_overhead' | 'client_disbursement';
export type ExpenseStatus = 'draft' | 'approved' | 'paid' | 'void';
export type ExpenseTaxClaimStatus =
  | 'not_claimed'
  | 'pending_review'
  | 'claimable'
  | 'claimed'
  | 'non_recoverable';
export interface ExpenseVendor {
  id: string;
  name: string;
  trade_license_number: string | null;
  tax_registration_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ExpenseVendorInsert = Omit<ExpenseVendor, 'id' | 'created_at' | 'updated_at'>;

export interface ExpenseActivity {
  id: string;
  expense_id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ExpenseAttachment {
  id: string;
  expense_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export type ExpenseReimbursementStatus =
  | 'not_applicable'
  | 'unbilled'
  | 'billed'
  | 'recovered'
  | 'waived';

export interface Expense {
  id: string;
  expense_number: string;
  expense_date: string;
  expense_type: ExpenseType;
  category: string;
  description: string;
  vendor_id: string | null;
  vendor_name: string | null;
  currency: string;
  net_amount: number;
  input_vat_amount: number;
  total_amount: number;
  tax_claim_status: ExpenseTaxClaimStatus;
  client_id: string | null;
  case_id: string | null;
  recoverable_from_client: boolean;
  reimbursement_status: ExpenseReimbursementStatus;
  billed_invoice_id: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  receipt_reference: string | null;
  notes: string | null;
  status: ExpenseStatus;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseWithRelations = Expense & {
  client?: { id: string; full_name: string } | null;
  case?: { id: string; case_number: string | null; matter_number: string | null } | null;
  billed_invoice?: { id: string; invoice_number: string } | null;
  vendor?: ExpenseVendor | null;
};

export type ExpenseInsert = Pick<
  Expense,
  | 'expense_date'
  | 'expense_type'
  | 'category'
  | 'description'
  | 'vendor_id'
  | 'vendor_name'
  | 'currency'
  | 'net_amount'
  | 'input_vat_amount'
  | 'tax_claim_status'
  | 'client_id'
  | 'case_id'
  | 'recoverable_from_client'
  | 'payment_method'
  | 'payment_reference'
  | 'receipt_reference'
  | 'notes'
>;

export type ExpenseUpdate = Partial<ExpenseInsert>;

export type ExpenseFilters = {
  clientId?: string;
  caseId?: string;
  status?: ExpenseStatus;
  expenseType?: ExpenseType;
  dateFrom?: string;
  dateTo?: string;
};

export type ExpenseSummary = {
  count: number;
  totalExpenses: number;
  firmOverheads: number;
  clientDisbursements: number;
  recoverableUnbilled: number;
  informationalInputVat: number;
};

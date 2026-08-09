import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Download,
  FilePlus2,
  FileText,
  History,
  LoaderCircle,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import {
  changeExpenseStatus,
  createExpense,
  createExpenseVendor,
  createInvoiceFromRecoverableExpense,
  deleteExpenseAttachment,
  getExpenseActivity,
  getExpenseAttachmentUrl,
  getExpenseAttachments,
  getExpenseCaseOptions,
  getExpenseClientOptions,
  getExpenseVendors,
  getExpenses,
  summarizeExpenses,
  updateExpense,
  uploadExpenseAttachment,
} from '../services/expenseService';
import type {
  ExpenseActivity,
  ExpenseAttachment,
  ExpenseInsert,
  ExpenseStatus,
  ExpenseType,
  ExpenseVendor,
  ExpenseVendorInsert,
  ExpenseWithRelations,
} from '../types/expense';
import './Expenses.css';

type ClientOption = { id: string; name: string };
type CaseOption = { id: string; clientId: string; label: string };

const categories = [
  'Court Fees',
  'Translation Charges',
  'Certified True Copy (CTC)',
  'Expert Fees',
  'Government Fees',
  'Notary & Attestation',
  'Courier & Delivery',
  'Travel & Transport',
  'Office & Administration',
  'Software & Subscriptions',
  'Professional Services',
  'Other',
];

function localToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function Expenses() {
  const [expenses, setExpenses] = useState<ExpenseWithRelations[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [vendors, setVendors] = useState<ExpenseVendor[]>([]);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithRelations | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ExpenseType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExpenseStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [recoveryFilter, setRecoveryFilter] = useState<'all' | 'recoverable' | 'non_recoverable' | 'unbilled' | 'billed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [attachmentExpense, setAttachmentExpense] = useState<ExpenseWithRelations | null>(null);
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [activityExpense, setActivityExpense] = useState<ExpenseWithRelations | null>(null);
  const [activity, setActivity] = useState<ExpenseActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rows, clientRows, caseRows, vendorRows] = await Promise.all([
        getExpenses({
          expenseType: typeFilter === 'all' ? undefined : typeFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        getExpenseClientOptions(),
        getExpenseCaseOptions(),
        getExpenseVendors(),
      ]);
      setExpenses(rows);
      setClients(clientRows);
      setCases(caseRows);
      setVendors(vendorRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleExpenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesSearch = !term || [
        expense.expense_number,
        expense.category,
        expense.description,
        expense.vendor_name,
        expense.client?.full_name,
        expense.case?.matter_number,
        expense.case?.case_number,
      ].some((value) => String(value ?? '').toLowerCase().includes(term));
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesClient = clientFilter === 'all' || expense.client_id === clientFilter;
      const matchesDate = (!dateFrom || expense.expense_date >= dateFrom) && (!dateTo || expense.expense_date <= dateTo);
      const matchesRecovery = recoveryFilter === 'all'
        || (recoveryFilter === 'recoverable' && expense.recoverable_from_client)
        || (recoveryFilter === 'non_recoverable' && !expense.recoverable_from_client)
        || (recoveryFilter === 'unbilled' && expense.recoverable_from_client && expense.reimbursement_status === 'unbilled')
        || (recoveryFilter === 'billed' && expense.reimbursement_status === 'billed');
      return matchesSearch && matchesCategory && matchesClient && matchesDate && matchesRecovery;
    });
  }, [categoryFilter, clientFilter, dateFrom, dateTo, expenses, recoveryFilter, search]);

  const filteredSummary = useMemo(() => summarizeExpenses(visibleExpenses), [visibleExpenses]);
  const filtersActive = Boolean(search || dateFrom || dateTo || categoryFilter !== 'all' || clientFilter !== 'all' || recoveryFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all');

  function clearFilters() {
    setSearch(''); setTypeFilter('all'); setStatusFilter('all'); setCategoryFilter('all');
    setClientFilter('all'); setRecoveryFilter('all'); setDateFrom(''); setDateTo('');
  }

  function exportCsv() {
    if (visibleExpenses.length === 0) return;
    const headers = ['Date', 'Expense Number', 'Category', 'Description', 'Vendor / Payee', 'Type', 'Client', 'Matter', 'Net Amount', 'VAT', 'Total', 'Currency', 'Status', 'Recoverable', 'Reimbursement Status', 'Invoice'];
    const rows = visibleExpenses.map((expense) => [
      expense.expense_date, expense.expense_number, expense.category, expense.description,
      expense.vendor_name ?? '', label(expense.expense_type), expense.client?.full_name ?? '',
      expense.case?.matter_number ?? expense.case?.case_number ?? '', Number(expense.net_amount).toFixed(2),
      Number(expense.input_vat_amount).toFixed(2), Number(expense.total_amount).toFixed(2), expense.currency,
      label(expense.status), expense.recoverable_from_client ? 'Yes' : 'No',
      label(expense.reimbursement_status), expense.billed_invoice?.invoice_number ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SHAB-expenses-${dateFrom || 'all'}-to-${dateTo || localToday()}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  const summary = useMemo(() => summarizeExpenses(expenses), [expenses]);

  async function openActivity(expense: ExpenseWithRelations) {
    setActivityExpense(expense);
    setActivityLoading(true);
    setError(null);
    try {
      setActivity(await getExpenseActivity(expense.id));
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : 'Unable to load expense history.');
    } finally {
      setActivityLoading(false);
    }
  }

  async function openAttachments(expense: ExpenseWithRelations) {
    setAttachmentExpense(expense);
    setAttachmentsLoading(true);
    setError(null);
    try {
      setAttachments(await getExpenseAttachments(expense.id));
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Unable to load supporting documents.');
    } finally {
      setAttachmentsLoading(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (!attachmentExpense) return;
    try {
      setAttachmentBusy(true);
      setError(null);
      await uploadExpenseAttachment(attachmentExpense.id, file);
      setAttachments(await getExpenseAttachments(attachmentExpense.id));
      setSuccess(`Supporting document added to ${attachmentExpense.expense_number}.`);
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Unable to upload the supporting document.');
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function viewAttachment(attachment: ExpenseAttachment) {
    try {
      const url = await getExpenseAttachmentUrl(attachment.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Unable to open the supporting document.');
    }
  }

  async function removeAttachment(attachment: ExpenseAttachment) {
    if (!attachmentExpense || !window.confirm(`Delete ${attachment.file_name}?`)) return;
    try {
      setAttachmentBusy(true);
      await deleteExpenseAttachment(attachment);
      setAttachments(await getExpenseAttachments(attachmentExpense.id));
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : 'Unable to delete the supporting document.');
    } finally {
      setAttachmentBusy(false);
    }
  }

  async function billDisbursement(expense: ExpenseWithRelations) {
    const issueDate = localToday();
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    if (!window.confirm(`Create a draft invoice for ${expense.expense_number} totalling ${money(Number(expense.total_amount), expense.currency)}?`)) return;
    try {
      setBusyId(expense.id);
      setError(null);
      setSuccess(null);
      const invoice = await createInvoiceFromRecoverableExpense(expense.id, issueDate, dueDate);
      setSuccess(`${expense.expense_number} added to draft invoice ${invoice.invoice_number}.`);
      await load();
    } catch (billingError) {
      setError(billingError instanceof Error ? billingError.message : 'Unable to create the disbursement invoice.');
    } finally {
      setBusyId(null);
    }
  }

  async function transition(expense: ExpenseWithRelations, status: ExpenseStatus) {
    let reason: string | undefined;
    if (status === 'void') {
      reason = window.prompt('Reason for voiding this expense:')?.trim();
      if (!reason || reason.length < 5) return;
    } else if (!window.confirm(
      status === 'approved'
        ? `Approve ${expense.expense_number}?`
        : `Mark ${expense.expense_number} as paid?`,
    )) return;

    try {
      setBusyId(expense.id);
      setError(null);
      setSuccess(null);
      await changeExpenseStatus(expense.id, status, reason);
      setSuccess(`${expense.expense_number} marked ${status}.`);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the expense.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="expenses-page">
      <section className="expenses-heading">
        <div>
          <p className="expenses-eyebrow">Cost control</p>
          <h1>Expenses &amp; Client Disbursements</h1>
          <p>Record firm costs, case expenses and amounts recoverable from clients.</p>
        </div>
        <div className="expense-heading-actions">
          <button type="button" className="expense-secondary" onClick={exportCsv} disabled={visibleExpenses.length === 0}>
            <Download size={17} /> Export CSV
          </button>
          <button type="button" className="expense-primary" onClick={() => setShowForm(true)}>
            <Plus size={17} /> New Expense
          </button>
        </div>
      </section>

      <div className="expense-tax-notice">
        <ShieldCheck size={18} />
        <div><strong>Input VAT is informational only</strong><span>Until FTA registration is active, supplier VAT may be recorded but cannot be marked or reported as claimed.</span></div>
      </div>

      {error && <div className="expense-alert error"><AlertTriangle size={18} />{error}</div>}
      {success && <div className="expense-alert success"><CheckCircle2 size={18} />{success}</div>}

      <section className="expense-summary">
        <SummaryCard icon={<ReceiptText size={19} />} label="Total expenses" value={money(summary.totalExpenses)} detail={`${summary.count} active records`} />
        <SummaryCard icon={<Building2 size={19} />} label="Firm overhead" value={money(summary.firmOverheads)} detail="Non-client operational costs" />
        <SummaryCard icon={<Users size={19} />} label="Client disbursements" value={money(summary.clientDisbursements)} detail="Case and client costs" />
        <SummaryCard icon={<CircleDollarSign size={19} />} label="Recoverable unbilled" value={money(summary.recoverableUnbilled)} detail="Awaiting client billing" warning={summary.recoverableUnbilled > 0} />
        <SummaryCard icon={<FileText size={19} />} label="Supplier VAT recorded" value={money(summary.informationalInputVat)} detail="Not claimed" />
      </section>

      <section className="expense-workspace">
        <div className="expense-toolbar">
          <label className="expense-search"><Search size={16} /><input placeholder="Search expenses…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | ExpenseType)}>
            <option value="all">All expense types</option><option value="firm_overhead">Firm overhead</option><option value="client_disbursement">Client disbursement</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ExpenseStatus)}>
            <option value="all">All statuses</option><option value="draft">Draft</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="void">Void</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="all">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <select value={recoveryFilter} onChange={(event) => setRecoveryFilter(event.target.value as typeof recoveryFilter)}>
            <option value="all">All recoverability</option><option value="recoverable">Recoverable</option><option value="non_recoverable">Non-recoverable</option><option value="unbilled">Recoverable unbilled</option><option value="billed">Billed to client</option>
          </select>
          <label className="expense-date-filter"><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="expense-date-filter"><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          {filtersActive && <button type="button" className="expense-clear-filters" onClick={clearFilters}><X size={14} />Clear filters</button>}
          <div className="expense-report-result"><strong>{visibleExpenses.length}</strong><span>records</span><strong>{money(filteredSummary.totalExpenses)}</strong><span>filtered total</span></div>
        </div>

        {loading ? <div className="expense-empty"><LoaderCircle className="expense-spin" size={23} />Loading expenses…</div> : visibleExpenses.length === 0 ? (
          <div className="expense-empty"><ReceiptText size={28} /><strong>No expenses found</strong><span>Create the first firm expense or client disbursement.</span></div>
        ) : (
          <div className="expense-table-wrap">
            <table className="expense-table">
              <thead><tr><th>Date / Number</th><th>Category</th><th>Type</th><th>Client / Case</th><th>Net</th><th>VAT</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{visibleExpenses.map((expense) => (
                <tr key={expense.id} className={expense.status === 'void' ? 'is-void' : ''}>
                  <td><strong>{formatDate(expense.expense_date)}</strong><small>{expense.expense_number}</small></td>
                  <td><strong>{expense.category}</strong><small>{expense.vendor_name || expense.description}</small></td>
                  <td><span className={`expense-type ${expense.expense_type}`}>{label(expense.expense_type)}</span>{expense.recoverable_from_client && <small className="recoverable-chip">Recoverable</small>}</td>
                  <td><strong>{expense.client?.full_name ?? 'Firm expense'}</strong><small>{expense.case?.matter_number ?? expense.case?.case_number ?? 'No matter'}</small></td>
                  <td>{money(Number(expense.net_amount), expense.currency)}</td>
                  <td>{money(Number(expense.input_vat_amount), expense.currency)}<small>Not claimed</small></td>
                  <td><strong>{money(Number(expense.total_amount), expense.currency)}</strong></td>
                  <td><span className={`expense-status ${expense.status}`}>{expense.status}</span></td>
                  <td><div className="expense-actions">
                    {busyId === expense.id ? <LoaderCircle className="expense-spin" size={17} /> : <>
                      <button type="button" title="Audit history" onClick={() => void openActivity(expense)}><History size={14} />History</button>
                      <button type="button" title="Supporting documents" onClick={() => void openAttachments(expense)}><Paperclip size={14} />Docs</button>
                      {expense.status === 'draft' && <button type="button" title="Edit" onClick={() => setEditing(expense)}><Pencil size={14} /></button>}
                      {expense.status === 'draft' && <button type="button" onClick={() => void transition(expense, 'approved')}>Approve</button>}
                      {expense.status === 'approved' && <button type="button" onClick={() => void transition(expense, 'paid')}><CreditCard size={14} />Paid</button>}
                      {expense.recoverable_from_client && expense.reimbursement_status === 'unbilled' && ['approved', 'paid'].includes(expense.status) && <button type="button" className="bill" onClick={() => void billDisbursement(expense)}><FilePlus2 size={14} />Bill</button>}
                      {expense.reimbursement_status === 'billed' && <span className="expense-billed-chip" title={expense.billed_invoice?.invoice_number ?? 'Draft invoice'}>{expense.billed_invoice?.invoice_number ?? 'Billed'}</span>}
                      {['draft', 'approved'].includes(expense.status) && <button type="button" className="danger" title="Void" onClick={() => void transition(expense, 'void')}><Trash2 size={14} /></button>}
                    </>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {(showForm || editing) && <ExpenseModal
        expense={editing ?? undefined}
        clients={clients}
        cases={cases}
        vendors={vendors}
        onAddVendor={() => setShowVendorForm(true)}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={async () => { setShowForm(false); setEditing(null); setSuccess(editing ? 'Expense updated.' : 'Expense created as draft.'); await load(); }}
      />}

      {showVendorForm && <VendorModal
        onClose={() => setShowVendorForm(false)}
        onSaved={async (vendor) => { setVendors((current) => [...current, vendor].sort((a, b) => a.name.localeCompare(b.name))); setShowVendorForm(false); setSuccess(`Vendor ${vendor.name} added.`); }}
      />}

      {activityExpense && <div className="expense-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivityExpense(null); }}>
        <section className="expense-modal expense-activity-modal">
          <header><div><span className="expenses-eyebrow">Audit trail</span><h2>{activityExpense.expense_number}</h2></div><button type="button" onClick={() => setActivityExpense(null)} aria-label="Close"><X size={19} /></button></header>
          <div className="expense-activity-list">
            {activityLoading ? <div className="expense-empty"><LoaderCircle className="expense-spin" size={22} />Loading history…</div> : activity.length === 0 ? <div className="expense-empty"><History size={25} /><strong>No activity recorded</strong></div> : activity.map((event) => <article key={event.id}>
              <div className={`expense-activity-icon ${event.action}`}><History size={15} /></div>
              <section><strong>{activityLabel(event.action)}</strong><span>{activityDescription(event)}</span><small>{event.actor_email || (event.actor_id ? `User ${event.actor_id.slice(0, 8)}` : 'System record')} · {formatDateTime(event.created_at)}</small></section>
            </article>)}
          </div>
        </section>
      </div>}

      {attachmentExpense && <div className="expense-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !attachmentBusy) setAttachmentExpense(null); }}>
        <section className="expense-modal expense-documents-modal">
          <header><div><span className="expenses-eyebrow">Supporting evidence</span><h2>{attachmentExpense.expense_number}</h2></div><button type="button" onClick={() => setAttachmentExpense(null)} disabled={attachmentBusy} aria-label="Close"><X size={19} /></button></header>
          <div className="expense-documents-toolbar">
            <div><strong>Receipts &amp; vouchers</strong><span>PDF, JPG, PNG or WebP - maximum 10 MB.</span></div>
            <label className="expense-primary expense-upload-button"><Upload size={15} />{attachmentBusy ? 'Uploading…' : 'Add File'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={attachmentBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); event.currentTarget.value = ''; }} /></label>
          </div>
          <div className="expense-documents-list">
            {attachmentsLoading ? <div className="expense-empty"><LoaderCircle className="expense-spin" size={22} />Loading documents…</div> : attachments.length === 0 ? <div className="expense-empty"><Paperclip size={25} /><strong>No supporting documents</strong><span>Add a receipt, invoice, court voucher or payment proof.</span></div> : attachments.map((attachment) => <article key={attachment.id}>
              <FileText size={19} /><div><strong>{attachment.file_name}</strong><span>{formatFileSize(attachment.file_size)} · {formatDateTime(attachment.created_at)}</span></div>
              <button type="button" onClick={() => void viewAttachment(attachment)}><Download size={14} />Open</button>
              {attachmentExpense.status === 'draft' && <button type="button" className="danger" disabled={attachmentBusy} onClick={() => void removeAttachment(attachment)}><Trash2 size={14} /></button>}
            </article>)}
          </div>
        </section>
      </div>}
    </main>
  );
}

function ExpenseModal({ expense, clients, cases, vendors, onAddVendor, onClose, onSaved }: {
  expense?: ExpenseWithRelations;
  clients: ClientOption[];
  cases: CaseOption[];
  vendors: ExpenseVendor[];
  onAddVendor: () => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    expense_date: expense?.expense_date ?? localToday(),
    expense_type: expense?.expense_type ?? 'firm_overhead' as ExpenseType,
    category: expense?.category ?? categories[0],
    description: expense?.description ?? '',
    vendor_id: expense?.vendor_id ?? '',
    vendor_name: expense?.vendor_name ?? '',
    currency: expense?.currency ?? 'AED',
    net_amount: expense ? String(expense.net_amount) : '',
    input_vat_amount: expense ? String(expense.input_vat_amount) : '0',
    client_id: expense?.client_id ?? '',
    case_id: expense?.case_id ?? '',
    recoverable_from_client: expense?.recoverable_from_client ?? false,
    payment_method: expense?.payment_method ?? '',
    payment_reference: expense?.payment_reference ?? '',
    receipt_reference: expense?.receipt_reference ?? '',
    notes: expense?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableCases = form.client_id ? cases.filter((item) => item.clientId === form.client_id) : cases;
  const total = Number(form.net_amount || 0) + Number(form.input_vat_amount || 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.description.trim() || Number(form.net_amount) < 0 || total <= 0) {
      setError('Enter a description and an expense amount greater than zero.'); return;
    }
    if (form.recoverable_from_client && !form.client_id) {
      setError('Select a client for a recoverable disbursement.'); return;
    }
    const payload: ExpenseInsert = {
      expense_date: form.expense_date,
      expense_type: form.recoverable_from_client ? 'client_disbursement' : form.expense_type,
      category: form.category,
      description: form.description.trim(),
      vendor_id: form.vendor_id || null,
      vendor_name: form.vendor_name.trim() || null,
      currency: form.currency.trim().toUpperCase(),
      net_amount: Number(form.net_amount),
      input_vat_amount: Number(form.input_vat_amount || 0),
      tax_claim_status: 'not_claimed',
      client_id: form.expense_type === 'client_disbursement' ? form.client_id || null : null,
      case_id: form.expense_type === 'client_disbursement' ? form.case_id || null : null,
      recoverable_from_client: form.recoverable_from_client,
      payment_method: form.payment_method.trim() || null,
      payment_reference: form.payment_reference.trim() || null,
      receipt_reference: form.receipt_reference.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      setSaving(true); setError(null);
      if (expense) await updateExpense(expense.id, payload); else await createExpense(payload);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save expense.');
    } finally { setSaving(false); }
  }

  return <div className="expense-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="expense-modal" onSubmit={submit}>
      <header><div><span className="expenses-eyebrow">Cost record</span><h2>{expense ? 'Edit Draft Expense' : 'New Expense'}</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={19} /></button></header>
      {error && <div className="expense-alert error"><AlertTriangle size={17} />{error}</div>}
      <div className="expense-form-grid">
        <label>Expense date<input type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} required /></label>
        <label>Expense type<select value={form.expense_type} onChange={(event) => { const expenseType = event.target.value as ExpenseType; setForm({ ...form, expense_type: expenseType, recoverable_from_client: expenseType === 'client_disbursement' ? form.recoverable_from_client : false, client_id: expenseType === 'firm_overhead' ? '' : form.client_id, case_id: expenseType === 'firm_overhead' ? '' : form.case_id }); }}><option value="firm_overhead">Firm overhead</option><option value="client_disbursement">Client disbursement</option></select></label>
        <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Vendor / payee<div className="expense-vendor-control"><select value={form.vendor_id} onChange={(event) => { const vendor = vendors.find((item) => item.id === event.target.value); setForm({ ...form, vendor_id: event.target.value, vendor_name: vendor?.name ?? '' }); }}><option value="">No saved vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><button type="button" onClick={onAddVendor}><Plus size={14} />Add</button></div>{!form.vendor_id && <input placeholder="Or enter a one-off payee" value={form.vendor_name} onChange={(event) => setForm({ ...form, vendor_name: event.target.value })} />}</label>
        <label className="wide">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
        <label>Net amount<input type="number" min="0" step="0.01" value={form.net_amount} onChange={(event) => setForm({ ...form, net_amount: event.target.value })} required /></label>
        <label>Supplier VAT<input type="number" min="0" step="0.01" value={form.input_vat_amount} onChange={(event) => setForm({ ...form, input_vat_amount: event.target.value })} /><small>Recorded only; not claimed.</small></label>
        <label>Currency<input maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} required /></label>
        <div className="expense-total-preview"><span>Total expense</span><strong>{money(total, form.currency || 'AED')}</strong></div>
        <label>Client<select value={form.client_id} disabled={form.expense_type === 'firm_overhead'} onChange={(event) => setForm({ ...form, client_id: event.target.value, case_id: '' })}><option value="">No client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label>Case / matter<select value={form.case_id} disabled={form.expense_type === 'firm_overhead'} onChange={(event) => { const selected = cases.find((item) => item.id === event.target.value); setForm({ ...form, case_id: event.target.value, client_id: selected?.clientId ?? form.client_id }); }}><option value="">No matter</option>{availableCases.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="expense-check wide"><input type="checkbox" checked={form.recoverable_from_client} disabled={form.expense_type !== 'client_disbursement'} onChange={(event) => setForm({ ...form, recoverable_from_client: event.target.checked })} /><span><strong>Recoverable from client</strong><small>Track this amount for future client billing.</small></span></label>
        <label>Payment method<input placeholder="Bank, card, cash…" value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })} /></label>
        <label>Payment reference<input value={form.payment_reference} onChange={(event) => setForm({ ...form, payment_reference: event.target.value })} /></label>
        <label>Receipt reference<input value={form.receipt_reference} onChange={(event) => setForm({ ...form, receipt_reference: event.target.value })} /></label>
        <label className="wide">Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer><button type="button" className="expense-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="expense-primary" disabled={saving}>{saving ? <LoaderCircle className="expense-spin" size={16} /> : <Plus size={16} />}{saving ? 'Saving…' : 'Save Draft'}</button></footer>
    </form>
  </div>;
}

function VendorModal({ onClose, onSaved }: { onClose: () => void; onSaved: (vendor: ExpenseVendor) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', trade_license_number: '', tax_registration_number: '', email: '', phone: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.name.trim().length < 2) { setError('Enter the vendor or supplier name.'); return; }
    const input: ExpenseVendorInsert = {
      name: form.name.trim(), trade_license_number: form.trade_license_number.trim() || null,
      tax_registration_number: form.tax_registration_number.trim() || null, email: form.email.trim() || null,
      phone: form.phone.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null, is_active: true,
    };
    try { setSaving(true); setError(null); await onSaved(await createExpenseVendor(input)); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save vendor.'); }
    finally { setSaving(false); }
  }
  return <div className="expense-modal-overlay expense-vendor-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="expense-modal expense-vendor-modal" onSubmit={submit}>
      <header><div><span className="expenses-eyebrow">Supplier directory</span><h2>Add Vendor</h2></div><button type="button" onClick={onClose} disabled={saving}><X size={19} /></button></header>
      {error && <div className="expense-alert error"><AlertTriangle size={17} />{error}</div>}
      <div className="expense-form-grid">
        <label className="wide">Vendor / supplier name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus required /></label>
        <label>Trade licence number<input value={form.trade_license_number} onChange={(event) => setForm({ ...form, trade_license_number: event.target.value })} /></label>
        <label>Tax registration number<input value={form.tax_registration_number} onChange={(event) => setForm({ ...form, tax_registration_number: event.target.value })} /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="wide">Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label className="wide">Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer><button type="button" className="expense-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="expense-primary" disabled={saving}>{saving ? <LoaderCircle className="expense-spin" size={16} /> : <Plus size={16} />}{saving ? 'Saving…' : 'Add Vendor'}</button></footer>
    </form>
  </div>;
}

function SummaryCard({ icon, label: title, value, detail, warning = false }: { icon: ReactNode; label: string; value: string; detail: string; warning?: boolean }) {
  return <article className={`expense-summary-card${warning ? ' warning' : ''}`}><div>{icon}</div><section><span>{title}</span><strong>{value}</strong><small>{detail}</small></section></article>;
}
function money(value: number, currency = 'AED') {
  const safeCurrency = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'AED';
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: safeCurrency, maximumFractionDigits: 2 }).format(value);
}
function label(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function csvCell(value: unknown) { const text = String(value ?? ''); return /[\",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function formatFileSize(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function activityLabel(action: string) { const labels: Record<string, string> = { created: 'Expense created', updated: 'Expense updated', approved: 'Expense approved', paid: 'Expense marked paid', voided: 'Expense voided', billed: 'Draft invoice created', billing_released: 'Returned to unbilled', attachment_added: 'Supporting document added', attachment_removed: 'Supporting document removed' }; return labels[action] ?? label(action); }
function activityDescription(event: ExpenseActivity) { const details = event.details ?? {}; if (event.action === 'attachment_added' || event.action === 'attachment_removed') return String(details.file_name ?? 'Supporting document'); if (event.action === 'billed') return details.invoice_number ? `Invoice ${String(details.invoice_number)}` : 'Recoverable disbursement billed'; if (event.action === 'voided') return String(details.reason ?? 'Expense voided'); if (event.action === 'created') return `${String(details.category ?? 'Expense')} · ${String(details.currency ?? 'AED')} ${Number(details.total ?? 0).toFixed(2)}`; return String(details.summary ?? 'Expense record updated'); }

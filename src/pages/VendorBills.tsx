import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Eye, FileText, History, LoaderCircle, Search, Upload, WalletCards, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import {
  changeExpenseStatus,
  getVendorBills,
  getVendorPaymentProofUrl,
  getVendorPayments,
  recordVendorPayment,
  removeVendorPaymentProof,
  uploadVendorPaymentProof,
} from '../services/expenseService';
import type { ExpenseStatus, ExpenseWithRelations, VendorPayment } from '../types/expense';
import './Payments.css';
import './VendorBills.css';
import './VendorBills.mobile.css';

export function VendorBills() {
  const [bills, setBills] = useState<ExpenseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ExpenseStatus | 'overdue'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentBill, setPaymentBill] = useState<ExpenseWithRelations | null>(null);
  const [historyBill, setHistoryBill] = useState<ExpenseWithRelations | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setBills(await getVendorBills()); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load vendor bills.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bills.filter((bill) => {
      const overdue = isOverdue(bill);
      const statusMatch = status === 'all' || (status === 'overdue' ? overdue : bill.status === status);
      const searchMatch = !term || [bill.supplier_invoice_number, bill.expense_number, bill.vendor_name, bill.category, bill.description, bill.payment_reference].some((value) => String(value ?? '').toLowerCase().includes(term));
      return statusMatch && searchMatch;
    });
  }, [bills, search, status]);
  const active = bills.filter((bill) => bill.status !== 'void');
  const open = active.filter((bill) => balance(bill) > 0);
  const paid = active.filter((bill) => balance(bill) <= 0);
  const overdue = open.filter(isOverdue);

  async function approve(bill: ExpenseWithRelations) {
    if (!window.confirm(`Approve vendor bill ${bill.supplier_invoice_number || bill.expense_number}?`)) return;
    try { setBusyId(bill.id); setError(null); await changeExpenseStatus(bill.id, 'approved'); setSuccess(`${bill.supplier_invoice_number || bill.expense_number} approved.`); await load(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Unable to approve vendor bill.'); }
    finally { setBusyId(null); }
  }

  return <main className="vendor-bills-page">
    <section className="finance-page-header"><div><span>Accounts payable</span><h1>Vendor Bills</h1><p>Supplier invoices, payment balances and auditable settlement history.</p></div></section>
    <section className="finance-tabs"><Link to="/payments"><WalletCards size={17} />Client Invoices &amp; Payments</Link><Link to="/payments/vendor-bills" className="active"><FileText size={17} />Vendor Bills</Link></section>
    {error && <div className="vendor-bills-alert error"><AlertTriangle size={18} />{error}</div>}{success && <div className="vendor-bills-alert success"><CheckCircle2 size={18} />{success}</div>}
    <section className="vendor-bills-summary"><BillStat label="Total bills" value={totals(active, 'total_amount')} /><BillStat label="Paid" value={totals(active, 'paid_amount')} tone="paid" /><BillStat label="Open / unpaid" value={totals(open, 'balance')} tone="open" /><BillStat label="Overdue" value={totals(overdue, 'balance')} tone="overdue" /></section>
    <section className="vendor-bills-workspace"><div className="vendor-bills-toolbar"><label><Search size={16} /><input placeholder="Search supplier invoice, vendor, expense…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select><span>{visible.length} bills</span></div>
      <div className="vendor-bills-table-wrap"><table><thead><tr><th>Supplier Invoice</th><th>Vendor</th><th>Invoice / Due Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="vendor-bills-state"><LoaderCircle className="vendor-bills-spin" />Loading vendor bills…</td></tr> : visible.length === 0 ? <tr><td colSpan={8} className="vendor-bills-state">No vendor bills found.</td></tr> : visible.map((bill) => { const overdueBill = isOverdue(bill); return <tr key={bill.id} className={overdueBill ? 'overdue' : ''}><td><strong>{bill.supplier_invoice_number || 'Not recorded'}</strong><small>{bill.expense_number} · {bill.category}</small></td><td><strong>{bill.vendor_name || 'Unknown vendor'}</strong><small>{bill.vendor?.tax_registration_number ? `TRN ${bill.vendor.tax_registration_number}` : bill.vendor?.email || ''}</small></td><td>{bill.supplier_invoice_date ? formatDate(bill.supplier_invoice_date) : 'Not recorded'}<small>{bill.due_date ? `Due ${formatDate(bill.due_date)}` : 'No due date'}{overdueBill ? ` · ${daysOverdue(bill.due_date!)} days overdue` : ''}</small></td><td><strong>{money(Number(bill.total_amount), bill.currency)}</strong><small>VAT {money(Number(bill.input_vat_amount), bill.currency)}</small></td><td>{money(Number(bill.paid_amount ?? 0), bill.currency)}</td><td><strong>{money(balance(bill), bill.currency)}</strong></td><td><span className={`vendor-bill-status ${bill.status}`}>{bill.status}</span>{overdueBill && <small className="vendor-bill-overdue">Overdue</small>}</td><td>{busyId === bill.id ? <LoaderCircle className="vendor-bills-spin" size={17} /> : <div className="vendor-bill-actions">{bill.status === 'draft' && <button type="button" onClick={() => void approve(bill)}>Approve</button>}{bill.status === 'approved' && balance(bill) > 0 && <button type="button" onClick={() => setPaymentBill(bill)}>Record Payment</button>}{Number(bill.paid_amount ?? 0) > 0 && <button type="button" className="secondary" onClick={() => setHistoryBill(bill)}><History size={13} />History</button>}{bill.status === 'paid' && <span>Completed</span>}</div>}</td></tr>})}</tbody></table></div>
    </section>
    {paymentBill && <PaymentModal bill={paymentBill} onClose={() => setPaymentBill(null)} onSaved={async () => { setPaymentBill(null); setSuccess(`Payment recorded for ${paymentBill.supplier_invoice_number || paymentBill.expense_number}.`); await load(); }} />}
    {historyBill && <PaymentHistoryModal bill={historyBill} onClose={() => setHistoryBill(null)} onError={setError} />}
  </main>;
}

function PaymentModal({ bill, onClose, onSaved }: { bill: ExpenseWithRelations; onClose: () => void; onSaved: () => Promise<void> }) {
  const remaining = balance(bill);
  const [form, setForm] = useState({ payment_date: localDateKey(), amount: remaining.toFixed(2), payment_method: 'Bank Transfer', payment_reference: '', notes: '' });
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.005) { setError(`Payment must be greater than zero and no more than ${money(remaining, bill.currency)}.`); return; }
    if (!form.payment_reference.trim()) { setError('Enter the bank, cheque, cash or card payment reference.'); return; }
    let storagePath: string | null = null;
    try {
      setSaving(true); setError(null);
      if (proof) storagePath = await uploadVendorPaymentProof(bill.id, proof);
      await recordVendorPayment({ expense_id: bill.id, payment_date: form.payment_date, amount, payment_method: form.payment_method, payment_reference: form.payment_reference.trim(), notes: form.notes.trim() || null, proof_file_name: proof?.name ?? null, proof_storage_path: storagePath });
      await onSaved();
    } catch (saveError) {
      if (storagePath) { try { await removeVendorPaymentProof(storagePath); } catch { /* preserve original error */ } }
      setError(saveError instanceof Error ? saveError.message : 'Unable to record vendor payment.');
    } finally { setSaving(false); }
  }
  return createPortal(<div className="vendor-payment-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><form className="vendor-payment-modal" onSubmit={submit}><header><div><span>Accounts payable</span><h2>Record Vendor Payment</h2><p>{bill.vendor_name} · {bill.supplier_invoice_number || bill.expense_number}</p></div><button type="button" onClick={onClose} disabled={saving}><X size={19} /></button></header>{error && <div className="vendor-bills-alert error"><AlertTriangle size={17} />{error}</div>}<div className="vendor-payment-balance"><span>Bill total<strong>{money(Number(bill.total_amount), bill.currency)}</strong></span><span>Previously paid<strong>{money(Number(bill.paid_amount ?? 0), bill.currency)}</strong></span><span>Balance due<strong>{money(remaining, bill.currency)}</strong></span></div><div className="vendor-payment-grid"><label>Payment date<input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} required /></label><label>Amount ({bill.currency})<input type="number" min="0.01" max={remaining} step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></label><label>Payment method<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}><option>Bank Transfer</option><option>Cheque</option><option>Corporate Card</option><option>Cash</option><option>Other</option></select></label><label>Payment reference<input value={form.payment_reference} onChange={(event) => setForm({ ...form, payment_reference: event.target.value })} placeholder="Transaction, cheque or voucher number" required /></label><label className="wide">Notes<textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="vendor-proof-upload wide"><Upload size={17} /><span><strong>{proof?.name || 'Attach payment proof'}</strong><small>PDF, JPG, PNG or WebP · maximum 10 MB</small></span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label></div><footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? <LoaderCircle className="vendor-bills-spin" size={16} /> : <WalletCards size={16} />}{saving ? 'Recording…' : 'Record Payment'}</button></footer></form></div>, document.body);
}

function PaymentHistoryModal({ bill, onClose, onError }: { bill: ExpenseWithRelations; onClose: () => void; onError: (value: string) => void }) {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getVendorPayments(bill.id).then(setPayments).catch((reason) => onError(reason instanceof Error ? reason.message : 'Unable to load payment history.')).finally(() => setLoading(false)); }, [bill.id, onError]);
  async function openProof(payment: VendorPayment) { if (!payment.proof_storage_path) return; try { window.open(await getVendorPaymentProofUrl(payment.proof_storage_path), '_blank', 'noopener,noreferrer'); } catch (reason) { onError(reason instanceof Error ? reason.message : 'Unable to open payment proof.'); } }
  return createPortal(<div className="vendor-payment-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="vendor-payment-modal vendor-history-modal"><header><div><span>Payment audit trail</span><h2>{bill.supplier_invoice_number || bill.expense_number}</h2><p>{bill.vendor_name}</p></div><button type="button" onClick={onClose}><X size={19} /></button></header><div className="vendor-payment-balance"><span>Bill total<strong>{money(Number(bill.total_amount), bill.currency)}</strong></span><span>Total paid<strong>{money(Number(bill.paid_amount ?? 0), bill.currency)}</strong></span><span>Balance<strong>{money(balance(bill), bill.currency)}</strong></span></div><div className="vendor-history-list">{loading ? <div className="vendor-bills-state"><LoaderCircle className="vendor-bills-spin" />Loading payments…</div> : payments.length === 0 ? <div className="vendor-bills-state">No payments recorded.</div> : payments.map((payment) => <article key={payment.id}><div><strong>{money(Number(payment.amount), bill.currency)}</strong><span>{formatDate(payment.payment_date)} · {payment.payment_method}</span></div><div><strong>{payment.payment_reference}</strong><span>{payment.notes || 'No notes'}</span></div>{payment.proof_storage_path ? <button type="button" onClick={() => void openProof(payment)}><Eye size={14} />Proof</button> : <span className="no-proof">No proof</span>}</article>)}</div></section></div>, document.body);
}

function BillStat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) { return <article className={tone}><Clock3 size={19} /><div><span>{label}</span><strong>{value}</strong></div></article>; }
function localDateKey() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function balance(bill: ExpenseWithRelations) { return Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount ?? 0)); }
function isOverdue(bill: ExpenseWithRelations) { return balance(bill) > 0 && bill.status !== 'void' && Boolean(bill.due_date && bill.due_date < localDateKey()); }
function daysOverdue(dueDate: string) { return Math.max(0, Math.floor((new Date(`${localDateKey()}T00:00:00`).getTime() - new Date(`${dueDate}T00:00:00`).getTime()) / 86400000)); }
function money(value: number, currency = 'AED') { const safe = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'AED'; return new Intl.NumberFormat('en-AE', { style: 'currency', currency: safe, maximumFractionDigits: 2 }).format(value); }
function totals(rows: ExpenseWithRelations[], field: 'total_amount' | 'paid_amount' | 'balance') { if (!rows.length) return 'AED 0.00'; const grouped = rows.reduce<Record<string, number>>((result, row) => { const value = field === 'balance' ? balance(row) : Number(row[field] ?? 0); result[row.currency] = (result[row.currency] ?? 0) + value; return result; }, {}); return Object.entries(grouped).map(([currency, value]) => money(value, currency)).join(' · '); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }

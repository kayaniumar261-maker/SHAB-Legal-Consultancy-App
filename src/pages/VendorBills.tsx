import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileText, LoaderCircle, Search, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';

import { changeExpenseStatus, getVendorBills } from '../services/expenseService';
import type { ExpenseStatus, ExpenseWithRelations } from '../types/expense';
import './Payments.css';
import './VendorBills.css';

export function VendorBills() {
  const [bills, setBills] = useState<ExpenseWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ExpenseStatus | 'overdue'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => { try { setLoading(true); setError(null); setBills(await getVendorBills()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load vendor bills.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => { const term = search.trim().toLowerCase(); return bills.filter((bill) => { const overdue = isOverdue(bill); const statusMatch = status === 'all' || (status === 'overdue' ? overdue : bill.status === status); const searchMatch = !term || [bill.supplier_invoice_number, bill.expense_number, bill.vendor_name, bill.category, bill.description, bill.payment_reference].some((value) => String(value ?? '').toLowerCase().includes(term)); return statusMatch && searchMatch; }); }, [bills, search, status]);
  const active = bills.filter((bill) => bill.status !== 'void');
  const open = active.filter((bill) => bill.status !== 'paid');
  const paid = active.filter((bill) => bill.status === 'paid');
  const overdue = open.filter(isOverdue);

  async function transition(bill: ExpenseWithRelations, next: ExpenseStatus) { if (!window.confirm(next === 'approved' ? `Approve vendor bill ${bill.supplier_invoice_number || bill.expense_number}?` : `Mark vendor bill ${bill.supplier_invoice_number || bill.expense_number} as paid?`)) return; try { setBusyId(bill.id); setError(null); await changeExpenseStatus(bill.id, next); setSuccess(`${bill.supplier_invoice_number || bill.expense_number} marked ${next}.`); await load(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Unable to update vendor bill.'); } finally { setBusyId(null); } }

  return <main className="vendor-bills-page">
    <section className="finance-page-header"><div><span>Accounts payable</span><h1>Vendor Bills</h1><p>Supplier invoices and amounts payable by SHAB.</p></div></section>
    <section className="finance-tabs"><Link to="/payments"><WalletCards size={17} />Client Invoices &amp; Payments</Link><Link to="/payments/vendor-bills" className="active"><FileText size={17} />Vendor Bills</Link></section>
    {error && <div className="vendor-bills-alert error"><AlertTriangle size={18} />{error}</div>}{success && <div className="vendor-bills-alert success"><CheckCircle2 size={18} />{success}</div>}
    <section className="vendor-bills-summary"><BillStat label="Total bills" value={totals(active)} /><BillStat label="Paid" value={totals(paid)} tone="paid" /><BillStat label="Open / unpaid" value={totals(open)} tone="open" /><BillStat label="Overdue" value={totals(overdue)} tone="overdue" /></section>
    <section className="vendor-bills-workspace"><div className="vendor-bills-toolbar"><label><Search size={16} /><input placeholder="Search supplier invoice, vendor, expense…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select><span>{visible.length} bills</span></div>
      <div className="vendor-bills-table-wrap"><table><thead><tr><th>Supplier Invoice</th><th>Vendor</th><th>Expense</th><th>Invoice / Due Date</th><th>Terms</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="vendor-bills-state"><LoaderCircle className="vendor-bills-spin" />Loading vendor bills…</td></tr> : visible.length === 0 ? <tr><td colSpan={8} className="vendor-bills-state">No vendor bills found.</td></tr> : visible.map((bill) => { const overdueBill = isOverdue(bill); return <tr key={bill.id} className={overdueBill ? 'overdue' : ''}><td><strong>{bill.supplier_invoice_number || 'Not recorded'}</strong><small>{bill.vendor?.tax_registration_number ? `TRN ${bill.vendor.tax_registration_number}` : ''}</small></td><td><strong>{bill.vendor_name || 'Unknown vendor'}</strong><small>{bill.vendor?.email || bill.vendor?.phone || ''}</small></td><td>{bill.category}<small>{bill.expense_number}</small></td><td>{bill.supplier_invoice_date ? formatDate(bill.supplier_invoice_date) : 'Not recorded'}<small>{bill.due_date ? `Due ${formatDate(bill.due_date)}` : 'No due date'}{overdueBill ? ` · ${daysOverdue(bill.due_date!)} days overdue` : ''}</small></td><td>{bill.payment_terms || 'Not recorded'}</td><td><strong>{money(Number(bill.total_amount), bill.currency)}</strong><small>VAT {money(Number(bill.input_vat_amount), bill.currency)}</small></td><td><span className={`vendor-bill-status ${bill.status}`}>{bill.status}</span>{overdueBill && <small className="vendor-bill-overdue">Overdue</small>}</td><td>{busyId === bill.id ? <LoaderCircle className="vendor-bills-spin" size={17} /> : <div className="vendor-bill-actions">{bill.status === 'draft' && <button type="button" onClick={() => void transition(bill, 'approved')}>Approve</button>}{bill.status === 'approved' && <button type="button" onClick={() => void transition(bill, 'paid')}>Mark Paid</button>}{bill.status === 'paid' && <span>Completed</span>}</div>}</td></tr>})}</tbody></table></div>
    </section>
  </main>;
}

function BillStat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) { return <article className={tone}><Clock3 size={19} /><div><span>{label}</span><strong>{value}</strong></div></article>; }
function localDateKey() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function isOverdue(bill: ExpenseWithRelations) { return bill.status !== 'paid' && bill.status !== 'void' && Boolean(bill.due_date && bill.due_date < localDateKey()); }
function daysOverdue(dueDate: string) { return Math.max(0, Math.floor((new Date(`${localDateKey()}T00:00:00`).getTime() - new Date(`${dueDate}T00:00:00`).getTime()) / 86400000)); }
function money(value: number, currency = 'AED') { const safe = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'AED'; return new Intl.NumberFormat('en-AE', { style: 'currency', currency: safe, maximumFractionDigits: 2 }).format(value); }
function totals(rows: ExpenseWithRelations[]) { if (!rows.length) return 'AED 0.00'; const grouped = rows.reduce<Record<string, number>>((result, row) => { result[row.currency] = (result[row.currency] ?? 0) + Number(row.total_amount); return result; }, {}); return Object.entries(grouped).map(([currency, value]) => money(value, currency)).join(' · '); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }

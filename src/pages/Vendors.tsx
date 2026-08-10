import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, CircleDollarSign, FileText, LoaderCircle, Mail, MapPin, Pencil, Phone, Plus, Search, Store, X } from 'lucide-react';

import { createExpenseVendor, getExpenses, getExpenseVendors, updateExpenseVendor } from '../services/expenseService';
import type { ExpenseVendor, ExpenseVendorInsert, ExpenseWithRelations } from '../types/expense';
import './Vendors.css';

const emptyForm = { name: '', trade_license_number: '', tax_registration_number: '', email: '', phone: '', address: '', notes: '', is_active: true };

export function Vendors() {
  const [vendors, setVendors] = useState<ExpenseVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('active');
  const [editing, setEditing] = useState<ExpenseVendor | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyVendor, setHistoryVendor] = useState<ExpenseVendor | null>(null);
  const [history, setHistory] = useState<ExpenseWithRelations[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); setVendors(await getExpenseVendors(true)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Unable to load vendors.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const matchesStatus = status === 'all' || (status === 'active' ? vendor.is_active : !vendor.is_active);
      const matchesSearch = !term || [vendor.name, vendor.trade_license_number, vendor.tax_registration_number, vendor.email, vendor.phone, vendor.address].some((value) => String(value ?? '').toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [search, status, vendors]);

  async function openHistory(vendor: ExpenseVendor) {
    setHistoryVendor(vendor); setHistoryLoading(true); setError(null);
    try { setHistory(await getExpenses({ vendorId: vendor.id })); }
    catch (historyError) { setError(historyError instanceof Error ? historyError.message : 'Unable to load vendor expenses.'); }
    finally { setHistoryLoading(false); }
  }

  async function toggleActive(vendor: ExpenseVendor) {
    const action = vendor.is_active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`${action === 'deactivate' ? 'Deactivate' : 'Reactivate'} ${vendor.name}? Historical expenses will remain unchanged.`)) return;
    try { setBusyId(vendor.id); setError(null); await updateExpenseVendor(vendor.id, { is_active: !vendor.is_active }); setSuccess(`${vendor.name} ${action}d.`); await load(); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : `Unable to ${action} vendor.`); }
    finally { setBusyId(null); }
  }

  return <main className="vendors-page">
    <section className="vendors-heading"><div><p>Supplier directory</p><h1>Vendors</h1><span>Maintain reusable supplier and payee information for expense records.</span></div><button type="button" onClick={() => setEditing('new')}><Plus size={17} />Add Vendor</button></section>
    {error && <div className="vendors-alert error"><AlertTriangle size={18} />{error}</div>}
    {success && <div className="vendors-alert success"><CheckCircle2 size={18} />{success}</div>}
    <section className="vendors-summary"><article><Store size={20} /><div><span>Active vendors</span><strong>{vendors.filter((vendor) => vendor.is_active).length}</strong></div></article><article><Store size={20} /><div><span>Inactive vendors</span><strong>{vendors.filter((vendor) => !vendor.is_active).length}</strong></div></article></section>
    <section className="vendors-workspace">
      <div className="vendors-toolbar"><label><Search size={16} /><input placeholder="Search name, TRN, licence, phone…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="active">Active vendors</option><option value="inactive">Inactive vendors</option><option value="all">All vendors</option></select><span>{visible.length} records</span></div>
      {loading ? <div className="vendors-empty"><LoaderCircle className="vendors-spin" />Loading vendors…</div> : visible.length === 0 ? <div className="vendors-empty"><Store size={28} /><strong>No vendors found</strong><span>Add a supplier or adjust the filters.</span></div> : <div className="vendors-grid">{visible.map((vendor) => <article key={vendor.id} className={!vendor.is_active ? 'inactive' : ''}>
        <header><div className="vendor-avatar">{vendor.name.slice(0, 2).toUpperCase()}</div><div><h2>{vendor.name}</h2><span className={vendor.is_active ? 'active' : 'inactive'}>{vendor.is_active ? 'Active' : 'Inactive'}</span></div></header>
        <dl><div><dt>Trade licence</dt><dd>{vendor.trade_license_number || 'Not recorded'}</dd></div><div><dt>Tax registration no.</dt><dd>{vendor.tax_registration_number || 'Not recorded'}</dd></div></dl>
        <section className="vendor-contact">{vendor.email && <span><Mail size={14} />{vendor.email}</span>}{vendor.phone && <span><Phone size={14} />{vendor.phone}</span>}{vendor.address && <span><MapPin size={14} />{vendor.address}</span>}{!vendor.email && !vendor.phone && !vendor.address && <span>No contact details recorded</span>}</section>
        {vendor.notes && <p>{vendor.notes}</p>}
        <footer><button type="button" onClick={() => void openHistory(vendor)}><FileText size={14} />Expenses</button><button type="button" onClick={() => setEditing(vendor)}><Pencil size={14} />Edit</button><button type="button" className={vendor.is_active ? 'deactivate' : 'reactivate'} disabled={busyId === vendor.id} onClick={() => void toggleActive(vendor)}>{busyId === vendor.id ? 'Saving…' : vendor.is_active ? 'Deactivate' : 'Reactivate'}</button></footer>
      </article>)}</div>}
    </section>
    {historyVendor && <VendorHistory vendor={historyVendor} expenses={history} loading={historyLoading} onClose={() => setHistoryVendor(null)} />}
    {editing && <VendorEditor vendor={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={async (vendor) => { setEditing(null); setSuccess(`${vendor.name} saved.`); await load(); }} />}
  </main>;
}

function VendorHistory({ vendor, expenses, loading, onClose }: { vendor: ExpenseVendor; expenses: ExpenseWithRelations[]; loading: boolean; onClose: () => void }) {
  const active = expenses.filter((expense) => expense.status !== 'void');
  const paid = active.filter((expense) => expense.status === 'paid');
  const outstanding = active.filter((expense) => expense.status !== 'paid');
  const overdue = outstanding.filter((expense) => expense.due_date && expense.due_date < localDateKey());
  const ageing = {
    current: outstanding.filter((expense) => !expense.due_date || daysOverdue(expense.due_date) <= 0),
    days30: overdue.filter((expense) => daysOverdue(expense.due_date!) <= 30),
    days60: overdue.filter((expense) => daysOverdue(expense.due_date!) > 30 && daysOverdue(expense.due_date!) <= 60),
    days90: overdue.filter((expense) => daysOverdue(expense.due_date!) > 60 && daysOverdue(expense.due_date!) <= 90),
    over90: overdue.filter((expense) => daysOverdue(expense.due_date!) > 90),
  };
  return createPortal(<div className="vendor-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="vendor-history-modal">
    <header><div><span>Vendor financial history</span><h2>{vendor.name}</h2></div><button type="button" onClick={onClose}><X size={19} /></button></header>
    {loading ? <div className="vendors-empty"><LoaderCircle className="vendors-spin" />Loading vendor expenses…</div> : <>
      <div className="vendor-history-summary"><article><FileText size={18} /><div><span>Transactions</span><strong>{active.length}</strong></div></article><article><CircleDollarSign size={18} /><div><span>Total spend</span><strong>{totalsByCurrency(active, 'total_amount')}</strong></div></article><article><CheckCircle2 size={18} /><div><span>Paid</span><strong>{totalsByCurrency(paid, 'total_amount')}</strong></div></article><article><AlertTriangle size={18} /><div><span>Open / unpaid</span><strong>{totalsByCurrency(outstanding, 'total_amount')}</strong></div></article><article><FileText size={18} /><div><span>Supplier VAT</span><strong>{totalsByCurrency(active, 'input_vat_amount')}</strong></div></article></div>
      <div className="vendor-ageing-grid"><article><span>Current / not due</span><strong>{totalsByCurrency(ageing.current, 'total_amount')}</strong><small>{ageing.current.length} items</small></article><article><span>1–30 days</span><strong>{totalsByCurrency(ageing.days30, 'total_amount')}</strong><small>{ageing.days30.length} overdue</small></article><article><span>31–60 days</span><strong>{totalsByCurrency(ageing.days60, 'total_amount')}</strong><small>{ageing.days60.length} overdue</small></article><article><span>61–90 days</span><strong>{totalsByCurrency(ageing.days90, 'total_amount')}</strong><small>{ageing.days90.length} overdue</small></article><article><span>Over 90 days</span><strong>{totalsByCurrency(ageing.over90, 'total_amount')}</strong><small>{ageing.over90.length} overdue</small></article></div>
      {expenses.length === 0 ? <div className="vendors-empty"><FileText size={27} /><strong>No vendor expenses</strong><span>No expense has been linked to this vendor.</span></div> : <div className="vendor-history-table-wrap"><table><thead><tr><th>Date / Number</th><th>Supplier Invoice / Due</th><th>Category</th><th>Description</th><th>Client / Matter</th><th>Net</th><th>VAT</th><th>Total</th><th>Status</th></tr></thead><tbody>{expenses.map((expense) => { const isOverdue = expense.status !== 'paid' && expense.status !== 'void' && Boolean(expense.due_date && expense.due_date < localDateKey()); return <tr key={expense.id} className={`${expense.status === 'void' ? 'void ' : ''}${isOverdue ? 'overdue' : ''}`}><td><strong>{formatDate(expense.expense_date)}</strong><small>{expense.expense_number}</small></td><td><strong>{expense.supplier_invoice_number || 'Not recorded'}</strong><small>{expense.due_date ? `Due ${formatDate(expense.due_date)}` : 'No due date'}{isOverdue ? ` · ${daysOverdue(expense.due_date!)} days overdue` : ''}</small></td><td>{expense.category}</td><td>{expense.description}</td><td>{expense.client?.full_name ?? 'Firm expense'}<small>{expense.case?.matter_number ?? expense.case?.case_number ?? ''}</small></td><td>{money(Number(expense.net_amount), expense.currency)}</td><td>{money(Number(expense.input_vat_amount), expense.currency)}</td><td><strong>{money(Number(expense.total_amount), expense.currency)}</strong></td><td><span className={`vendor-expense-status ${expense.status}`}>{expense.status}</span>{isOverdue && <small className="vendor-overdue-chip">Overdue</small>}</td></tr>})}</tbody></table></div>}
    </>}
  </section></div>, document.body);
}

function money(value: number, currency = 'AED') { const safe = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : 'AED'; return new Intl.NumberFormat('en-AE', { style: 'currency', currency: safe, maximumFractionDigits: 2 }).format(value); }
function totalsByCurrency(expenses: ExpenseWithRelations[], field: 'total_amount' | 'input_vat_amount') { if (expenses.length === 0) return 'AED 0.00'; const totals = expenses.reduce<Record<string, number>>((result, expense) => { const currency = expense.currency || 'AED'; result[currency] = (result[currency] ?? 0) + Number(expense[field] ?? 0); return result; }, {}); return Object.entries(totals).map(([currency, total]) => money(total, currency)).join(' · '); }
function localDateKey() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function daysOverdue(dueDate: string) { const today = new Date(`${localDateKey()}T00:00:00`); const due = new Date(`${dueDate}T00:00:00`); return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)); }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }

function VendorEditor({ vendor, onClose, onSaved }: { vendor?: ExpenseVendor; onClose: () => void; onSaved: (vendor: ExpenseVendor) => Promise<void> }) {
  const [form, setForm] = useState({ ...emptyForm, ...(vendor ?? {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.name.trim().length < 2) { setError('Enter the vendor or supplier name.'); return; }
    const input: ExpenseVendorInsert = { name: form.name.trim(), trade_license_number: form.trade_license_number?.trim() || null, tax_registration_number: form.tax_registration_number?.trim() || null, email: form.email?.trim() || null, phone: form.phone?.trim() || null, address: form.address?.trim() || null, notes: form.notes?.trim() || null, is_active: form.is_active };
    try { setSaving(true); setError(null); await onSaved(vendor ? await updateExpenseVendor(vendor.id, input) : await createExpenseVendor(input)); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to save vendor.'); }
    finally { setSaving(false); }
  }
  return createPortal(<div className="vendor-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><form className="vendor-modal" onSubmit={submit}>
    <header><div><span>Supplier directory</span><h2>{vendor ? 'Edit Vendor' : 'Add Vendor'}</h2></div><button type="button" onClick={onClose} disabled={saving}><X size={19} /></button></header>
    {error && <div className="vendors-alert error"><AlertTriangle size={17} />{error}</div>}
    <div className="vendor-form-grid"><label className="wide">Vendor / supplier name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus /></label><label>Trade licence number<input value={form.trade_license_number ?? ''} onChange={(event) => setForm({ ...form, trade_license_number: event.target.value })} /></label><label>Tax registration number<input value={form.tax_registration_number ?? ''} onChange={(event) => setForm({ ...form, tax_registration_number: event.target.value })} /></label><label>Email<input type="email" value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone<input value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="wide">Address<input value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label className="wide">Notes<textarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>
    <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? <LoaderCircle className="vendors-spin" size={16} /> : <CheckCircle2 size={16} />}{saving ? 'Saving…' : 'Save Vendor'}</button></footer>
  </form></div>, document.body);
}

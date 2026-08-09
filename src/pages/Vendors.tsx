import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, Mail, MapPin, Pencil, Phone, Plus, Search, Store, X } from 'lucide-react';

import { createExpenseVendor, getExpenseVendors, updateExpenseVendor } from '../services/expenseService';
import type { ExpenseVendor, ExpenseVendorInsert } from '../types/expense';
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
        <footer><button type="button" onClick={() => setEditing(vendor)}><Pencil size={14} />Edit</button><button type="button" className={vendor.is_active ? 'deactivate' : 'reactivate'} disabled={busyId === vendor.id} onClick={() => void toggleActive(vendor)}>{busyId === vendor.id ? 'Saving…' : vendor.is_active ? 'Deactivate' : 'Reactivate'}</button></footer>
      </article>)}</div>}
    </section>
    {editing && <VendorEditor vendor={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={async (vendor) => { setEditing(null); setSuccess(`${vendor.name} saved.`); await load(); }} />}
  </main>;
}

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
  return <div className="vendor-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><form className="vendor-modal" onSubmit={submit}>
    <header><div><span>Supplier directory</span><h2>{vendor ? 'Edit Vendor' : 'Add Vendor'}</h2></div><button type="button" onClick={onClose} disabled={saving}><X size={19} /></button></header>
    {error && <div className="vendors-alert error"><AlertTriangle size={17} />{error}</div>}
    <div className="vendor-form-grid"><label className="wide">Vendor / supplier name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus /></label><label>Trade licence number<input value={form.trade_license_number ?? ''} onChange={(event) => setForm({ ...form, trade_license_number: event.target.value })} /></label><label>Tax registration number<input value={form.tax_registration_number ?? ''} onChange={(event) => setForm({ ...form, tax_registration_number: event.target.value })} /></label><label>Email<input type="email" value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone<input value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="wide">Address<input value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label className="wide">Notes<textarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div>
    <footer><button type="button" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? <LoaderCircle className="vendors-spin" size={16} /> : <CheckCircle2 size={16} />}{saving ? 'Saving…' : 'Save Vendor'}</button></footer>
  </form></div>;
}

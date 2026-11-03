import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { privateSalesOwner } from '../lib/privateSales';
import { supabase } from '../lib/supabase';
import './PrivateSales.css';

const kinds = { closing: 'Closing', sourcing: 'Sourcing', agreement: 'Agreement prepared', advance: 'Advance received' };
type Kind = keyof typeof kinds;
type Entry = { id: string; earned_on: string; reference: string; kind: Kind; basis: number; paid: boolean };
type Rates = { monthly_salary: number; closing_rate: number; sourcing_rate: number; agreement_fee: number };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' });
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const commission = (row: Entry, rates: Rates) => row.kind === 'advance' ? 0 : row.kind === 'agreement'
  ? cents(rates.agreement_fee)
  : Math.round(cents(row.basis) * Math.round((row.kind === 'closing' ? rates.closing_rate : rates.sourcing_rate) * 10000) / 10000);

export function PrivateSales() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Opening your private ledger…</p>;
  return user?.id === privateSalesOwner ? <SalesLedger key={user.id} /> : <Navigate to="/" replace />;
}

function SalesLedger() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [rates, setRates] = useState<Rates | null>(null);
  const [loaded, setLoaded] = useState('');
  const [rows, setRows] = useState<Entry[]>([]);
  const [kind, setKind] = useState<Kind>('closing');
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [basis, setBasis] = useState('');
  const [paid, setPaid] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const read = async () => {
      const settings = await supabase.from('private_sales_settings').select('monthly_salary,closing_rate,sourcing_rate,agreement_fee').single();
      if (!active) return;
      if (settings.error) { setError('Could not load your private sales settings.'); return; }
      setRates(settings.data);
      const next = new Date(month + '-01T00:00:00Z');
      next.setUTCMonth(next.getUTCMonth() + 1);
      const entries: Entry[] = [];
      for (let offset = 0; ; offset += 250) {
        const result = await supabase.from('private_sales_entries').select('id,earned_on,reference,kind,basis,paid')
          .gte('earned_on', month + '-01').lt('earned_on', next.toISOString().slice(0, 10))
          .order('earned_on', { ascending: false }).order('id').range(offset, offset + 249);
        if (!active) return;
        if (result.error) { setError('Could not load this month’s entries.'); return; }
        entries.push(...result.data);
        if (result.data.length < 250) break;
      }
      setRows(entries);
      setLoaded(month);
    };
    void read();
    return () => { active = false; };
  }, [month, refresh]);

  const reset = () => { setEditing(null); setReference(''); setBasis(''); setPaid(false); };
  const startEntry = (type: Kind) => {
    reset();
    setKind(type);
    setDate(today().startsWith(month + '-') ? today() : month + '-01');
    setError('');
    requestAnimationFrame(() => document.getElementById('sales-entry-reference')?.focus());
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !reference.trim() || !date.startsWith(month + '-')) return;
    setBusy(true); setError('');
    try {
      const values = { earned_on: date, reference: reference.trim(), kind, basis: kind === 'agreement' ? 1 : Number(basis), paid: kind === 'advance' ? false : paid };
      const table = supabase.from('private_sales_entries');
      const result = await (editing ? table.update(values).eq('id', editing) : table.insert(values)).select('id').single();
      if (result.error) throw result.error;
      reset(); setLoaded(''); setRefresh(n => n + 1);
    } catch { setError('Could not save the entry. Please try again.'); }
    finally { setBusy(false); }
  };

  const total = rates ? rows.reduce((sum, row) => sum + commission(row, rates), 0) : 0;
  const unpaid = rates ? rows.reduce((sum, row) => sum + (row.paid ? 0 : commission(row, rates)), 0) : 0;
  const advances = rows.reduce((sum, row) => sum + (row.kind === 'advance' ? cents(row.basis) : 0), 0);
  const gross = rates ? cents(rates.monthly_salary) + total : 0;
  const paidCommission = total - unpaid;
  const net = gross - advances;
  const balance = net - paidCommission;
  const reconciliation = rates ? [
    ['Base salary', cents(rates.monthly_salary)],
    ['Commission earned', total],
    ['Gross earnings', gross],
    ['Less: advances received', -advances],
    ['Net earnings after advances', net],
    ['Less: commission already paid', -paidCommission],
    ['Month-end balance payable', balance],
  ] as const : [];
  const exportSheet = async () => {
    if (!rates || loaded !== month) return;
    try {
      const xlsx = await import('xlsx');
      const book = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
        ['Month', month], ['Currency', 'AED'],
        ...reconciliation.map(([label, amount]) => [label, amount / 100]),
      ]), 'Month-end summary');
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
        ['Earned / received date', 'Reference', 'Type', 'Eligible amount (AED)', 'Commission earned (AED)', 'Advance received (AED)', 'Payment status'],
        ...rows.map(row => [row.earned_on, row.reference, kinds[row.kind],
          row.kind === 'agreement' || row.kind === 'advance' ? null : row.basis,
          row.kind === 'advance' ? null : commission(row, rates) / 100,
          row.kind === 'advance' ? row.basis : null,
          row.kind === 'advance' ? 'Received' : row.paid ? 'Paid' : 'Unpaid']),
      ]), 'Entries');
      xlsx.writeFile(book, 'Private-sales-' + month + '.xlsx');
    } catch { setError('Could not download the spreadsheet.'); }
  };

  return <section className="private-sales">
    <h1>My Sales &amp; Commission</h1>
    <p>Private to your app account. Figures are in AED.</p>
    <label>Reporting month <input type="month" value={month} disabled={busy} onChange={e => {
      if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
      setMonth(e.target.value); setDate(e.target.value + '-01'); setError(''); setLoaded(''); reset();
    }} /></label>
    {error && <p role="alert">{error}</p>}
    {(!rates || loaded !== month) ? (!error && <p role="status">Loading your ledger…</p>) : <>
      <div className="private-sales-actions">
        <button type="button" disabled={busy} onClick={() => startEntry('closing')}>+ Record commission</button>
        <button type="button" disabled={busy} onClick={() => startEntry('advance')}>+ Record advance</button>
        <button type="button" onClick={() => void exportSheet()}>Export month to Excel</button>
      </div>
      <div className="private-sales-totals">
        <div>Gross earnings<strong>{money.format(gross / 100)}</strong></div>
        <div>Advances received<strong>{money.format(advances / 100)}</strong></div>
        <div>{balance < 0 ? 'Paid above this month’s earnings' : 'Remaining payable'}<strong>{money.format(Math.abs(balance) / 100)}</strong></div>
      </div>
      <div className="private-sales-table">
        <h2>Month-end reconciliation</h2>
        <p>Salary and earned commission, less advances received and commissions already paid. {balance < 0 && 'A negative balance shows an overpayment for this month; it does not automatically carry forward.'}</p>
        <table><tbody>{reconciliation.map(([label, amount]) =>
          <tr key={label}><th scope="row">{label}</th><td>{money.format(amount / 100)}</td></tr>
        )}</tbody></table>
      </div>
      <form onSubmit={save}>
        <h2>{kind === 'advance' ? (editing ? 'Edit advance' : 'Record advance') : (editing ? 'Edit commission' : 'Record commission')}</h2>
        <p>{kind === 'advance' ? 'Use the date you received the money. The advance reduces this month’s balance. Use a bank transfer reference or a short note such as “November salary advance”.' : 'Enter the eligible amount for closing or sourcing. For agreements, record one entry per agreement.'} Record each payment once.</p>
        <div className="private-sales-fields">
          <label>{kind === 'advance' ? 'Date received' : 'Earned date'}<input required type="date" value={date} min={month + '-01'} onChange={e => setDate(e.target.value)} /></label>
          <label>{kind === 'advance' ? 'Payment reference' : 'Client or agreement reference'}<input id="sales-entry-reference" required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></label>
          {kind !== 'advance' && <label>Commission type<select value={kind} onChange={e => setKind(e.target.value as Kind)}>
            <option value="closing">Closing ({rates.closing_rate * 100}%)</option>
            <option value="sourcing">Sourcing ({rates.sourcing_rate * 100}%)</option>
            <option value="agreement">Agreement prepared ({money.format(rates.agreement_fee)})</option>
          </select></label>}
          {kind !== 'agreement' && <label>{kind === 'advance' ? 'Advance received (AED)' : 'Eligible amount (AED)'}<input required type="number" min="0.01" max="9999999999.99" step="0.01" value={basis} onChange={e => setBasis(e.target.value)} /></label>}
          {kind !== 'advance' && <label><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Commission paid</label>}
        </div>
        {date && !date.startsWith(month + '-') && <p>Select a date in the reporting month.</p>}
        <button disabled={busy || !date.startsWith(month + '-')}>{busy ? 'Saving…' : kind === 'advance' ? 'Save advance' : 'Save commission'}</button>
        {editing && <button type="button" disabled={busy} onClick={() => startEntry(kind)}>Cancel edit</button>}
      </form>
      {rows.length === 0 ? <p>No commission or advance entries this month.</p> : <div className="private-sales-table"><table>
        <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Eligible amount</th><th>Commission earned</th><th>Advance received</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td>{row.earned_on}</td><td>{row.reference}</td><td>{kinds[row.kind]}</td>
          <td>{row.kind === 'agreement' || row.kind === 'advance' ? '—' : money.format(row.basis)}</td><td>{row.kind === 'advance' ? '—' : money.format(commission(row, rates) / 100)}</td><td>{row.kind === 'advance' ? money.format(row.basis) : '—'}</td>
          <td>{row.kind === 'advance' ? 'Received' : row.paid ? 'Paid' : 'Unpaid'}</td><td><button type="button" disabled={busy} onClick={() => {
            setEditing(row.id); setDate(row.earned_on); setReference(row.reference); setKind(row.kind);
            setBasis(String(row.basis)); setPaid(row.paid);
            requestAnimationFrame(() => document.getElementById('sales-entry-reference')?.focus());
          }}>Edit</button></td></tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}

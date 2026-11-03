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
  const { user } = useAuth();
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
  const balance = rates ? cents(rates.monthly_salary) + unpaid - advances : 0;
  const exportSheet = async () => {
    if (!rates || loaded !== month) return;
    try {
      const xlsx = await import('xlsx');
      const book = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
        ['Month', month], ['Currency', 'AED'], ['Monthly base salary', rates.monthly_salary],
        ['Commission earned', total / 100], ['Commission unpaid', unpaid / 100],
        ['Advances received', advances / 100], ['Balance after advances and paid commissions', balance / 100],
        ['Salary + commission earned', (cents(rates.monthly_salary) + total) / 100],
      ]), 'Summary');
      xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
        ['Earned date', 'Reference', 'Type', 'Eligible amount or advance (AED)', 'Commission (AED)', 'Payment status'],
        ...rows.map(row => [row.earned_on, row.reference, kinds[row.kind], row.kind === 'agreement' ? null : row.basis,
          commission(row, rates) / 100, row.kind === 'advance' ? 'Received' : row.paid ? 'Paid' : 'Unpaid']),
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
      <div className="private-sales-totals">
        {Object.entries({ 'Monthly base salary': cents(rates.monthly_salary), 'Commission earned': total,
          'Commission unpaid': unpaid, 'Advances received': advances, 'Balance after advances and paid commissions': balance, 'Salary + commission earned': cents(rates.monthly_salary) + total })
          .map(([label, amount]) => <div key={label}>{label}<strong>{money.format(amount / 100)}</strong></div>)}
      </div>
      <form onSubmit={save}>
        <h2>{editing ? 'Edit entry' : 'Add entry'}</h2>
        <p>Enter the eligible amount you want to apply commission to. Enter an advance once; do not also mark a commission as paid for that same payment.</p>
        <div className="private-sales-fields">
          <label>Earned date<input required type="date" value={date} min={month + '-01'} onChange={e => setDate(e.target.value)} /></label>
          <label>Client or agreement reference<input required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} /></label>
          <label>Commission type<select value={kind} onChange={e => setKind(e.target.value as Kind)}>
            <option value="closing">Closing ({rates.closing_rate * 100}%)</option>
            <option value="sourcing">Sourcing ({rates.sourcing_rate * 100}%)</option>
            <option value="advance">Advance received</option>
            <option value="agreement">Agreement prepared ({money.format(rates.agreement_fee)})</option>
          </select></label>
          {kind !== 'agreement' && <label>{kind === 'advance' ? 'Advance received (AED)' : 'Eligible amount (AED)'}<input required type="number" min="0.01" max="9999999999.99" step="0.01" value={basis} onChange={e => setBasis(e.target.value)} /></label>}
          {kind !== 'advance' && <label><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Commission paid</label>}
        </div>
        {date && !date.startsWith(month + '-') && <p>Select a date in the reporting month.</p>}
        <button disabled={busy || !date.startsWith(month + '-')}>{busy ? 'Saving…' : 'Save entry'}</button>
        {editing && <button type="button" disabled={busy} onClick={reset}>Cancel edit</button>}
      </form>
      <button type="button" onClick={() => void exportSheet()}>Export month to Excel</button>
      {rows.length === 0 ? <p>No commission entries this month.</p> : <div className="private-sales-table"><table>
        <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Eligible amount / advance</th><th>Commission</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td>{row.earned_on}</td><td>{row.reference}</td><td>{kinds[row.kind]}</td>
          <td>{row.kind === 'agreement' ? '—' : money.format(row.basis)}</td><td>{money.format(commission(row, rates) / 100)}</td>
          <td>{row.kind === 'advance' ? 'Received' : row.paid ? 'Paid' : 'Unpaid'}</td><td><button type="button" disabled={busy} onClick={() => {
            setEditing(row.id); setDate(row.earned_on); setReference(row.reference); setKind(row.kind);
            setBasis(String(row.basis)); setPaid(row.paid);
          }}>Edit</button></td></tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}

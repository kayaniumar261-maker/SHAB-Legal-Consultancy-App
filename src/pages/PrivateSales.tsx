import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { privateSalesOwner } from '../lib/privateSales';
import { supabase } from '../lib/supabase';
import './PrivateSales.css';
import { downloadSalesPdf } from '../lib/salesReportPdf';

const kinds = { closing: 'Closing', sourcing: 'Sourcing', agreement: 'Agreement prepared', advance: 'Advance received' };
type Kind = keyof typeof kinds;
type Entry = { id: string; earned_on: string; reference: string; kind: Kind; basis: number; paid: boolean };
type Rates = { monthly_salary: number; closing_rate: number; sourcing_rate: number; agreement_fee: number; opening_month: string | null; opening_balance: number };
const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
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
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [rates, setRates] = useState<Rates | null>(null);
  const [loaded, setLoaded] = useState('');
  const [rows, setRows] = useState<Entry[]>([]);
  const [kind, setKind] = useState<Kind>('closing');
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [basis, setBasis] = useState('');
  const [paid, setPaid] = useState(false);
  const [openForm, setOpenForm] = useState<'entry' | 'advance' | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [advanceDate, setAdvanceDate] = useState(today);
  const [advanceReference, setAdvanceReference] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const read = async () => {
      const settings = await supabase.from('private_sales_settings').select('monthly_salary,closing_rate,sourcing_rate,agreement_fee,opening_month,opening_balance').single();
      if (!active) return;
      if (settings.error) { setError('Could not load your private sales settings.'); return; }
      setRates(settings.data);
      const next = new Date(month + '-01T00:00:00Z');
      next.setUTCMonth(next.getUTCMonth() + 1);
      const entries: Entry[] = [];
      const firstSalary = settings.data.opening_month ? new Date(settings.data.opening_month + 'T00:00:00Z') : null;
      firstSalary?.setUTCMonth(firstSalary.getUTCMonth() + 1);
      const firstEntry = settings.data.opening_month ?? month + '-01';
      for (let offset = 0; ; offset += 250) {
        const result = await supabase.from('private_sales_entries').select('id,earned_on,reference,kind,basis,paid')
          .gte('earned_on', firstEntry).lt('earned_on', next.toISOString().slice(0, 10))
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

  const deleteEntry = async (row: Entry) => {
    if (busy || !window.confirm('Delete ' + row.reference + ' dated ' + row.earned_on + ' (' + money.format(row.kind === 'advance' ? row.basis : rates ? commission(row, rates) / 100 : 0) + ')? This will recalculate this month and later carry-forwards.')) return;
    setBusy(true); setError('');
    try {
      const result = await supabase.from('private_sales_entries').delete().eq('id', row.id).select('id').single();
      if (result.error) throw result.error;
      if (editing === row.id) { setEditing(null); setOpenForm(null); }
      setLoaded(''); setRefresh(n => n + 1);
    } catch { setError('Could not delete the entry. Please try again.'); }
    finally { setBusy(false); }
  };
  const reset = () => { setEditing(null); setReference(''); setBasis(''); setPaid(false); };
  const startEntry = (type: Kind) => {
    reset();
    setOpenForm('entry');
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
      reset(); setOpenForm(null); setLoaded(''); setRefresh(n => n + 1);
    } catch { setError('Could not save the entry. Please try again.'); }
    finally { setBusy(false); }
  };

  const startMonth = rates?.opening_month?.slice(0, 7);
  const openingOnly = Boolean(startMonth && month <= startMonth);
  const monthRows = rows.filter(row => row.earned_on.startsWith(month + '-'));
  const salary = rates && !openingOnly ? cents(rates.monthly_salary) : 0;
  const opening = rates && startMonth && month >= startMonth
    ? cents(rates.opening_balance)
      + Math.max(0, monthIndex(month) - monthIndex(startMonth) - 1) * cents(rates.monthly_salary)
      + rows.filter(row => row.earned_on < month + '-01').reduce((sum, row) =>
        sum + (row.kind === 'advance' ? -cents(row.basis) : row.paid ? 0 : commission(row, rates)), 0)
    : 0;
  const total = rates ? monthRows.reduce((sum, row) => sum + commission(row, rates), 0) : 0;
  const unpaid = rates ? monthRows.reduce((sum, row) => sum + (row.paid ? 0 : commission(row, rates)), 0) : 0;
  const advances = monthRows.reduce((sum, row) => sum + (row.kind === 'advance' ? cents(row.basis) : 0), 0);
  const gross = salary + total;
  const paidCommission = total - unpaid;
  const net = gross - advances;
  const balance = opening + net - paidCommission;
  const reconciliation = rates ? [
    [month === startMonth ? 'Opening balance' : 'Balance brought forward', Math.max(0, opening)],
    ['Base salary', salary],
    ['Commission earned', total],
    ['Total available', Math.max(0, opening) + gross],
    ['Less: excess deductions brought forward', Math.max(0, -opening)],
    ['Less: advances received', advances],
    ['Less: commission already paid', paidCommission],
    ['Month-end amount payable', Math.max(0, balance)],
    ['Excess deductions carried to next month', Math.max(0, -balance)],
  ] as const : [];
  const advancePreview = balance - cents(Number(advanceAmount) || 0);
  const commissionPreview = rates ? commission({ id: '', earned_on: date, reference, kind, basis: Number(basis) || 0, paid }, rates) : 0;
  const saveNewAdvance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const received = String(fields.get('received') ?? '');
    const paymentReference = String(fields.get('reference') ?? '').trim();
    if (!received.startsWith(month + '-') || !paymentReference) {
      setError('Enter a payment reference and a received date in the reporting month.');
      return;
    }
    setBusy(true); setError('');
    try {
      const result = await supabase.from('private_sales_entries').insert({
        earned_on: received, reference: paymentReference, kind: 'advance', basis: Number(advanceAmount), paid: false,
      }).select('id').single();
      if (result.error) throw result.error;
      setAdvanceReference(''); setAdvanceAmount(''); setOpenForm(null); setLoaded(''); setRefresh(n => n + 1);
    } catch { setError('Could not save the advance. Please try again.'); }
    finally { setBusy(false); }
  };
  const exportReport = async (format: 'pdf' | 'xlsx') => {
    if (!rates || reportBusy) return;
    const from = reportFrom || startMonth || month;
    const to = reportTo || month;
    if (from > to || (startMonth && from < startMonth) || monthIndex(to) - monthIndex(from) > 119) {
      setError('Choose a valid range from the opening month onward, up to 120 months.'); return;
    }
    setReportBusy(true); setError('');
    try {
      const next = new Date(to + '-01T00:00:00Z'); next.setUTCMonth(next.getUTCMonth() + 1);
      const all: Entry[] = [];
      for (let offset = 0; ; offset += 250) {
        const result = await supabase.from('private_sales_entries').select('id,earned_on,reference,kind,basis,paid')
          .gte('earned_on', rates.opening_month ?? from + '-01').lt('earned_on', next.toISOString().slice(0, 10))
          .order('earned_on').order('id').range(offset, offset + 249);
        if (result.error) throw result.error;
        all.push(...result.data); if (result.data.length < 250) break;
      }
      const movement = (row: Entry) => row.kind === 'advance' ? -cents(row.basis) : row.paid ? 0 : commission(row, rates);
      let opening = cents(rates.opening_balance)
        + Math.max(0, monthIndex(from) - monthIndex(startMonth ?? from) - 1) * cents(rates.monthly_salary)
        + all.filter(row => row.earned_on < from + '-01').reduce((sum, row) => sum + movement(row), 0);
      const summary: (string | number)[][] = [['Month', 'Opening payable', 'Excess brought forward', 'Salary', 'Commission earned', 'Advances received', 'Commission paid', 'Closing payable', 'Excess carried forward']];
      const lines: string[] = ['Period: ' + from + ' to ' + to, 'Generated: ' + today(), ''];
      const current = new Date(from + '-01T00:00:00Z');
      while (current.toISOString().slice(0, 7) <= to) {
        const m = current.toISOString().slice(0, 7);
        const entries = all.filter(row => row.earned_on.startsWith(m + '-'));
        const salary = m === startMonth ? 0 : cents(rates.monthly_salary);
        const earned = entries.reduce((sum, row) => sum + commission(row, rates), 0);
        const advances = entries.reduce((sum, row) => sum + (row.kind === 'advance' ? cents(row.basis) : 0), 0);
        const paid = entries.reduce((sum, row) => sum + (row.paid ? commission(row, rates) : 0), 0);
        const closing = opening + salary + earned - advances - paid;
        const amounts = [Math.max(0, opening), Math.max(0, -opening), salary, earned, advances, paid, Math.max(0, closing), Math.max(0, -closing)];
        summary.push([m, ...amounts.map(n => n / 100)]);
        lines.push(m + ' — MONTHLY RECONCILIATION');
        summary[0].slice(1).forEach((label, i) => lines.push(label + ': ' + money.format(amounts[i] / 100)));
        lines.push('Transactions:');
        entries.forEach(row => {
          lines.push(row.earned_on + ' | ' + kinds[row.kind] + ' | ' + row.reference);
          lines.push(row.kind === 'advance' ? 'Advance received: ' + money.format(row.basis) :
            'Commission: ' + money.format(commission(row, rates) / 100) + ' | ' + (row.paid ? 'Paid' : 'Unpaid') +
            (row.kind === 'agreement' ? '' : ' | Eligible amount: ' + money.format(row.basis)));
        });
        if (!entries.length) lines.push('No transactions.');
        lines.push(''); opening = closing; current.setUTCMonth(current.getUTCMonth() + 1);
      }
      const filename = 'Private-sales-' + from + '-to-' + to;
      if (format === 'pdf') downloadSalesPdf('Sales & Commission Report', lines, filename + '.pdf');
      else {
        const xlsx = await import('xlsx'); const book = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet(summary), 'Monthly summary');
        xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([
          ['Date', 'Reference', 'Type', 'Eligible amount (AED)', 'Commission (AED)', 'Advance (AED)', 'Status'],
          ...all.filter(row => row.earned_on >= from + '-01').map(row => [row.earned_on, row.reference, kinds[row.kind],
            row.kind === 'advance' || row.kind === 'agreement' ? null : row.basis,
            row.kind === 'advance' ? null : commission(row, rates) / 100,
            row.kind === 'advance' ? row.basis : null, row.kind === 'advance' ? 'Received' : row.paid ? 'Paid' : 'Unpaid']),
        ]), 'Transactions');
        xlsx.writeFile(book, filename + '.xlsx');
      }
    } catch { setError('Could not generate the report. Please try again.'); }
    finally { setReportBusy(false); }
  };

  return <section className="private-sales">
    <h1>My Sales &amp; Commission</h1>
    <p>Private to your app account. Figures are in AED.</p>
    <label>Reporting month <input type="month" value={month} min={startMonth} disabled={busy} onChange={e => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) || (startMonth && e.target.value < startMonth)) return;
      setAdvanceAmount(''); setAdvanceReference(''); setAdvanceDate(e.target.value + '-01'); setOpenForm(null); setMonth(e.target.value); setDate(e.target.value + '-01'); setError(''); setLoaded(''); reset();
    }} /></label>
    {error && <p role="alert">{error}</p>}
    {(!rates || loaded !== month) ? (!error && <p role="status">Loading your ledger…</p>) : <>
      <fieldset disabled={reportBusy || busy}>
        <legend>Download report</legend>
        <div className="private-sales-fields">
          <label>From month<input type="month" min={startMonth} value={reportFrom || startMonth || month} onChange={e => setReportFrom(e.target.value)} /></label>
          <label>To month<input type="month" min={reportFrom || startMonth} value={reportTo || month} onChange={e => setReportTo(e.target.value)} /></label>
        </div>
        <button type="button" onClick={() => void exportReport('pdf')}>{reportBusy ? 'Preparing report…' : 'Download PDF'}</button>
        <button type="button" onClick={() => void exportReport('xlsx')}>Download Excel</button>
      </fieldset>
      <div className="private-sales-actions">
        <button type="button" disabled={busy || openingOnly} aria-expanded={openForm === 'entry' && kind !== 'advance'} onClick={() => { if (openForm === 'entry' && kind !== 'advance' && !editing) setOpenForm(null); else startEntry('closing'); }}>+ Record commission</button>
        <button type="button" disabled={busy || openingOnly} aria-expanded={openForm === 'advance'} onClick={() => { if (openForm === 'advance') { setOpenForm(null); return; } setOpenForm('advance'); requestAnimationFrame(() => document.getElementById('sales-advance-amount')?.focus()); }}>+ Record advance</button>

      </div>
      <div className="private-sales-totals">
        <div>Opening balance<strong>{money.format(Math.max(0, opening) / 100)}</strong></div>
        <div>Gross earnings<strong>{money.format(gross / 100)}</strong></div>
        <div>Advances received<strong>{money.format(advances / 100)}</strong></div>
        <div>Remaining payable<strong>{money.format(Math.max(0, balance) / 100)}</strong></div>
        <div>Excess deductions carried forward<strong>{money.format(Math.max(0, -balance) / 100)}</strong></div>
      </div>
      <div className="private-sales-table">
        <h2>Month-end reconciliation</h2>
        <p>{openingOnly ? 'Opening balance less payments received. No salary is added for this month. Any excess deductions carry into the next month.' : 'Previous balance plus salary and earned commission, less advances and commissions already paid. The closing balance carries into the next month.'}</p>
        <table><tbody>{reconciliation.map(([label, amount]) =>
          <tr key={label}><th scope="row">{label}</th><td>{money.format(amount / 100)}</td></tr>
        )}</tbody></table>
      </div>
      <div className="private-sales-forms">
      {openForm === 'entry' && <form onSubmit={save}>
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
        {kind !== 'advance' && <p aria-live="polite"><strong>Calculated commission: {money.format(commissionPreview / 100)}</strong></p>}
        <button disabled={busy || !date.startsWith(month + '-')}>{busy ? 'Saving…' : kind === 'advance' ? 'Save advance' : 'Save commission'}</button>
        <button type="button" disabled={busy} onClick={() => setOpenForm(null)}>Cancel</button>
      </form>}
      {openForm === 'advance' && <form key={month} onSubmit={saveNewAdvance}>
        <h2>Record advance</h2>
        <p>Record money already received. Each advance reduces the balance for its received month.</p>
        <label>Date received<input required name="received" type="date" min={month + '-01'} value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} /></label>
        <label>Payment reference<input required name="reference" value={advanceReference} onChange={e => setAdvanceReference(e.target.value)} maxLength={200} placeholder="Bank transfer reference or short note" /></label>
        <label>Amount received (AED)<input required id="sales-advance-amount" type="number" min="0.01" max="9999999999.99" step="0.01" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} /></label>
        <p aria-live="polite"><strong>{advancePreview < 0 ? 'Projected overpayment' : 'Remaining payable after this advance'}: {money.format(Math.abs(advancePreview) / 100)}</strong></p>
        <button disabled={busy}>{busy ? 'Saving…' : 'Save advance'}</button>
        <button type="button" disabled={busy} onClick={() => setOpenForm(null)}>Cancel</button>
      </form>}
      </div>
      {monthRows.length === 0 ? <p>No commission or advance entries this month.</p> : <div className="private-sales-table"><table>
        <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Eligible amount</th><th>Commission earned</th><th>Advance received</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{monthRows.map(row => <tr key={row.id}><td>{row.earned_on}</td><td>{row.reference}</td><td>{kinds[row.kind]}</td>
          <td>{row.kind === 'agreement' || row.kind === 'advance' ? '—' : money.format(row.basis)}</td><td>{row.kind === 'advance' ? '—' : money.format(commission(row, rates) / 100)}</td><td>{row.kind === 'advance' ? money.format(row.basis) : '—'}</td>
          <td>{row.kind === 'advance' ? 'Received' : row.paid ? 'Paid' : 'Unpaid'}</td><td><button type="button" disabled={busy} onClick={() => {
            setOpenForm('entry'); setEditing(row.id); setDate(row.earned_on); setReference(row.reference); setKind(row.kind);
            setBasis(String(row.basis)); setPaid(row.paid);
            requestAnimationFrame(() => document.getElementById('sales-entry-reference')?.focus());
          }}>Edit</button> <button type="button" disabled={busy} onClick={() => void deleteEntry(row)}>Delete</button></td></tr>)}</tbody>
      </table></div>}
    </>}
  </section>;
}

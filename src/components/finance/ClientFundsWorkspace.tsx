import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRightLeft,
  Banknote,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  WalletCards,
  X,
} from 'lucide-react';
import {
  allocateClientFunds,
  getClientFundReceipts,
  recordClientFunds,
  reversePaymentAllocation,
  reverseUnallocatedClientFunds,
} from '../../services/clientFundsService';
import { getInvoices } from '../../services/invoiceService';
import type { ClientFundReceiptWithAllocations, PaymentAllocation } from '../../types/clientFunds';
import type { Invoice } from '../../types/invoice';
import './ClientFundsWorkspace.css';

type Props = { clientId: string };
type Dialog =
  | { kind: 'record' }
  | { kind: 'allocate'; receipt: ClientFundReceiptWithAllocations }
  | { kind: 'reverse-funds'; receipt: ClientFundReceiptWithAllocations }
  | { kind: 'reverse-allocation'; allocation: PaymentAllocation }
  | null;

const today = () => new Date().toISOString().slice(0, 10);
const money = (amount: number, currency = 'AED') =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(amount);

export function ClientFundsWorkspace({ clientId }: Props) {
  const [receipts, setReceipts] = useState<ClientFundReceiptWithAllocations[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [fundRows, invoiceRows] = await Promise.all([
        getClientFundReceipts(clientId),
        getInvoices({ clientId, pageSize: 250 }),
      ]);
      setReceipts(fundRows);
      setInvoices(invoiceRows.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load client funds.');
    } finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => receipts.reduce((result, receipt) => ({
    received: result.received + Number(receipt.amount),
    allocated: result.allocated + Number(receipt.allocated_amount),
    available: result.available + Number(receipt.available_amount),
    reversed: result.reversed + Number(receipt.reversed_amount),
  }), { received: 0, allocated: 0, available: 0, reversed: 0 }), [receipts]);

  const invoiceMap = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);

  async function submit(action: () => Promise<unknown>) {
    try {
      setSubmitting(true); setError(null);
      await action();
      setDialog(null);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The financial action could not be completed.');
    } finally { setSubmitting(false); }
  }

  return <section className="client-funds-workspace">
    <header className="client-funds-header">
      <div><span className="client-funds-eyebrow"><ShieldCheck size={14} /> CONTROLLED CLIENT FUNDS</span><h2>Advance Funds & Allocations</h2><p>Record money received before invoicing and allocate it across this client’s invoices without losing the original receipt history.</p></div>
      <button type="button" className="client-funds-primary" onClick={() => setDialog({ kind: 'record' })}><Plus size={17} /> Record Client Funds</button>
    </header>

    <div className="client-funds-summary">
      <Summary icon={<ArrowDownToLine />} label="Funds Received" value={money(totals.received)} />
      <Summary icon={<ArrowRightLeft />} label="Allocated" value={money(totals.allocated)} />
      <Summary icon={<WalletCards />} label="Available Credit" value={money(totals.available)} accent />
      <Summary icon={<RotateCcw />} label="Reversed" value={money(totals.reversed)} />
    </div>

    {error && <div className="client-funds-error">{error}</div>}
    {loading ? <div className="client-funds-loading"><LoaderCircle className="client-funds-spin" /> Loading client funds…</div> : receipts.length === 0 ?
      <div className="client-funds-empty"><CircleDollarSign size={30} /><strong>No advance funds recorded</strong><span>Use “Record Client Funds” when this client pays before an invoice or sends one payment intended for several invoices.</span></div> :
      <div className="client-funds-list">{receipts.map((receipt) => <article className="client-fund-card" key={receipt.id}>
        <div className="client-fund-card-main">
          <div className="client-fund-receipt-icon"><Banknote size={22} /></div>
          <div><div className="client-fund-title"><strong>{receipt.receipt_number}</strong><Status value={receipt.status} /></div><span>{formatDate(receipt.payment_date)} · {receipt.payment_method || 'Method not specified'}{receipt.reference_number ? ` · Ref ${receipt.reference_number}` : ''}</span></div>
          <div className="client-fund-amount"><span>Received</span><strong>{money(Number(receipt.amount), receipt.currency)}</strong></div>
        </div>
        <div className="client-fund-balance-row"><div><span>Allocated</span><strong>{money(Number(receipt.allocated_amount), receipt.currency)}</strong></div><div><span>Available</span><strong>{money(Number(receipt.available_amount), receipt.currency)}</strong></div><div><span>Reversed</span><strong>{money(Number(receipt.reversed_amount), receipt.currency)}</strong></div><div className="client-fund-actions">{receipt.available_amount > 0 && <><button type="button" onClick={() => setDialog({ kind: 'allocate', receipt })}><ArrowRightLeft size={15} /> Allocate</button><button type="button" className="danger" onClick={() => setDialog({ kind: 'reverse-funds', receipt })}><RotateCcw size={15} /> Reverse Funds</button></>}</div></div>
        {receipt.notes && <p className="client-fund-notes">{receipt.notes}</p>}
        {receipt.allocations.length > 0 && <div className="client-fund-allocations"><h4>Allocation history</h4>{receipt.allocations.map((allocation) => {
          const invoice = invoiceMap.get(allocation.invoice_id);
          const activeAmount = Number(allocation.amount) - Number(allocation.reversed_amount);
          return <div className="client-fund-allocation" key={allocation.id}><div><strong>{invoice?.invoice_number || 'Invoice'}</strong><span>{formatDate(allocation.allocation_date)}{allocation.notes ? ` · ${allocation.notes}` : ''}</span></div><div><strong>{money(activeAmount, receipt.currency)}</strong>{allocation.reversed_amount > 0 && <span>{money(Number(allocation.reversed_amount), receipt.currency)} reversed</span>}</div>{activeAmount > 0 && <button type="button" onClick={() => setDialog({ kind: 'reverse-allocation', allocation })}><RotateCcw size={14} /> Reverse</button>}</div>;
        })}</div>}
      </article>)}</div>}

    {dialog && <ActionDialog dialog={dialog} invoices={invoices} submitting={submitting} onClose={() => !submitting && setDialog(null)} onRecord={(input) => submit(() => recordClientFunds({ clientId, ...input }))} onAllocate={(input) => submit(() => allocateClientFunds(input))} onReverseFunds={(input) => submit(() => reverseUnallocatedClientFunds(input))} onReverseAllocation={(input) => submit(() => reversePaymentAllocation(input))} />}
  </section>;
}

function Summary({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return <div className={accent ? 'accent' : ''}><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function Status({ value }: { value: ClientFundReceiptWithAllocations['status'] }) {
  return <span className={`client-fund-status ${value}`}>{value.replace('_', ' ')}</span>;
}

function ActionDialog({ dialog, invoices, submitting, onClose, onRecord, onAllocate, onReverseFunds, onReverseAllocation }: {
  dialog: Exclude<Dialog, null>; invoices: Invoice[]; submitting: boolean; onClose: () => void;
  onRecord: (input: { amount: number; currency: string; paymentDate: string; paymentMethod: string | null; referenceNumber: string | null; notes: string | null }) => void;
  onAllocate: (input: { receiptId: string; invoiceId: string; amount: number; allocationDate: string; notes: string | null }) => void;
  onReverseFunds: (input: { receiptId: string; amount: number; reversalDate: string; reason: string }) => void;
  onReverseAllocation: (input: { allocationId: string; amount: number; reversalDate: string; reason: string }) => void;
}) {
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [method, setMethod] = useState('Bank Transfer'); const [reference, setReference] = useState(''); const [notes, setNotes] = useState(''); const [invoiceId, setInvoiceId] = useState(''); const [reason, setReason] = useState('');
  const eligible = dialog.kind === 'allocate' ? invoices.filter((invoice) => invoice.currency === dialog.receipt.currency && !['draft', 'paid', 'credited', 'cancelled', 'written_off'].includes(invoice.status) && Number(invoice.balance_amount) > 0) : [];
  const selectedInvoice = eligible.find((invoice) => invoice.id === invoiceId);
  const maximum = dialog.kind === 'allocate' ? Math.min(dialog.receipt.available_amount, Number(selectedInvoice?.balance_amount ?? dialog.receipt.available_amount)) : dialog.kind === 'reverse-funds' ? dialog.receipt.available_amount : dialog.kind === 'reverse-allocation' ? Number(dialog.allocation.amount) - Number(dialog.allocation.reversed_amount) : undefined;
  const title = dialog.kind === 'record' ? 'Record Client Funds' : dialog.kind === 'allocate' ? 'Allocate Client Funds' : dialog.kind === 'reverse-funds' ? 'Reverse Unallocated Funds' : 'Reverse Allocation';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); const numericAmount = Number(amount);
    if (dialog.kind === 'record') onRecord({ amount: numericAmount, currency: 'AED', paymentDate: date, paymentMethod: method || null, referenceNumber: reference || null, notes: notes || null });
    else if (dialog.kind === 'allocate') onAllocate({ receiptId: dialog.receipt.id, invoiceId, amount: numericAmount, allocationDate: date, notes: notes || null });
    else if (dialog.kind === 'reverse-funds') onReverseFunds({ receiptId: dialog.receipt.id, amount: numericAmount, reversalDate: date, reason });
    else onReverseAllocation({ allocationId: dialog.allocation.id, amount: numericAmount, reversalDate: date, reason });
  }

  return <div className="client-funds-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="client-funds-dialog" onSubmit={handleSubmit}><header><div><span>CONTROLLED FINANCIAL ACTION</span><h3>{title}</h3></div><button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></header><div className="client-funds-dialog-body">
    {dialog.kind === 'allocate' && <><div className="client-funds-limit">Available from {dialog.receipt.receipt_number}<strong>{money(dialog.receipt.available_amount, dialog.receipt.currency)}</strong></div><label>Outstanding invoice<select required value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}><option value="">Select invoice</option>{eligible.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} — {money(Number(invoice.balance_amount), invoice.currency)} outstanding</option>)}</select></label>{eligible.length === 0 && <div className="client-funds-warning">There are no eligible outstanding invoices for this receipt currency.</div>}</>}
    {dialog.kind === 'reverse-funds' && <div className="client-funds-warning">This returns unallocated money to the client. The receipt and reversal remain permanently visible in financial history.</div>}
    {dialog.kind === 'reverse-allocation' && <div className="client-funds-warning">This removes the selected amount from the invoice and returns it to the receipt’s available client credit.</div>}
    <div className="client-funds-form-grid"><label>Amount<input required min="0.01" step="0.01" max={maximum} type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>{dialog.kind === 'record' ? 'Payment date' : dialog.kind === 'allocate' ? 'Allocation date' : 'Reversal date'}<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div>
    {dialog.kind === 'record' && <><div className="client-funds-form-grid"><label>Payment method<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Card</option><option>Other</option></select></label><label>Reference number<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Bank / cheque reference" /></label></div><label>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Purpose or payment instructions" /></label></>}
    {dialog.kind === 'allocate' && <label>Allocation notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional allocation note" /></label>}
    {(dialog.kind === 'reverse-funds' || dialog.kind === 'reverse-allocation') && <label>Reason for reversal<textarea required minLength={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="A meaningful audit reason is required" /></label>}
  </div><footer><button type="button" onClick={onClose}>Cancel</button><button className={dialog.kind.startsWith('reverse') ? 'danger' : 'primary'} type="submit" disabled={submitting || (dialog.kind === 'allocate' && !invoiceId)}>{submitting && <LoaderCircle className="client-funds-spin" size={15} />}{title}</button></footer></form></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

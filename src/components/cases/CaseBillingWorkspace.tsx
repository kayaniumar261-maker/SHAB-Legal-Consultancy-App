import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FilePlus2,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  X,
} from 'lucide-react';

import {
  changeFeeInstallmentStatus,
  createFeeAgreement,
  createFeeInstallment,
  generateInvoiceFromInstallment,
  getFeeAgreements,
  summarizeFeeAgreement,
  updateFeeAgreement,
  updateFeeInstallment,
} from '../../services/feeAgreementService';
import {
  getFinancialLedger,
  type FinancialLedgerSummary,
} from '../../services/financialLedgerService';
import type {
  FeeAgreementInsert,
  FeeAgreementWithInstallments,
  FeeBillingModel,
  FeeInstallment,
  FeeInstallmentInsert,
} from '../../types/feeAgreement';
import { FinancialLedger } from '../finance/FinancialLedger';
import './CaseBillingWorkspace.css';

type CaseBillingWorkspaceProps = {
  caseId: string;
  clientId: string;
};

const billingModels: Array<{ value: FeeBillingModel; label: string }> = [
  { value: 'fixed', label: 'Fixed fee' },
  { value: 'installments', label: 'Installments' },
  { value: 'milestones', label: 'Milestones' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'success_fee', label: 'Success fee' },
  { value: 'mixed', label: 'Mixed' },
];

const today = () => new Date().toISOString().slice(0, 10);

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

const emptyLedgerSummary: FinancialLedgerSummary = {
  invoiceCount: 0, paymentCount: 0, creditNoteCount: 0, reversalCount: 0,
  totalBilled: 0, grossCollected: 0, totalCredited: 0, totalReversed: 0,
  netCollected: 0, outstanding: 0, collectionRate: 0,
};

export function CaseBillingWorkspace({
  caseId,
  clientId,
}: CaseBillingWorkspaceProps) {
  const [agreements, setAgreements] = useState<FeeAgreementWithInstallments[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<FeeAgreementWithInstallments | null>(null);
  const [editingInstallment, setEditingInstallment] = useState<FeeInstallment | null>(null);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [ledgerSummary, setLedgerSummary] = useState<FinancialLedgerSummary>(emptyLedgerSummary);

  const loadAgreements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [rows, ledger] = await Promise.all([
        getFeeAgreements({ caseId }),
        getFinancialLedger({ caseId }),
      ]);
      setAgreements(rows);
      setLedgerSummary(ledger.summary);
      setSelectedId((current) =>
        rows.some((item) => item.id === current) ? current : rows[0]?.id ?? null,
      );
    } catch (loadError) {
      setAgreements([]);
      setLedgerSummary(emptyLedgerSummary);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load fee agreements.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadAgreements();
  }, [loadAgreements]);

  const selected = useMemo(
    () => agreements.find((item) => item.id === selectedId) ?? null,
    [agreements, selectedId],
  );
  const summary = useMemo(
    () => selected ? summarizeFeeAgreement(selected) : null,
    [selected],
  );
  const hasOpenAgreement = agreements.some((item) => ['draft', 'active'].includes(item.status));
  const netBillable = Math.max(0, ledgerSummary.totalBilled - ledgerSummary.totalCredited);
  const unbilledAgreementBalance = Math.max(0, (summary?.agreedFee ?? 0) - netBillable);

  async function changeAgreementStatus(status: 'completed' | 'cancelled') {
    if (!selected) return;
    let cancellationReason: string | null = null;
    if (status === 'cancelled') {
      cancellationReason = window.prompt('Reason for cancelling this fee agreement:')?.trim() || null;
      if (!cancellationReason) return;
    } else if (!window.confirm('Complete this fee agreement? No further installments can be changed afterward.')) {
      return;
    }
    try {
      setBusyId(selected.id); setError(null);
      await updateFeeAgreement(selected.id, { status, cancellation_reason: cancellationReason });
      await loadAgreements();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update agreement.');
    } finally { setBusyId(null); }
  }

  async function changeStatus(
    installment: FeeInstallment,
    status: 'planned' | 'ready' | 'waived' | 'cancelled',
  ) {
    let reason: string | undefined;
    if (status === 'waived' || status === 'cancelled') {
      reason = window.prompt(`Reason for marking this installment ${status}:`)?.trim();
      if (!reason) return;
    }

    try {
      setBusyId(installment.id);
      setError(null);
      await changeFeeInstallmentStatus(installment.id, status, reason);
      await loadAgreements();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update installment.');
    } finally {
      setBusyId(null);
    }
  }

  async function invoiceInstallment(installment: FeeInstallment) {
    try {
      setBusyId(installment.id);
      setError(null);
      await generateInvoiceFromInstallment(installment.id, today());
      await loadAgreements();
      setLedgerVersion((value) => value + 1);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to generate invoice.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="case-billing-workspace">
      <section className="fee-agreement-panel">
        <header className="fee-agreement-header">
          <div>
            <span className="case-billing-eyebrow">Engagement terms</span>
            <h3>Fee Agreement &amp; Installment Plan</h3>
            <p>Track the agreed professional fee before amounts become invoices and payments.</p>
          </div>
          {!hasOpenAgreement && <button className="fee-primary-button" type="button" onClick={() => setShowAgreementForm(true)}>
            <Plus size={16} /> New Agreement
          </button>}
        </header>

        {error && <div className="fee-message error"><AlertCircle size={17} />{error}</div>}

        {loading ? (
          <div className="fee-empty"><LoaderCircle className="fee-spin" size={23} /> Loading fee agreement…</div>
        ) : agreements.length === 0 ? (
          <div className="fee-empty">
            <CircleDollarSign size={30} />
            <strong>No fee agreement recorded</strong>
            <span>Create the engagement terms, then plan installments or milestones.</span>
          </div>
        ) : (
          <>
            {agreements.length > 1 && (
              <label className="fee-agreement-picker">
                Agreement
                <select value={selectedId ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
                  {agreements.map((agreement) => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreement.agreement_number} — {agreement.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selected && summary && (
              <div className="fee-agreement-content">
                <div className="fee-agreement-title-row">
                  <div>
                    <span>{selected.agreement_number}</span>
                    <h4>{selected.title}</h4>
                    <p>{billingModels.find((model) => model.value === selected.billing_model)?.label} · {selected.vat_rate}% VAT · {selected.status}</p>
                  </div>
                  {['draft', 'active'].includes(selected.status) && <div className="fee-agreement-actions">
                    <button className="fee-secondary-button" type="button" onClick={() => setEditingAgreement(selected)}><Pencil size={15} /> Edit</button>
                    <button className="fee-secondary-button" type="button" onClick={() => setShowInstallmentForm(true)}><CalendarClock size={16} /> Add Installment</button>
                    <button className="fee-secondary-button" type="button" disabled={busyId === selected.id} onClick={() => void changeAgreementStatus('completed')}>Complete</button>
                    <button className="fee-danger-button" type="button" disabled={busyId === selected.id} onClick={() => void changeAgreementStatus('cancelled')}>Cancel agreement</button>
                  </div>}
                </div>

                <div className="fee-dashboard-heading">
                  <div><CircleDollarSign size={18} /><strong>Case Financial Position</strong></div>
                  <span>Agreement and live ledger totals</span>
                </div>
                <div className="fee-summary-grid fee-dashboard-grid">
                  <FeeStat label="Agreed fee" value={money(summary.agreedFee, selected.currency)} />
                  <FeeStat label="Total invoiced" value={money(ledgerSummary.totalBilled, selected.currency)} />
                  <FeeStat label="Credited" value={money(ledgerSummary.totalCredited, selected.currency)} />
                  <FeeStat label="Net billable" value={money(netBillable, selected.currency)} />
                  <FeeStat label="Gross collected" value={money(ledgerSummary.grossCollected, selected.currency)} />
                  <FeeStat label="Reversed" value={money(ledgerSummary.totalReversed, selected.currency)} warning={ledgerSummary.totalReversed > 0} />
                  <FeeStat label="Net collected" value={money(ledgerSummary.netCollected, selected.currency)} />
                  <FeeStat label="Outstanding" value={money(ledgerSummary.outstanding, selected.currency)} warning={ledgerSummary.outstanding > 0} />
                  <FeeStat label="Unbilled agreement" value={money(unbilledAgreementBalance, selected.currency)} warning={unbilledAgreementBalance > 0} />
                </div>
                {(summary.nextInstallment || summary.overdueInstallments.length > 0) && <div className={`fee-plan-alert${summary.overdueInstallments.length ? ' overdue' : ''}`}>
                  <CalendarClock size={17} />
                  <div><strong>{summary.overdueInstallments.length ? `${summary.overdueInstallments.length} overdue installment${summary.overdueInstallments.length === 1 ? '' : 's'}` : 'Next installment'}</strong>
                  <span>{summary.overdueInstallments.length ? 'Review the overdue schedule before further billing.' : `${summary.nextInstallment?.title}${summary.nextInstallment?.due_date ? ` · ${formatDate(summary.nextInstallment.due_date)}` : ''}`}</span></div>
                </div>}

                <div className="fee-installments-heading">
                  <div><ReceiptText size={17} /><strong>Installment schedule</strong></div>
                  <span>{selected.installments.length} item{selected.installments.length === 1 ? '' : 's'}</span>
                </div>

                {selected.installments.length === 0 ? (
                  <div className="fee-installment-empty">No installments have been planned.</div>
                ) : (
                  <div className="fee-installment-list">
                    {selected.installments.map((installment) => (
                      <article className="fee-installment-row" key={installment.id}>
                        <div className="fee-installment-sequence">{installment.sequence_number}</div>
                        <div className="fee-installment-main">
                          <strong>{installment.title}</strong>
                          <span>{installment.due_date ? `Due ${formatDate(installment.due_date)}` : 'No due date'}{installment.milestone ? ` · ${installment.milestone}` : ''}</span>
                        </div>
                        <div className="fee-installment-amount">
                          <strong>{money(Number(installment.total_amount), selected.currency)}</strong>
                          <span>incl. VAT</span>
                        </div>
                        <span className={`fee-status ${installment.status}`}>{installment.status}</span>
                        <div className="fee-installment-actions">
                          {busyId === installment.id ? <LoaderCircle className="fee-spin" size={18} /> : (
                            <>
                              {installment.status === 'planned' && <button type="button" onClick={() => void changeStatus(installment, 'ready')}>Mark ready</button>}
                              {installment.status === 'planned' && <button type="button" onClick={() => setEditingInstallment(installment)}><Pencil size={13} /> Edit</button>}
                              {installment.status === 'ready' && <button type="button" onClick={() => void invoiceInstallment(installment)}><FilePlus2 size={14} /> Generate invoice</button>}
                              {['planned', 'ready'].includes(installment.status) && <button type="button" onClick={() => void changeStatus(installment, 'waived')}>Waive</button>}
                              {['planned', 'ready'].includes(installment.status) && <button type="button" onClick={() => void changeStatus(installment, 'cancelled')}>Cancel</button>}
                              {installment.status === 'paid' && <CheckCircle2 size={18} className="fee-paid-icon" />}
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <FinancialLedger
        key={`${caseId}-${ledgerVersion}`}
        caseId={caseId}
        title="Case Financial Ledger"
        description="Complete invoice, collection, credit-note and payment-reversal history for this legal matter."
      />

      {showAgreementForm && (
        <AgreementModal
          caseId={caseId}
          clientId={clientId}
          onClose={() => setShowAgreementForm(false)}
          onSaved={async () => { setShowAgreementForm(false); await loadAgreements(); }}
        />
      )}
      {editingAgreement && <AgreementModal caseId={caseId} clientId={clientId} agreement={editingAgreement} onClose={() => setEditingAgreement(null)} onSaved={async () => { setEditingAgreement(null); await loadAgreements(); }} />}
      {showInstallmentForm && selected && (
        <InstallmentModal
          agreement={selected}
          onClose={() => setShowInstallmentForm(false)}
          onSaved={async () => { setShowInstallmentForm(false); await loadAgreements(); }}
        />
      )}
      {editingInstallment && selected && <InstallmentModal agreement={selected} installment={editingInstallment} onClose={() => setEditingInstallment(null)} onSaved={async () => { setEditingInstallment(null); await loadAgreements(); }} />}
    </div>
  );
}

function FeeStat({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`fee-summary-stat${warning ? ' warning' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function AgreementModal({ caseId, clientId, agreement, onClose, onSaved }: {
  caseId: string; clientId: string; agreement?: FeeAgreementWithInstallments; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: agreement?.title ?? 'Professional Legal Fees', billing_model: agreement?.billing_model ?? 'installments' as FeeBillingModel,
    agreed_fee: agreement ? String(agreement.agreed_fee) : '', vat_rate: String(agreement?.vat_rate ?? 5), currency: agreement?.currency ?? 'AED', agreement_date: agreement?.agreement_date ?? today(),
    valid_from: agreement?.valid_from ?? today(), valid_until: agreement?.valid_until ?? '', hourly_rate: agreement?.hourly_rate ? String(agreement.hourly_rate) : '', success_fee_percentage: agreement?.success_fee_percentage ? String(agreement.success_fee_percentage) : '', notes: agreement?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || Number(form.agreed_fee) < 0 || form.agreed_fee === '') {
      setError('Enter an agreement title and valid agreed fee.'); return;
    }
    const payload: FeeAgreementInsert = {
      client_id: clientId, case_id: caseId, title: form.title.trim(), billing_model: form.billing_model,
      currency: form.currency.trim().toUpperCase(), agreed_fee: Number(form.agreed_fee), vat_rate: Number(form.vat_rate),
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      success_fee_percentage: form.success_fee_percentage ? Number(form.success_fee_percentage) : null,
      agreement_date: form.agreement_date, valid_from: form.valid_from || null, valid_until: form.valid_until || null,
      notes: form.notes.trim() || null, status: 'active',
    };
    try { setSaving(true); setError(null); if (agreement) { const { client_id, case_id, status, ...update } = payload; void client_id; void case_id; void status; await updateFeeAgreement(agreement.id, update); } else { await createFeeAgreement(payload); } await onSaved(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to create agreement.'); }
    finally { setSaving(false); }
  }

  return <FeeModal title={agreement ? 'Edit Fee Agreement' : 'New Fee Agreement'} onClose={onClose} saving={saving} onSubmit={submit} error={error}>
    <label className="fee-field fee-field-wide">Agreement title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
    <label className="fee-field">Billing model<select value={form.billing_model} onChange={(e) => setForm({ ...form, billing_model: e.target.value as FeeBillingModel })}>{billingModels.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}</select></label>
    <label className="fee-field">Agreement date<input type="date" value={form.agreement_date} onChange={(e) => setForm({ ...form, agreement_date: e.target.value })} required /></label>
    <label className="fee-field">Agreed fee<input type="number" min="0" step="0.01" value={form.agreed_fee} onChange={(e) => setForm({ ...form, agreed_fee: e.target.value })} required /></label>
    <label className="fee-field">VAT rate %<input type="number" min="0" max="100" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} required /></label>
    <label className="fee-field">Currency<input maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} required /></label>
    <label className="fee-field">Valid from<input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></label>
    <label className="fee-field">Valid until<input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></label>
    {form.billing_model === 'hourly' && <label className="fee-field">Hourly rate<input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></label>}
    {['success_fee', 'mixed'].includes(form.billing_model) && <label className="fee-field">Success fee %<input type="number" min="0" max="100" step="0.01" value={form.success_fee_percentage} onChange={(e) => setForm({ ...form, success_fee_percentage: e.target.value })} /></label>}
    <label className="fee-field fee-field-wide">Notes<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
  </FeeModal>;
}

function InstallmentModal({ agreement, installment, onClose, onSaved }: {
  agreement: FeeAgreementWithInstallments; installment?: FeeInstallment; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({ title: installment?.title ?? '', planned_subtotal: installment ? String(installment.planned_subtotal) : '', vat_rate: String(installment?.vat_rate ?? agreement.vat_rate), due_date: installment?.due_date ?? '', milestone: installment?.milestone ?? '', description: installment?.description ?? '', status: 'planned' as 'planned' | 'ready' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || Number(form.planned_subtotal) <= 0) { setError('Enter a title and an amount greater than zero.'); return; }
    const payload: FeeInstallmentInsert = {
      agreement_id: agreement.id, title: form.title.trim(), description: form.description.trim() || null,
      milestone: form.milestone.trim() || null, planned_subtotal: Number(form.planned_subtotal), vat_rate: Number(form.vat_rate),
      due_date: form.due_date || null, status: form.status,
    };
    try { setSaving(true); setError(null); if (installment) { const { agreement_id, status, ...update } = payload; void agreement_id; void status; await updateFeeInstallment(installment.id, update); } else { await createFeeInstallment(payload); } await onSaved(); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to create installment.'); }
    finally { setSaving(false); }
  }
  return <FeeModal title={installment ? 'Edit Planned Installment' : 'Add Installment'} onClose={onClose} saving={saving} onSubmit={submit} error={error}>
    <label className="fee-field fee-field-wide">Title<input placeholder="e.g. Initial engagement payment" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
    <label className="fee-field">Subtotal ({agreement.currency})<input type="number" min="0.01" step="0.01" value={form.planned_subtotal} onChange={(e) => setForm({ ...form, planned_subtotal: e.target.value })} required /></label>
    <label className="fee-field">VAT rate %<input type="number" min="0" max="100" step="0.01" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} required /></label>
    <label className="fee-field">Due date<input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
    {!installment && <label className="fee-field">Initial state<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'planned' | 'ready' })}><option value="planned">Planned</option><option value="ready">Ready to invoice</option></select></label>}
    <label className="fee-field fee-field-wide">Milestone<input placeholder="Optional milestone or deliverable" value={form.milestone} onChange={(e) => setForm({ ...form, milestone: e.target.value })} /></label>
    <label className="fee-field fee-field-wide">Description<textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
  </FeeModal>;
}

function FeeModal({ title, onClose, saving, onSubmit, error, children }: {
  title: string; onClose: () => void; saving: boolean; onSubmit: (event: React.FormEvent) => void;
  error: string | null; children: React.ReactNode;
}) {
  return <div className="fee-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="fee-modal" onSubmit={onSubmit}>
      <header><div><span className="case-billing-eyebrow">Billing setup</span><h3>{title}</h3></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={19} /></button></header>
      {error && <div className="fee-message error"><AlertCircle size={17} />{error}</div>}
      <div className="fee-form-grid">{children}</div>
      <footer><button className="fee-secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="fee-primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="fee-spin" size={16} /> : <Plus size={16} />} Save</button></footer>
    </form>
  </div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

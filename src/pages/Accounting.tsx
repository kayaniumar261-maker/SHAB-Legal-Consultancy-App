import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { getAccountingPayablesReport, type AccountingPayablesReport } from '../services/accountingPayablesService';
import { getCompanySettings, type CompanySettings } from '../services/companySettingsService';
import {
  getAccountingPeriods,
  getVatReport,
  saveAccountingPeriod,
  setAccountingPeriodLock,
} from '../services/vatAccountingService';
import type { AccountingPeriod, VatReport } from '../types/vatAccounting';
import './Accounting.css';
import './Accounting.mobile.css';

const dateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function currentQuarter() {
  const now = new Date();
  const startMonth = Math.floor(now.getMonth() / 3) * 3;
  return {
    from: dateValue(new Date(now.getFullYear(), startMonth, 1)),
    to: dateValue(new Date(now.getFullYear(), startMonth + 3, 0)),
  };
}

export function Accounting() {
  const quarter = useMemo(currentQuarter, []);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [periodForm, setPeriodForm] = useState({ start: quarter.from, end: quarter.to });
  const [reportForm, setReportForm] = useState({ from: quarter.from, to: quarter.to });
  const [report, setReport] = useState<VatReport | null>(null);
  const [payablesReport, setPayablesReport] = useState<AccountingPayablesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [company, accountingPeriods] = await Promise.all([
        getCompanySettings(),
        getAccountingPeriods(),
      ]);
      setSettings(company);
      setPeriods(accountingPeriods);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load accounting controls.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vatReady = Boolean(
    settings?.vat_registered &&
    settings.tax_registration_number?.replace(/\D/g, '').length === 15 &&
    settings.vat_effective_date,
  );

  async function createPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy('create-period');
      setError(null);
      setSuccess(null);
      await saveAccountingPeriod({ periodStart: periodForm.start, periodEnd: periodForm.end });
      setSuccess('Accounting period created. It remains open until explicitly locked.');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to create accounting period.');
    } finally {
      setBusy(null);
    }
  }

  async function togglePeriod(period: AccountingPeriod) {
    const locking = period.status !== 'locked';
    let reason = 'Reopened for an authorised accounting correction.';
    if (locking) {
      reason = window.prompt('Reason for locking this accounting period:')?.trim() ?? '';
      if (reason.length < 5) return;
      if (!window.confirm(`Lock ${formatDate(period.period_start)} to ${formatDate(period.period_end)}? Documents in this period cannot be financially changed.`)) return;
    } else if (!window.confirm('Reopen this accounting period? Financial documents may become editable again.')) {
      return;
    }

    try {
      setBusy(period.id);
      setError(null);
      setSuccess(null);
      await setAccountingPeriodLock({ periodId: period.id, locked: locking, reason });
      setSuccess(locking ? 'Accounting period locked.' : 'Accounting period reopened.');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to change the accounting-period lock.');
    } finally {
      setBusy(null);
    }
  }

  async function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy('report');
      setError(null);
      setSuccess(null);
      const [vatReview, payablesReview] = await Promise.all([
        getVatReport(reportForm.from, reportForm.to),
        getAccountingPayablesReport(reportForm.from, reportForm.to),
      ]);
      setReport(vatReview);
      setPayablesReport(payablesReview);
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Unable to generate the internal VAT review.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="accounting-page">
      <section className="accounting-heading">
        <div>
          <p className="accounting-eyebrow">Financial governance</p>
          <h1>Accounting Control Centre</h1>
          <p>Control accounting periods, VAT documents, vendor bills and supplier payments without changing the financial ledger.</p>
        </div>
        <span className={`accounting-registration ${vatReady ? 'ready' : 'pending'}`}>
          {vatReady ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
          {vatReady ? 'VAT controls active' : 'VAT registration pending'}
        </span>
      </section>

      {!vatReady && (
        <div className="accounting-notice">
          <AlertTriangle size={19} />
          <div>
            <strong>Internal readiness mode only</strong>
            <span>SHAB is not VAT registered. Reports on this page are internal reviews and must not be treated or submitted as an FTA VAT return.</span>
          </div>
        </div>
      )}

      {error && <div className="accounting-alert error"><AlertTriangle size={18} />{error}</div>}
      {success && <div className="accounting-alert success"><CheckCircle2 size={18} />{success}</div>}

      <section className="accounting-grid">
        <article className="accounting-card periods-card">
          <header>
            <div className="accounting-icon"><CalendarRange size={21} /></div>
            <div><h2>Accounting periods</h2><p>Lock completed periods to prevent backdated financial changes.</p></div>
          </header>

          <form className="period-form" onSubmit={createPeriod}>
            <label>Period start<input type="date" value={periodForm.start} onChange={(event) => setPeriodForm((current) => ({ ...current, start: event.target.value }))} required /></label>
            <label>Period end<input type="date" value={periodForm.end} onChange={(event) => setPeriodForm((current) => ({ ...current, end: event.target.value }))} required /></label>
            <button type="submit" disabled={busy === 'create-period'}><Plus size={16} />{busy === 'create-period' ? 'Creating…' : 'Create period'}</button>
          </form>

          <div className="period-list">
            {loading ? <div className="accounting-empty">Loading accounting periods…</div> : periods.length === 0 ? (
              <div className="accounting-empty">No periods have been created. Financial documents remain open.</div>
            ) : periods.map((period) => (
              <div className="period-row" key={period.id}>
                <div className={`period-state ${period.status}`}>
                  {period.status === 'locked' ? <Lock size={16} /> : <LockOpen size={16} />}
                </div>
                <div><strong>{formatDate(period.period_start)} — {formatDate(period.period_end)}</strong><span>{period.status === 'locked' ? period.lock_reason || 'Locked period' : 'Open for financial activity'}</span></div>
                <span className={`period-badge ${period.status}`}>{period.status}</span>
                <button type="button" className="period-action" disabled={busy === period.id} onClick={() => void togglePeriod(period)}>
                  {period.status === 'locked' ? 'Reopen' : 'Lock'}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="accounting-card report-card">
          <header>
            <div className="accounting-icon"><FileSpreadsheet size={21} /></div>
            <div><h2>VAT document review</h2><p>Reconcile issued invoices and credit notes for a selected tax-date range.</p></div>
          </header>

          <form className="report-form" onSubmit={generateReport}>
            <label>From<input type="date" value={reportForm.from} onChange={(event) => setReportForm((current) => ({ ...current, from: event.target.value }))} required /></label>
            <label>To<input type="date" value={reportForm.to} onChange={(event) => setReportForm((current) => ({ ...current, to: event.target.value }))} required /></label>
            <button type="submit" disabled={busy === 'report'}><RefreshCw size={16} />{busy === 'report' ? 'Reviewing…' : 'Generate review'}</button>
          </form>

          {!report ? <div className="accounting-empty report-empty"><BookOpenCheck size={25} />Select dates to generate an internal document review.</div> : (
            <ReportView report={report} vatReady={vatReady} />
          )}
        </article>
      </section>

      {payablesReport && <PayablesReportView report={payablesReport} vatReady={vatReady} />}
    </main>
  );
}


function PayablesReportView({ report, vatReady }: { report: AccountingPayablesReport; vatReady: boolean }) {
  const currency = report.currency ?? 'AED';
  function exportCsv() {
    const rows = [
      ['Transaction Type', 'Date', 'Expense Number', 'Supplier Invoice', 'Vendor', 'Category / Method', 'Reference', 'Net', 'Input VAT', 'Total / Payment', 'Paid', 'Balance', 'Currency'],
      ...report.bills.map((line) => ['Vendor Bill', line.date, line.expenseNumber, line.supplierInvoice ?? '', line.vendor, line.category, '', line.netAmount.toFixed(2), line.vatAmount.toFixed(2), line.totalAmount.toFixed(2), line.paidAmount.toFixed(2), line.balance.toFixed(2), line.currency]),
      ...report.payments.map((line) => ['Vendor Payment', line.date, line.expenseNumber, line.supplierInvoice ?? '', line.vendor, line.method, line.reference, '', '', line.amount.toFixed(2), '', '', line.currency]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `SHAB-payables-${report.dateFrom}-to-${report.dateTo}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  return <section className="accounting-card payables-report-card">
    <header><div className="accounting-icon"><BookOpenCheck size={21} /></div><div><h2>Accounts payable &amp; expense reconciliation</h2><p>Vendor bills and actual supplier-payment transactions for {formatDate(report.dateFrom)} — {formatDate(report.dateTo)}.</p></div><button type="button" className="payables-export" onClick={exportCsv}><Download size={15} />Export CSV</button></header>
    {report.hasMixedCurrencies && <div className="accounting-alert error payables-warning"><AlertTriangle size={17} />Mixed currencies detected. Review each currency separately; combined figures are informational only.</div>}
    <div className="payables-summary">
      <ReportStat label="Vendor bills" value={money(report.totalBills, currency)} />
      <ReportStat label="Firm overheads" value={money(report.firmOverheads, currency)} />
      <ReportStat label="Client disbursements" value={money(report.clientDisbursements, currency)} />
      <ReportStat label={vatReady ? 'Supplier input VAT' : 'Input VAT · informational'} value={money(report.informationalInputVat, currency)} />
      <ReportStat label="Payments made" value={money(report.paymentsMade, currency)} />
      <ReportStat label="Outstanding payables" value={money(report.outstanding, currency)} highlight />
      <ReportStat label="Overdue payables" value={money(report.overdue, currency)} highlight={report.overdue > 0} />
    </div>
    <div className="payables-tables">
      <section><h3>Vendor bills <span>{report.bills.length}</span></h3><div className="vat-lines-wrap"><table className="vat-lines payables-lines"><thead><tr><th>Date</th><th>Supplier invoice</th><th>Vendor</th><th>Category</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{report.bills.length === 0 ? <tr><td colSpan={7}>No vendor bills in this period.</td></tr> : report.bills.map((line) => <tr key={line.id}><td>{formatDate(line.date)}</td><td><strong>{line.supplierInvoice || line.expenseNumber}</strong><small>{line.expenseNumber}</small></td><td>{line.vendor}</td><td>{line.category}</td><td>{money(line.totalAmount, line.currency)}</td><td>{money(line.paidAmount, line.currency)}</td><td><strong>{money(line.balance, line.currency)}</strong></td></tr>)}</tbody></table></div></section>
      <section><h3>Vendor payments <span>{report.payments.length}</span></h3><div className="vat-lines-wrap"><table className="vat-lines payables-lines"><thead><tr><th>Date</th><th>Supplier invoice</th><th>Vendor</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{report.payments.length === 0 ? <tr><td colSpan={6}>No vendor payments in this period.</td></tr> : report.payments.map((line) => <tr key={line.id}><td>{formatDate(line.date)}</td><td><strong>{line.supplierInvoice || line.expenseNumber}</strong><small>{line.expenseNumber}</small></td><td>{line.vendor}</td><td>{line.method}</td><td>{line.reference}</td><td><strong>{money(line.amount, line.currency)}</strong></td></tr>)}</tbody></table></div></section>
    </div>
  </section>;
}

function ReportView({ report, vatReady }: { report: VatReport; vatReady: boolean }) {
  const currency = report.currency ?? 'AED';
  return (
    <div className="vat-report">
      <div className="vat-report-status"><strong>{vatReady ? 'VAT reconciliation' : 'Internal review — not for FTA filing'}</strong><span>{report.lines.length} document{report.lines.length === 1 ? '' : 's'}</span></div>
      {report.hasMixedCurrencies && <div className="accounting-alert error"><AlertTriangle size={17} />Mixed currencies detected. Review individual documents; totals must not be treated as a single-currency VAT return.</div>}
      <div className="vat-summary">
        <ReportStat label="Taxable sales" value={money(report.taxableSales, currency)} />
        <ReportStat label="Output VAT" value={money(report.outputVat, currency)} />
        <ReportStat label="Credited sales" value={money(report.creditedTaxableSales, currency)} />
        <ReportStat label="Credited VAT" value={money(report.creditedVat, currency)} />
        <ReportStat label="Net taxable sales" value={money(report.netTaxableSales, currency)} />
        <ReportStat label="Net VAT" value={money(report.netVat, currency)} highlight />
      </div>
      <div className="vat-lines-wrap">
        <table className="vat-lines">
          <thead><tr><th>Tax date</th><th>Document</th><th>Treatment</th><th>Taxable</th><th>VAT</th><th>Total</th></tr></thead>
          <tbody>{report.lines.length === 0 ? <tr><td colSpan={6}>No issued tax documents in this period.</td></tr> : report.lines.map((line) => (
            <tr key={`${line.documentType}-${line.id}`}><td>{formatDate(line.taxDate)}</td><td><strong>{line.documentNumber}</strong><small>{line.documentType.replace('_', ' ')}</small></td><td>{line.treatment.replace(/_/g, ' ')}</td><td>{money(line.taxableAmount, line.currency)}</td><td>{money(line.vatAmount, line.currency)}</td><td>{money(line.totalAmount, line.currency)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ReportStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`report-stat${highlight ? ' highlight' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function csvCell(value: unknown) { const text = String(value ?? ''); return /[\",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

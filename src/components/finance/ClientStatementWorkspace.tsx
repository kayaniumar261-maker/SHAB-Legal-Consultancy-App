import { tr, getLocale, useLocale } from '../../i18n/locale';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { CalendarRange, LoaderCircle, Printer, X } from 'lucide-react';
import { companyProfile } from '../../constants/companyProfile';
import {
  getClientStatement,
  type ClientStatement,
} from '../../services/clientStatementService';
import './ClientStatementWorkspace.css';

type Props = { clientId: string; clientName: string };

export function ClientStatementWorkspace({ clientId, clientName }: Props) {
  const interfaceLanguage = useLocale();
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState<ClientStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    try {
      setLoading(true); setError(null);
      setStatement(await getClientStatement({ clientId, dateFrom, dateTo }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to generate statement.');
    } finally { setLoading(false); }
  }

  function printStatement() {
    if (!statement) return;
    const original = document.title;
    const safeName = clientName.replace(/[^a-zA-Z0-9_-]+/g, '-');
    document.title = `Statement-of-Account-${safeName}-${statement.dateTo ?? 'All-Dates'}`;
    window.print();
    window.setTimeout(() => { document.title = original; }, 1000);
  }

  return <>
    <section className="client-statement-launcher">
      <div><CalendarRange size={20} /><div><strong>{tr("Client Statement of Account")}</strong><span>{tr("Opening balance, transactions and running balance across all matters.")}</span></div></div>
      <button type="button" onClick={() => setOpen(true)}><Printer size={16} />{" "}{tr("Create Statement")}</button>
    </section>
    {open && createPortal(<div className="client-statement-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="client-statement-modal">
        <header><div><span>{tr("FINANCIAL DOCUMENT")}</span><h3>{tr("Statement of Account")}</h3><p>{clientName}</p></div><button type="button" onClick={() => setOpen(false)} aria-label={tr("Close")}><X size={19} /></button></header>
        <div className="client-statement-controls">
          <label>{tr("From")}<input dir="ltr" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label>{tr("To")}<input dir="ltr" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <button type="button" onClick={() => void generate()} disabled={loading}>{loading ? <LoaderCircle className="statement-spin" size={16} /> : <CalendarRange size={16} />}{" "}{tr("Generate")}</button>
          <button type="button" onClick={printStatement} disabled={!statement}><Printer size={16} />{" "}{tr("Print / PDF")}</button>
        </div>
        {error && <div className="client-statement-error">{tr(error)}</div>}
        {statement ? <StatementView statement={statement} clientName={clientName} preview /> : <div className="client-statement-empty">{tr("Select a date range and generate the statement.")}</div>}
      </section>
    </div>, document.body)}
    {statement && createPortal(<div className="client-statement-print"><StatementView statement={statement} clientName={clientName} /></div>, document.body)}
  </>;
}

function StatementView({ statement, clientName, preview = false }: { statement: ClientStatement; clientName: string; preview?: boolean }) {
  const interfaceLanguage = useLocale();
  const format = (value: number) => new Intl.NumberFormat(getLocale("en-AE"), { style: 'currency', currency: statement.currency }).format(value);
  return <article className={`statement-document${preview ? ' preview' : ''}`}>
    <header><div className="statement-brand"><img src={companyProfile.logoUrl} alt="SHAB" /><div><strong>{companyProfile.legalName}</strong><span>{companyProfile.jurisdiction}</span></div></div><div className="statement-title"><span>{tr("CLIENT ACCOUNT")}</span><h1>{tr("Statement of Account")}</h1><strong>{statement.dateTo ?? tr("All Dates")}</strong></div></header>
    <div className="statement-rule" />
    <section className="statement-meta"><div><span>{tr("Account Holder")}</span><strong>{clientName}</strong></div><div><span>{tr("Statement Period")}</span><strong>{formatDate(statement.dateFrom)} – {formatDate(statement.dateTo)}</strong></div><div><span>{tr("Currency")}</span><strong>{statement.mixedCurrency ? tr("Multiple currencies") : statement.currency}</strong></div></section>
    {statement.mixedCurrency && <div className="statement-warning">{tr("This account contains multiple currencies. Amounts are displayed in their document currencies and must not be treated as a converted consolidated balance.")}</div>}
    <section className="statement-summary"><div><span>{tr("Opening Balance")}</span><strong>{format(statement.openingBalance)}</strong></div><div><span>{tr("Total Debits")}</span><strong>{format(statement.totalDebits)}</strong></div><div><span>{tr("Total Credits")}</span><strong>{format(statement.totalCredits)}</strong></div><div><span>{tr("Closing Balance")}</span><strong>{format(statement.closingBalance)}</strong></div></section>
    <table><thead><tr><th>{tr("Date")}</th><th>{tr("Document")}</th><th>{tr("Description / Matter")}</th><th>{tr("Debit")}</th><th>{tr("Credit")}</th><th>{tr("Balance")}</th></tr></thead><tbody>
      {statement.rows.length ? statement.rows.map((row) => <tr key={row.id}><td>{formatDate(row.date)}</td><td><strong>{row.documentNumber}</strong>{row.relatedDocumentNumber && <small>{row.relatedDocumentNumber}</small>}</td><td>{row.description}{row.caseReference && <small>{tr("Matter:")}{" "}{row.caseReference}</small>}</td><td>{row.debit ? format(row.debit) : '—'}</td><td>{row.credit ? format(row.credit) : '—'}</td><td>{format(row.runningBalance)}</td></tr>) : <tr><td colSpan={6} className="statement-no-rows">{tr("No transactions in this period.")}</td></tr>}
    </tbody></table>
    <footer>{tr("Generated electronically by the SHAB Practice Management System on")}{" "}{new Date(statement.generatedAt).toLocaleString(getLocale("en-AE"))}.</footer>
  </article>;
}

function formatDate(value: string | null) {
  if (!value) return 'Beginning';
  return new Intl.DateTimeFormat(getLocale("en-AE"), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

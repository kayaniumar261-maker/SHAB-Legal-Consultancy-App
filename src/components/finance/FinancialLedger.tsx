import { tr, getLocale, useLocale } from '../../i18n/locale';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  ExternalLink,
  FileMinus2,
  FileText,
  ReceiptText,
  RotateCcw,
  Search,
  WalletCards,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Link } from 'react-router-dom';

import {
  getFinancialLedger,
  type FinancialLedger as LedgerData,
  type FinancialLedgerEntry,
  type FinancialLedgerEntryKind,
  type FinancialLedgerScope,
} from '../../services/financialLedgerService';

import './FinancialLedger.css';

type LedgerFilter =
  | 'all'
  | FinancialLedgerEntryKind;

type FinancialLedgerProps = {
  clientId?: string;
  caseId?: string;

  title?: string;
  description?: string;

  showActions?: boolean;
};

const emptyLedger: LedgerData = {
  invoices: [],
  payments: [],
  creditNotes: [],
  paymentReversals: [],
  clientFundReceipts: [],
  paymentAllocations: [],
  paymentAllocationReversals: [],
  clientFundReversals: [],
  entries: [],

  summary: {
    invoiceCount: 0,
    paymentCount: 0,
    creditNoteCount: 0,
    reversalCount: 0,

    totalBilled: 0,
    grossCollected: 0,
    totalCredited: 0,
    totalReversed: 0,
    netCollected: 0,
    outstanding: 0,

    collectionRate: 0,
  },
};

export function FinancialLedger({
  clientId,
  caseId,
  title = 'Financial Ledger',
  description =
    'Complete invoice, collection and adjustment history.',
  showActions = true,
}: FinancialLedgerProps) {
  const interfaceLanguage = useLocale();
  const [ledger, setLedger] =
    useState<LedgerData>(
      emptyLedger,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState<LedgerFilter>('all');

  useEffect(() => {
    if (
      (!clientId && !caseId) ||
      (clientId && caseId)
    ) {
      setLedger(emptyLedger);
      setLoading(false);
      setError(
        'The ledger requires one client or one case scope.',
      );
      return;
    }

    let active = true;

    async function loadLedger() {
      setLoading(true);
      setError(null);

      try {
        const scope:
          FinancialLedgerScope =
          clientId
            ? {
                clientId,
              }
            : {
                caseId:
                  caseId as string,
              };

        const result =
          await getFinancialLedger(
            scope,
          );

        if (active) {
          setLedger(result);
        }
      } catch (loadError) {
        if (active) {
          setLedger(emptyLedger);

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load the financial ledger.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLedger();

    return () => {
      active = false;
    };
  }, [clientId, caseId]);

  const financeUrl =
    useMemo(() => {
      const parameters =
        new URLSearchParams();

      if (clientId) {
        parameters.set(
          'clientId',
          clientId,
        );
      }

      if (caseId) {
        parameters.set(
          'caseId',
          caseId,
        );
      }

      return `/payments?${parameters.toString()}`;
    }, [clientId, caseId, interfaceLanguage]);

  const visibleEntries =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return ledger.entries.filter(
        (entry) => {
          if (
            filter !== 'all' &&
            entry.kind !== filter
          ) {
            return false;
          }

          if (!term) {
            return true;
          }

          return [
            entry.documentNumber,
            entry.relatedDocumentNumber,
            entry.description,
            entry.status,
            formatEntryKind(
              entry.kind,
            ),
            entry.amount,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !== undefined,
            )
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(term),
            );
        },
      );
    }, [
      ledger.entries,
      search,
      filter,
    , interfaceLanguage]);

  if (loading) {
    return (
      <section className="financial-ledger-state">
        <WalletCards size={28} />

        <strong>{tr("Loading financial ledger…")}</strong>

        <span>{tr("Retrieving invoices, payments and adjustments.")}</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="financial-ledger-state error">
        <AlertCircle size={28} />

        <strong>{tr("Unable to load financial ledger")}</strong>

        <span>{tr(error)}</span>
      </section>
    );
  }

  return (
    <div className="financial-ledger">
      <header className="financial-ledger-header">
        <div>
          <span className="financial-ledger-eyebrow">{tr("Finance")}</span>

          <h3>{title}</h3>

          <p>{description}</p>
        </div>

        {showActions && (
          <div className="financial-ledger-header-actions">
            <Link
              className="secondary-action-button"
              to={financeUrl}
            >
              <ExternalLink size={16} />{tr("Open Finance")}</Link>

            <Link
              className="secondary-action-button"
              to={`${financeUrl}&tab=payments&createPayment=1`}
            >
              <BadgeDollarSign size={16} />{tr("Record Payment")}</Link>

            <Link
              className="primary-action-button"
              to={`${financeUrl}&tab=invoices&createInvoice=1`}
            >
              <FileText size={16} />{tr("New Invoice")}</Link>
          </div>
        )}
      </header>

      <section className="financial-ledger-summary">
        <LedgerStat
          icon={
            <ReceiptText size={18} />
          }
          label={tr("Total Billed")}
          value={formatCurrency(
            ledger.summary.totalBilled,
          )}
          helper={`${ledger.summary.invoiceCount} invoice${
            ledger.summary.invoiceCount === 1
              ? ''
              : 's'
          }`}
        />

        <LedgerStat
          icon={
            <ArrowDownLeft size={18} />
          }
          label={tr("Gross Collected")}
          value={formatCurrency(
            ledger.summary
              .grossCollected,
          )}
          helper={`${ledger.summary.paymentCount} payment${
            ledger.summary.paymentCount === 1
              ? ''
              : 's'
          }`}
          tone="success"
        />

        <LedgerStat
          icon={
            <FileMinus2 size={18} />
          }
          label={tr("Credited")}
          value={formatCurrency(
            ledger.summary.totalCredited,
          )}
          helper={`${ledger.summary.creditNoteCount} credit note${
            ledger.summary.creditNoteCount === 1
              ? ''
              : 's'
          }`}
          tone="credit"
        />

        <LedgerStat
          icon={
            <RotateCcw size={18} />
          }
          label={tr("Reversed")}
          value={formatCurrency(
            ledger.summary.totalReversed,
          )}
          helper={`${ledger.summary.reversalCount} reversal${
            ledger.summary.reversalCount === 1
              ? ''
              : 's'
          }`}
          tone="danger"
        />

        <LedgerStat
          icon={
            <WalletCards size={18} />
          }
          label={tr("Net Collected")}
          value={formatCurrency(
            ledger.summary.netCollected,
          )}
          helper={`${ledger.summary.collectionRate.toFixed(
            1,
          )}% collection rate`}
          tone="success"
        />

        <LedgerStat
          icon={
            <ArrowUpRight size={18} />
          }
          label={tr("Outstanding")}
          value={formatCurrency(
            ledger.summary.outstanding,
          )}
          helper="Current receivable"
          tone="warning"
        />
      </section>

      <section className="financial-ledger-toolbar">
        <label className="financial-ledger-search">
          <Search size={18} />

          <input dir="auto"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder={tr("Search document, invoice, status or reason")}
          />
        </label>

        <label className="financial-ledger-filter">
          <span>{tr("Document Type")}</span>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target
                  .value as LedgerFilter,
              )
            }
          >
            <option value="all">{tr("All transactions")}</option>

            <option value="invoice">{tr("Invoices")}</option>

            <option value="payment">{tr("Payments")}</option>

            <option value="credit_note">{tr("Credit notes")}</option>

            <option value="payment_reversal">{tr("Payment reversals")}</option>
            <option value="client_fund_receipt">{tr("Client funds")}</option>
            <option value="payment_allocation">{tr("Allocations")}</option>
            <option value="allocation_reversal">{tr("Allocation reversals")}</option>
            <option value="client_fund_reversal">{tr("Client fund reversals")}</option>
          </select>
        </label>
      </section>

      <section className="financial-ledger-history">
        <div className="financial-ledger-section-heading">
          <div>
            <WalletCards size={18} />

            <h4>{tr("Transaction History")}</h4>
          </div>

          <span>
            {visibleEntries.length}{' '}
            {visibleEntries.length === 1
              ? tr("record")
              : tr("records")}
          </span>
        </div>

        {ledger.entries.length === 0 ? (
          <LedgerEmpty
            title={tr("No financial activity")}
            message="Invoices, payments and adjustments linked to this record will appear here."
          />
        ) : visibleEntries.length === 0 ? (
          <LedgerEmpty
            title={tr("No matching transactions")}
            message="Try a different search term or document type."
          />
        ) : (
          <div className="financial-ledger-table-wrap">
            <table className="financial-ledger-table">
              <thead>
                <tr>
                  <th>{tr("Date")}</th>
                  <th>{tr("Type")}</th>
                  <th>{tr("Document")}</th>
                  <th>{tr("Status")}</th>
                  <th>{tr("Details")}</th>
                  <th>{tr("Amount")}</th>
                  <th>{tr("Action")}</th>
                </tr>
              </thead>

              <tbody>
                {visibleEntries.map(
                  (entry) => (
                    <LedgerRow
                      key={entry.id}
                      entry={entry}
                      financeUrl={
                        financeUrl
                      }
                    />
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LedgerStat({
  icon,
  label,
  value,
  helper,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
    | 'credit';
}) {
  const interfaceLanguage = useLocale();
  return (
    <article
      className={`financial-ledger-stat ${tone}`}
    >
      <div className="financial-ledger-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function LedgerRow({
  entry,
  financeUrl,
}: {
  entry: FinancialLedgerEntry;
  financeUrl: string;
}) {
  const interfaceLanguage = useLocale();
  return (
    <tr>
      <td>
        {formatDate(entry.date)}
      </td>

      <td>
        <span
          className={`financial-ledger-kind ${entry.kind}`}
        >
          {formatEntryKind(
            entry.kind,
          )}
        </span>
      </td>

      <td>
        <strong>
          {entry.documentNumber}
        </strong>

        {entry.relatedDocumentNumber && (
          <small className="financial-ledger-related">{tr("Related to")}{' '}
            {entry.relatedDocumentNumber}
          </small>
        )}
      </td>

      <td>
        <span
          className={`financial-ledger-status ${normaliseClass(
            entry.status,
          )}`}
        >
          {formatLabel(
            entry.status,
          )}
        </span>
      </td>

      <td>
        <span
          className="financial-ledger-description"
          title={entry.description}
        >
          {entry.description}
        </span>
      </td>

      <td>
        <strong
          className={
            entry.kind ===
              'credit_note' ||
            entry.kind ===
              'payment_reversal' || entry.kind === 'allocation_reversal' || entry.kind === 'client_fund_reversal'
              ? 'financial-ledger-negative'
              : ''
          }
        >
          {entry.kind ===
            'credit_note' ||
          entry.kind ===
            'payment_reversal' || entry.kind === 'allocation_reversal' || entry.kind === 'client_fund_reversal'
            ? '− '
            : ''}

          {formatCurrency(
            entry.amount,
            entry.currency,
          )}
        </strong>
      </td>

      <td>
        <Link
          className="financial-ledger-open"
          to={getEntryUrl(
            entry,
            financeUrl,
          )}
          title={tr("Open in Finance")}
        >
          <ExternalLink size={15} />{tr("View")}</Link>
      </td>
    </tr>
  );
}

function LedgerEmpty({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const interfaceLanguage = useLocale();
  return (
    <div className="financial-ledger-empty">
      <WalletCards size={24} />

      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function getEntryUrl(
  entry: FinancialLedgerEntry,
  financeUrl: string,
): string {
  if (
    entry.kind === 'invoice' &&
    entry.invoiceId
  ) {
    return `${financeUrl}&tab=invoices&invoiceId=${entry.invoiceId}`;
  }

  if (entry.kind === 'payment') {
    return `${financeUrl}&tab=payments`;
  }

  return `${financeUrl}&tab=adjustments`;
}

function formatEntryKind(
  kind: FinancialLedgerEntryKind,
): string {
  const labels:
    Record<
      FinancialLedgerEntryKind,
      string
    > = {
      get invoice() { return tr("Invoice"); },
      get payment() { return tr("Payment"); },
      get credit_note() { return tr("Credit Note"); },
      get payment_reversal() { return tr("Payment Reversal"); },
      get client_fund_receipt() { return tr("Client Funds"); },
      get payment_allocation() { return tr("Allocation"); },
      get allocation_reversal() { return tr("Allocation Reversal"); },
      get client_fund_reversal() { return tr("Client Fund Reversal"); },
    };

  return labels[kind];
}

function formatCurrency(
  value:
    | number
    | string
    | null
    | undefined,
  currency = 'AED',
): string {
  return new Intl.NumberFormat(
    getLocale("en-AE"),
    {
      style: 'currency',
      currency:
        currency || 'AED',
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value ?? 0),
  );
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return new Intl.DateTimeFormat(
    getLocale("en-AE"),
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function formatLabel(
  value: string,
): string {
  return tr(value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    ));
}

function normaliseClass(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

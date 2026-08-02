import {
  AlertCircle,
  BadgeDollarSign,
  CreditCard,
  ExternalLink,
  FileText,
  Plus,
  ReceiptText,
  WalletCards,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  getFinanceSummary,
  getInvoices,
  type FinanceSummary,
} from '../../services/invoiceService';

import {
  getPayments,
} from '../../services/paymentService';

import type {
  Invoice,
} from '../../types/invoice';

import type {
  Payment,
} from '../../types/payment';

import './CaseBillingWorkspace.css';

type CaseBillingWorkspaceProps = {
  caseId: string;
};

export function CaseBillingWorkspace({
  caseId,
}: CaseBillingWorkspaceProps) {
  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [summary, setSummary] =
    useState<FinanceSummary>({
      invoiceCount: 0,
      paidInvoiceCount: 0,
      overdueInvoiceCount: 0,
      totalBilled: 0,
      totalPaid: 0,
      outstanding: 0,
      overdue: 0,
      collectionRate: 0,
      aging: {
        current: 0,
        days1To30: 0,
        days31To60: 0,
        days61To90: 0,
        daysOver90: 0,
      },
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBilling() {
      try {
        setLoading(true);
        setError(null);

        const [
          invoiceResult,
          paymentResult,
          financeSummary,
        ] = await Promise.all([
          getInvoices({
            caseId,
            page: 1,
            pageSize: 100,
          }),

          getPayments({
            caseId,
            page: 1,
            pageSize: 100,
          }),

          getFinanceSummary({
            caseId,
          }),
        ]);

        if (!active) {
          return;
        }

        setInvoices(
          invoiceResult.data,
        );

        setPayments(
          paymentResult.data,
        );

        setSummary(
          financeSummary,
        );
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load billing records.',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBilling();

    return () => {
      active = false;
    };
  }, [caseId]);

  if (loading) {
    return (
      <div className="case-billing-state">
        <WalletCards size={24} />

        <strong>
          Loading case billing…
        </strong>

        <span>
          Retrieving invoices and payment records.
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="case-billing-state error">
        <AlertCircle size={24} />

        <strong>
          Unable to load billing
        </strong>

        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="case-billing-workspace">
      <header className="case-billing-header">
        <div>
          <span className="case-billing-eyebrow">
            Financial workspace
          </span>

          <h3>
            Case billing
          </h3>

          <p>
            Invoices, payments and balances linked to this legal matter.
          </p>
        </div>

        <div className="case-billing-actions">
          <Link
            className="secondary-action-button"
            to={`/payments?caseId=${caseId}`}
          >
            <ExternalLink size={16} />
            Open Finance
          </Link>

          <Link
            className="secondary-action-button"
            to={`/payments?caseId=${caseId}&tab=payments&createPayment=1`}
          >
            <CreditCard size={16} />
            Record Payment
          </Link>

          <Link
            className="primary-action-button"
            to={`/payments?caseId=${caseId}&tab=invoices&createInvoice=1`}
          >
            <Plus size={16} />
            New Invoice
          </Link>
        </div>
      </header>

      <section className="case-billing-summary">
        <BillingStat
          icon={<ReceiptText size={18} />}
          label="Total billed"
          value={formatCurrency(
            summary.totalBilled,
          )}
        />

        <BillingStat
          icon={<BadgeDollarSign size={18} />}
          label="Total paid"
          value={formatCurrency(
            summary.totalPaid,
          )}
          tone="success"
        />

        <BillingStat
          icon={<WalletCards size={18} />}
          label="Outstanding"
          value={formatCurrency(
            summary.outstanding,
          )}
          tone="warning"
        />

        <BillingStat
          icon={<AlertCircle size={18} />}
          label="Overdue"
          value={formatCurrency(
            summary.overdue,
          )}
          tone="danger"
        />
      </section>


      <section className="case-billing-aging">

        <div className="case-billing-aging-header">
          <h4>Accounts Receivable Aging</h4>

          <span>
            Collection Rate {summary.collectionRate.toFixed(1)}%
          </span>
        </div>

        <div className="case-billing-aging-grid">

          <BillingStat
            icon={<WalletCards size={18} />}
            label="Current"
            value={formatCurrency(summary.aging.current)}
          />

          <BillingStat
            icon={<AlertCircle size={18} />}
            label="1–30 Days"
            value={formatCurrency(summary.aging.days1To30)}
            tone="warning"
          />

          <BillingStat
            icon={<AlertCircle size={18} />}
            label="31–60 Days"
            value={formatCurrency(summary.aging.days31To60)}
            tone="warning"
          />

          <BillingStat
            icon={<AlertCircle size={18} />}
            label="61–90 Days"
            value={formatCurrency(summary.aging.days61To90)}
            tone="danger"
          />

          <BillingStat
            icon={<BadgeDollarSign size={18} />}
            label="90+ Days"
            value={formatCurrency(summary.aging.daysOver90)}
            tone="danger"
          />

        </div>

      </section>

      <section className="case-billing-section">
        <div className="case-billing-section-heading">
          <div>
            <ReceiptText size={18} />

            <h4>
              Invoices
            </h4>
          </div>

          <span>
            {invoices.length}{' '}
            {invoices.length === 1
              ? 'invoice'
              : 'invoices'}
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="case-billing-empty">
            <FileText size={22} />

            <strong>
              No invoices yet
            </strong>

            <p>
              Create the first invoice for this matter.
            </p>

            <Link
              className="primary-action-button"
              to={`/payments?caseId=${caseId}&tab=invoices&createInvoice=1`}
            >
              <Plus size={16} />
              Create Invoice
            </Link>
          </div>
        ) : (
          <div className="case-billing-table-wrap">
            <table className="case-billing-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {invoices.map(
                  (invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <strong>
                          {invoice.invoice_number}
                        </strong>

                        {invoice.description && (
                          <small>
                            {invoice.description}
                          </small>
                        )}
                      </td>

                      <td>
                        <span
                          className={`case-billing-status ${normaliseClass(
                            invoice.status,
                          )}`}
                        >
                          {formatLabel(
                            invoice.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          invoice.issue_date,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          invoice.due_date,
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          invoice.total_amount,
                          invoice.currency,
                        )}
                      </td>

                      <td>
                        {formatCurrency(
                          invoice.paid_amount,
                          invoice.currency,
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            invoice.balance_amount,
                            invoice.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        <Link
                          className="case-billing-open"
                          to={`/payments?caseId=${caseId}&tab=invoices&invoiceId=${invoice.id}`}
                          title="Open invoice"
                        >
                          <ExternalLink size={15} />
                        </Link>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="case-billing-section">
        <div className="case-billing-section-heading">
          <div>
            <CreditCard size={18} />

            <h4>
              Payment history
            </h4>
          </div>

          <span>
            {payments.length}{' '}
            {payments.length === 1
              ? 'payment'
              : 'payments'}
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="case-billing-empty compact">
            <CreditCard size={22} />

            <strong>
              No payments recorded
            </strong>

            <p>
              Payments linked to this case will appear here.
            </p>
          </div>
        ) : (
          <div className="case-billing-table-wrap">
            <table className="case-billing-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {payments.map(
                  (payment) => (
                    <tr key={payment.id}>
                      <td>
                        {formatDate(
                          payment.payment_date,
                        )}
                      </td>

                      <td>
                        {payment.payment_method
                          ? formatLabel(
                              payment.payment_method,
                            )
                          : 'Not provided'}
                      </td>

                      <td>
                        {payment.reference_number ||
                          '—'}
                      </td>

                      <td>
                        <span
                          className={`case-billing-status ${normaliseClass(
                            payment.status,
                          )}`}
                        >
                          {formatLabel(
                            payment.status,
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {formatCurrency(
                            payment.amount,
                            payment.currency,
                          )}
                        </strong>
                      </td>
                    </tr>
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

function BillingStat({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <article
      className={`case-billing-stat ${tone}`}
    >
      <div className="case-billing-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function formatCurrency(
  value?: number | string | null,
  currency = 'AED',
): string {
  return new Intl.NumberFormat(
    'en-AE',
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
    return 'Not set';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
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
  return value
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
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

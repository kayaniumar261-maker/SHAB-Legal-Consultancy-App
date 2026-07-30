import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  FileText,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createInvoice,
  deleteInvoice,
  getInvoices,
  updateInvoice,
} from '../services/invoiceService';

import {
  createPayment,
  deletePayment,
  getPayments,
} from '../services/paymentService';

import {
  getClientOptions,
  getCaseOptions,
  getStaffOptions,
  type CaseOption,
  type ClientOption,
  type StaffOption,
} from '../services/taskService';

import type {
  Invoice,
  InvoiceInsert,
  InvoiceStatus,
} from '../types/invoice';

import type {
  Payment,
  PaymentInsert,
  PaymentStatus,
} from '../types/payment';

import './Payments.css';

const PAGE_SIZE = 12;

type FinanceTab = 'invoices' | 'payments';

type InvoiceFormState = {
  client_id: string;
  case_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: string;
  vat_rate: string;
  discount_amount: string;
  description: string;
  notes: string;
};

type PaymentFormState = {
  invoice_id: string;
  amount: string;
  currency: string;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  status: PaymentStatus;
  notes: string;
  received_by_staff_id: string;
};

const emptyInvoiceForm: InvoiceFormState = {
  client_id: '',
  case_id: '',
  invoice_number: '',
  issue_date: getTodayDate(),
  due_date: '',
  status: 'draft',
  currency: 'AED',
  subtotal: '',
  vat_rate: '5',
  discount_amount: '0',
  description: '',
  notes: '',
};

const emptyPaymentForm: PaymentFormState = {
  invoice_id: '',
  amount: '',
  currency: 'AED',
  payment_date: getTodayDate(),
  payment_method: '',
  reference_number: '',
  status: 'completed',
  notes: '',
  received_by_staff_id: '',
};

export function Payments() {
  const [activeTab, setActiveTab] =
    useState<FinanceTab>('invoices');

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [clients, setClients] =
    useState<ClientOption[]>([]);

  const [cases, setCases] =
    useState<CaseOption[]>([]);

  const [staff, setStaff] =
    useState<StaffOption[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [invoiceStatus, setInvoiceStatus] =
    useState<string>('all');

  const [paymentStatus, setPaymentStatus] =
    useState<string>('all');

  const [page, setPage] =
    useState(1);

  const [totalCount, setTotalCount] =
    useState(0);

  const [invoiceModalOpen, setInvoiceModalOpen] =
    useState(false);

  const [paymentModalOpen, setPaymentModalOpen] =
    useState(false);

  const [invoiceForm, setInvoiceForm] =
    useState<InvoiceFormState>(emptyInvoiceForm);

  const [paymentForm, setPaymentForm] =
    useState<PaymentFormState>(emptyPaymentForm);

  const [formLoading, setFormLoading] =
    useState(false);

  const [actionId, setActionId] =
    useState<string | null>(null);

  const clientMap = useMemo(() => {
    return clients.reduce<Record<string, string>>(
      (map, client) => {
        map[client.id] = client.full_name;
        return map;
      },
      {},
    );
  }, [clients]);

  const caseMap = useMemo(() => {
    return cases.reduce<Record<string, string>>(
      (map, caseItem) => {
        map[caseItem.id] =
          caseItem.case_number ||
          caseItem.case_type ||
          `Case ${caseItem.id.slice(0, 8)}`;

        return map;
      },
      {},
    );
  }, [cases]);

  const invoiceMap = useMemo(() => {
    return invoices.reduce<Record<string, Invoice>>(
      (map, invoice) => {
        map[invoice.id] = invoice;
        return map;
      },
      {},
    );
  }, [invoices]);

  const filteredCases = useMemo(() => {
    if (!invoiceForm.client_id) {
      return [];
    }

    return cases.filter(
      (caseItem) =>
        caseItem.client_id === invoiceForm.client_id,
    );
  }, [cases, invoiceForm.client_id]);

  const loadOptions = useCallback(async () => {
    try {
      const [
        clientOptions,
        caseOptions,
        staffOptions,
      ] = await Promise.all([
        getClientOptions(),
        getCaseOptions(),
        getStaffOptions(),
      ]);

      setClients(clientOptions);
      setCases(caseOptions);
      setStaff(staffOptions);
    } catch (optionsError) {
      setError(
        optionsError instanceof Error
          ? optionsError.message
          : 'Unable to load finance options.',
      );
    }
  }, []);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'invoices') {
        const result = await getInvoices({
          status:
            invoiceStatus === 'all'
              ? undefined
              : invoiceStatus,
          page,
          pageSize: PAGE_SIZE,
        });

        const filtered = filterInvoices(
          result.data,
          search,
        );

        setInvoices(filtered);
        setTotalCount(
          search.trim()
            ? filtered.length
            : result.count,
        );
      } else {
        const result = await getPayments({
          status:
            paymentStatus === 'all'
              ? undefined
              : paymentStatus,
          page,
          pageSize: PAGE_SIZE,
        });

        const filtered = filterPayments(
          result.data,
          search,
        );

        setPayments(filtered);
        setTotalCount(
          search.trim()
            ? filtered.length
            : result.count,
        );
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load finance data.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    invoiceStatus,
    paymentStatus,
    page,
    search,
  ]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  const invoiceStats = useMemo(() => {
    const total = invoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.total_amount ?? 0),
      0,
    );

    const paid = invoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.paid_amount ?? 0),
      0,
    );

    const outstanding = invoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.balance_amount ?? 0),
      0,
    );

    return {
      total,
      paid,
      outstanding,
    };
  }, [invoices]);

  const paymentStats = useMemo(() => {
    const total = payments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount ?? 0),
      0,
    );

    const completed = payments
      .filter(
        (payment) =>
          payment.status === 'completed',
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.amount ?? 0),
        0,
      );

    return {
      total,
      completed,
    };
  }, [payments]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE),
  );

  const handleCreateInvoice = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !invoiceForm.client_id ||
      !invoiceForm.invoice_number.trim()
    ) {
      setError(
        'Client and invoice number are required.',
      );
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const subtotal =
        Number(invoiceForm.subtotal || 0);

      const vatRate =
        Number(invoiceForm.vat_rate || 0);

      const discountAmount =
        Number(invoiceForm.discount_amount || 0);

      const vatAmount =
        subtotal * (vatRate / 100);

      const totalAmount =
        subtotal +
        vatAmount -
        discountAmount;

      const payload: InvoiceInsert = {
        client_id: invoiceForm.client_id,
        case_id:
          invoiceForm.case_id || null,

        invoice_number:
          invoiceForm.invoice_number.trim(),

        issue_date:
          invoiceForm.issue_date,

        due_date:
          invoiceForm.due_date || null,

        status:
          invoiceForm.status,

        currency:
          invoiceForm.currency || 'AED',

        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        discount_amount: discountAmount,

        total_amount: totalAmount,
        paid_amount: 0,
        balance_amount: totalAmount,

        description:
          invoiceForm.description.trim() ||
          null,

        notes:
          invoiceForm.notes.trim() ||
          null,

        created_by: null,

        amount: totalAmount,
      };

      await createInvoice(payload);

      setInvoiceModalOpen(false);
      setInvoiceForm(emptyInvoiceForm);
      setPage(1);

      await loadFinanceData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to create invoice.',
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreatePayment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const invoice =
      invoiceMap[paymentForm.invoice_id];

    if (!invoice) {
      setError('Please select an invoice.');
      return;
    }

    const amount =
      Number(paymentForm.amount || 0);

    if (amount <= 0) {
      setError(
        'Payment amount must be greater than zero.',
      );
      return;
    }

    const currentPaid =
      Number(invoice.paid_amount ?? 0);

    const totalAmount =
      Number(invoice.total_amount ?? 0);

    const currentBalance =
      Number(invoice.balance_amount ?? 0);

    if (paymentForm.status === 'completed' && amount > currentBalance) {
      setError(
        `Payment cannot exceed the outstanding balance of ${formatCurrency(
          currentBalance,
        )}.`,
      );
      return;
    }

    setFormLoading(true);
    setError(null);

    try {
      const payload: PaymentInsert = {
        invoice_id: invoice.id,
        client_id: invoice.client_id,
        case_id: invoice.case_id,

        amount,

        currency:
          paymentForm.currency ||
          invoice.currency ||
          'AED',

        payment_date:
          paymentForm.payment_date,

        payment_method:
          paymentForm.payment_method.trim() ||
          null,

        reference_number:
          paymentForm.reference_number.trim() ||
          null,

        status:
          paymentForm.status,

        notes:
          paymentForm.notes.trim() ||
          null,

        received_by_staff_id:
          paymentForm.received_by_staff_id ||
          null,

        created_by: null,

        paid_at:
          paymentForm.status === 'completed'
            ? new Date().toISOString()
            : null,
      };

      await createPayment(payload);

      if (paymentForm.status === 'completed') {
        const newPaidAmount =
          currentPaid + amount;

        const newBalanceAmount =
          Math.max(
            0,
            totalAmount - newPaidAmount,
          );

        let newStatus: InvoiceStatus =
          'issued';

        if (newPaidAmount >= totalAmount) {
          newStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'partially_paid';
        }

        await updateInvoice(
          invoice.id,
          {
            paid_amount:
              newPaidAmount,

            balance_amount:
              newBalanceAmount,

            status:
              newStatus,
          },
        );
      }

      setPaymentModalOpen(false);
      setPaymentForm(emptyPaymentForm);
      setPage(1);

      await loadFinanceData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to create payment.',
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteInvoice = async (
    invoice: Invoice,
  ) => {
    const linkedPayments =
      payments.filter(
        (payment) =>
          payment.invoice_id === invoice.id,
      );

    if (linkedPayments.length > 0) {
      setError(
        `Invoice ${invoice.invoice_number} has payment records and cannot be deleted. Delete or reverse its payments first.`,
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoice_number}?`,
    );

    if (!confirmed) {
      return;
    }

    setActionId(invoice.id);
    setError(null);

    try {
      await deleteInvoice(invoice.id);
      await loadFinanceData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete invoice.',
      );
    } finally {
      setActionId(null);
    }
  };

  const handleDeletePayment = async (
    payment: Payment,
  ) => {
    const confirmed = window.confirm(
      'Delete this payment record?',
    );

    if (!confirmed) {
      return;
    }

    const invoice =
      invoiceMap[payment.invoice_id];

    setActionId(payment.id);
    setError(null);

    try {
      await deletePayment(payment.id);

      if (
        payment.status === 'completed' &&
        invoice
      ) {
        const totalAmount =
          Number(invoice.total_amount ?? 0);

        const currentPaid =
          Number(invoice.paid_amount ?? 0);

        const paymentAmount =
          Number(payment.amount ?? 0);

        const newPaidAmount =
          Math.max(
            0,
            currentPaid - paymentAmount,
          );

        const newBalanceAmount =
          Math.max(
            0,
            totalAmount - newPaidAmount,
          );

        let newStatus: InvoiceStatus =
          'issued';

        if (newPaidAmount >= totalAmount) {
          newStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'partially_paid';
        }

        await updateInvoice(
          invoice.id,
          {
            paid_amount:
              newPaidAmount,

            balance_amount:
              newBalanceAmount,

            status:
              newStatus,
          },
        );
      }

      await loadFinanceData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete payment.',
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="payments-page page-container">
      <section className="page-heading payments-heading">
        <div>
          <p className="page-eyebrow">
            Finance management
          </p>

          <h2>Payments & Invoices</h2>

          <p className="page-intro">
            Track billing, collections and outstanding
            balances from one central finance workspace.
          </p>
        </div>

        <div className="payments-heading-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() =>
              setPaymentModalOpen(true)
            }
          >
            <CreditCard size={18} />
            Record Payment
          </button>

          <button
            type="button"
            className="primary-action-button"
            onClick={() =>
              setInvoiceModalOpen(true)
            }
          >
            <Plus size={18} />
            New Invoice
          </button>
        </div>
      </section>

      <section className="finance-tabs">
        <button
          type="button"
          className={
            activeTab === 'invoices'
              ? 'active'
              : ''
          }
          onClick={() => {
            setActiveTab('invoices');
            setPage(1);
          }}
        >
          <ReceiptText size={17} />
          Invoices
        </button>

        <button
          type="button"
          className={
            activeTab === 'payments'
              ? 'active'
              : ''
          }
          onClick={() => {
            setActiveTab('payments');
            setPage(1);
          }}
        >
          <WalletCards size={17} />
          Payments
        </button>
      </section>

      {activeTab === 'invoices' ? (
        <section className="finance-summary-grid">
          <FinanceStat
            icon={<FileText size={20} />}
            label="Invoices"
            value={invoices.length.toString()}
          />

          <FinanceStat
            icon={<CircleDollarSign size={20} />}
            label="Total Billed"
            value={formatCurrency(
              invoiceStats.total,
            )}
          />

          <FinanceStat
            icon={<Banknote size={20} />}
            label="Paid"
            value={formatCurrency(
              invoiceStats.paid,
            )}
            tone="success"
          />

          <FinanceStat
            icon={<CreditCard size={20} />}
            label="Outstanding"
            value={formatCurrency(
              invoiceStats.outstanding,
            )}
            tone="warning"
          />
        </section>
      ) : (
        <section className="finance-summary-grid">
          <FinanceStat
            icon={<WalletCards size={20} />}
            label="Payments"
            value={payments.length.toString()}
          />

          <FinanceStat
            icon={<CircleDollarSign size={20} />}
            label="Recorded"
            value={formatCurrency(
              paymentStats.total,
            )}
          />

          <FinanceStat
            icon={<Banknote size={20} />}
            label="Completed"
            value={formatCurrency(
              paymentStats.completed,
            )}
            tone="success"
          />
        </section>
      )}

      <section className="finance-toolbar">
        <div className="finance-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={
              activeTab === 'invoices'
                ? 'Search invoice number, description or notes'
                : 'Search reference, method or notes'
            }
          />
        </div>

        {activeTab === 'invoices' ? (
          <label className="finance-filter">
            <span>Status</span>

            <select
              value={invoiceStatus}
              onChange={(event) => {
                setInvoiceStatus(
                  event.target.value,
                );
                setPage(1);
              }}
            >
              <option value="all">
                All statuses
              </option>
              <option value="draft">
                Draft
              </option>
              <option value="issued">
  Issued
</option>

<option value="partially_paid">
  Partially Paid
</option>

<option value="cancelled">
  Cancelled
</option>

<option value="written_off">
  Written Off
</option>
              <option value="paid">
                Paid
              </option>
              <option value="overdue">
                Overdue
              </option>
            </select>
          </label>
        ) : (
          <label className="finance-filter">
            <span>Status</span>

            <select
              value={paymentStatus}
              onChange={(event) => {
                setPaymentStatus(
                  event.target.value,
                );
                setPage(1);
              }}
            >
              <option value="all">
                All statuses
              </option>
              <option value="completed">
                Completed
              </option>
              <option value="pending">
                Pending
              </option>
              <option value="failed">
                Failed
              </option>
            </select>
          </label>
        )}
      </section>

      {error && (
        <div className="finance-error">
          {error}
        </div>
      )}

      <section className="finance-table-wrapper">
        {activeTab === 'invoices' ? (
          <table className="finance-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Case</th>
                <th>Status</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <FinanceStateRow
                  message="Loading invoices…"
                  columns={9}
                />
              ) : invoices.length === 0 ? (
                <FinanceStateRow
                  message="No invoices found."
                  columns={9}
                />
              ) : (
                invoices.map((invoice) => (
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
                      {clientMap[
                        invoice.client_id
                      ] ?? 'Unknown client'}
                    </td>

                    <td>
                      {invoice.case_id
                        ? caseMap[
                            invoice.case_id
                          ] ?? 'Unknown case'
                        : '—'}
                    </td>

                    <td>
                      <span
                        className={`finance-status ${invoice.status}`}
                      >
                        {formatLabel(
                          invoice.status,
                        )}
                      </span>
                    </td>

                    <td>
                      {formatCurrency(
                        invoice.total_amount,
                      )}
                    </td>

                    <td>
                      {formatCurrency(
                        invoice.paid_amount,
                      )}
                    </td>

                    <td>
                      {formatCurrency(
                        invoice.balance_amount,
                      )}
                    </td>

                    <td>
                      {formatDate(
                        invoice.due_date,
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="finance-delete-button"
                        onClick={() =>
                          void handleDeleteInvoice(
                            invoice,
                          )
                        }
                        disabled={
                          actionId === invoice.id
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="finance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice</th>
                <th>Client</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <FinanceStateRow
                  message="Loading payments…"
                  columns={8}
                />
              ) : payments.length === 0 ? (
                <FinanceStateRow
                  message="No payments found."
                  columns={8}
                />
              ) : (
                payments.map((payment) => {
                  const invoice =
                    invoiceMap[
                      payment.invoice_id
                    ];

                  return (
                    <tr key={payment.id}>
                      <td>
                        {formatDate(
                          payment.payment_date,
                        )}
                      </td>

                      <td>
                        {invoice?.invoice_number ??
                          '—'}
                      </td>

                      <td>
                        {clientMap[
                          payment.client_id
                        ] ?? 'Unknown client'}
                      </td>

                      <td>
                        {payment.payment_method ??
                          '—'}
                      </td>

                      <td>
                        {payment.reference_number ??
                          '—'}
                      </td>

                      <td>
                        <span
                          className={`finance-status ${payment.status}`}
                        >
                          {formatLabel(
                            payment.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {formatCurrency(
                          payment.amount,
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="finance-delete-button"
                          onClick={() =>
                            void handleDeletePayment(
                              payment,
                            )
                          }
                          disabled={
                            actionId === payment.id
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </section>

      {totalPages > 1 && (
        <section className="finance-pagination">
          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.max(1, current - 1),
              )
            }
            disabled={page <= 1 || loading}
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((current) =>
                Math.min(
                  totalPages,
                  current + 1,
                ),
              )
            }
            disabled={
              page >= totalPages || loading
            }
          >
            Next
          </button>
        </section>
      )}

      {invoiceModalOpen && (
        <div className="finance-modal-layer">
          <button
            type="button"
            className="finance-modal-backdrop"
            onClick={() =>
              setInvoiceModalOpen(false)
            }
          />

          <section className="finance-modal">
            <header className="finance-modal-header">
              <div>
                <p className="page-eyebrow">
                  Billing
                </p>
                <h3>New Invoice</h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setInvoiceModalOpen(false)
                }
              >
                ×
              </button>
            </header>

            <form
              className="finance-form"
              onSubmit={handleCreateInvoice}
            >
              <label>
                <span>Client</span>

                <select
                  value={
                    invoiceForm.client_id
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        client_id:
                          event.target.value,
                        case_id: '',
                      }),
                    )
                  }
                  required
                >
                  <option value="">
                    Select client
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Case</span>

                <select
                  value={
                    invoiceForm.case_id
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        case_id:
                          event.target.value,
                      }),
                    )
                  }
                  disabled={
                    !invoiceForm.client_id
                  }
                >
                  <option value="">
                    No case
                  </option>

                  {filteredCases.map(
                    (caseItem) => (
                      <option
                        key={caseItem.id}
                        value={caseItem.id}
                      >
                        {caseItem.case_number ||
                          caseItem.case_type}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Invoice Number</span>

                <input
                  value={
                    invoiceForm.invoice_number
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        invoice_number:
                          event.target.value,
                      }),
                    )
                  }
                  required
                />
              </label>

              <label>
                <span>Status</span>

                <select
                  value={invoiceForm.status}
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value as InvoiceStatus,
                      }),
                    )
                  }
                >
                  <option value="draft">
                    Draft
                  </option>
                  <option value="issued">
  Issued
</option>

<option value="partially_paid">
  Partially Paid
</option>

<option value="cancelled">
  Cancelled
</option>

<option value="written_off">
  Written Off
</option>
                  <option value="paid">
                    Paid
                  </option>
                  <option value="overdue">
                    Overdue
                  </option>
                </select>
              </label>

              <label>
                <span>Issue Date</span>

                <input
                  type="date"
                  value={
                    invoiceForm.issue_date
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        issue_date:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Due Date</span>

                <input
                  type="date"
                  value={
                    invoiceForm.due_date
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        due_date:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Subtotal</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    invoiceForm.subtotal
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        subtotal:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>VAT %</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    invoiceForm.vat_rate
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        vat_rate:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Discount</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    invoiceForm.discount_amount
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        discount_amount:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Currency</span>

                <input
                  value={
                    invoiceForm.currency
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        currency:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label className="finance-form-wide">
                <span>Description</span>

                <textarea
                  value={
                    invoiceForm.description
                  }
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label className="finance-form-wide">
                <span>Notes</span>

                <textarea
                  value={invoiceForm.notes}
                  onChange={(event) =>
                    setInvoiceForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <footer className="finance-form-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={() =>
                    setInvoiceModalOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={formLoading}
                >
                  {formLoading
                    ? 'Saving…'
                    : 'Create Invoice'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {paymentModalOpen && (
        <div className="finance-modal-layer">
          <button
            type="button"
            className="finance-modal-backdrop"
            onClick={() =>
              setPaymentModalOpen(false)
            }
          />

          <section className="finance-modal">
            <header className="finance-modal-header">
              <div>
                <p className="page-eyebrow">
                  Collections
                </p>
                <h3>Record Payment</h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPaymentModalOpen(false)
                }
              >
                ×
              </button>
            </header>

            <form
              className="finance-form"
              onSubmit={handleCreatePayment}
            >
              <label className="finance-form-wide">
                <span>Invoice</span>

                <select
                  value={
                    paymentForm.invoice_id
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        invoice_id:
                          event.target.value,
                      }),
                    )
                  }
                  required
                >
                  <option value="">
                    Select invoice
                  </option>

                  {invoices.map((invoice) => (
                    <option
                      key={invoice.id}
                      value={invoice.id}
                    >
                      {invoice.invoice_number} —{' '}
                      {clientMap[
                        invoice.client_id
                      ] ?? 'Client'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Amount</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    paymentForm.amount
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        amount:
                          event.target.value,
                      }),
                    )
                  }
                  required
                />
              </label>

              <label>
                <span>Currency</span>

                <input
                  value={
                    paymentForm.currency
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        currency:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Payment Date</span>

                <input
                  type="date"
                  value={
                    paymentForm.payment_date
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        payment_date:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Status</span>

                <select
                  value={
                    paymentForm.status
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value as PaymentStatus,
                      }),
                    )
                  }
                >
                  <option value="completed">
                    Completed
                  </option>
                  <option value="pending">
                    Pending
                  </option>
                  <option value="failed">
                    Failed
                  </option>
                </select>
              </label>

              <label>
                <span>Payment Method</span>

                <input
                  value={
                    paymentForm.payment_method
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        payment_method:
                          event.target.value,
                      }),
                    )
                  }
                  placeholder="Bank transfer, cash..."
                />
              </label>

              <label>
                <span>Reference</span>

                <input
                  value={
                    paymentForm.reference_number
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        reference_number:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>Received By</span>

                <select
                  value={
                    paymentForm.received_by_staff_id
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        received_by_staff_id:
                          event.target.value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Not assigned
                  </option>

                  {staff.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                    >
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-form-wide">
                <span>Notes</span>

                <textarea
                  value={
                    paymentForm.notes
                  }
                  onChange={(event) =>
                    setPaymentForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <footer className="finance-form-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={() =>
                    setPaymentModalOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={formLoading}
                >
                  {formLoading
                    ? 'Saving…'
                    : 'Record Payment'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function FinanceStat({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <article
      className={`finance-stat-card ${tone}`}
    >
      <div className="finance-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function FinanceStateRow({
  message,
  columns,
}: {
  message: string;
  columns: number;
}) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="finance-state-cell"
      >
        {message}
      </td>
    </tr>
  );
}

function filterInvoices(
  rows: Invoice[],
  search: string,
): Invoice[] {
  const term =
    search.trim().toLowerCase();

  if (!term) {
    return rows;
  }

  return rows.filter((invoice) =>
    [
      invoice.invoice_number,
      invoice.description,
      invoice.notes,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value)
          .toLowerCase()
          .includes(term),
      ),
  );
}

function filterPayments(
  rows: Payment[],
  search: string,
): Payment[] {
  const term =
    search.trim().toLowerCase();

  if (!term) {
    return rows;
  }

  return rows.filter((payment) =>
    [
      payment.reference_number,
      payment.payment_method,
      payment.notes,
    ]
      .filter(Boolean)
      .some((value) =>
        String(value)
          .toLowerCase()
          .includes(term),
      ),
  );
}

function formatCurrency(
  value: number | string | null | undefined,
): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatLabel(
  value: string,
): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function getTodayDate(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}
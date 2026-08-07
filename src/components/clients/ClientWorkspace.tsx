import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Gavel,
  ListTodo,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  Upload,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  getCases,
} from '../../services/caseService';

import {
  getHearingsByClient,
} from '../../services/hearingService';

import {
  getTasksByClient,
} from '../../services/taskService';

import {
  getDocumentsByClient,
} from '../../services/documentService';

import {
  getFinancialLedger,
  type FinancialLedgerSummary,
} from '../../services/financialLedgerService';

import type {
  CaseWithRelations,
} from '../../types/case';

import type {
  DocumentWithRelations,
} from '../../types/document';

import type {
  Invoice,
} from '../../types/invoice';

import type {
  Payment,
} from '../../types/payment';

import type {
  Task,
} from '../../types/task';

import './ClientWorkspace.css';

type ClientWorkspaceClient = {
  id: string;
  full_name: string;
  company_name?: string | null;
  status?: string | null;
  risk_level?: string | null;
  is_vip?: boolean | null;
  vip?: boolean | null;
  active_cases?: number | null;
  total_cases?: number | null;
};

type ClientWorkspaceProps = {
  client: ClientWorkspaceClient;
};

type ClientHearingRecord =
  Awaited<
    ReturnType<
      typeof getHearingsByClient
    >
  >[number];

export function ClientWorkspace({
  client,
}: ClientWorkspaceProps) {
  const [cases, setCases] =
    useState<CaseWithRelations[]>([]);

  const [hearings, setHearings] =
    useState<ClientHearingRecord[]>([]);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [documents, setDocuments] =
    useState<DocumentWithRelations[]>([]);

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [financialSummary, setFinancialSummary] =
    useState<FinancialLedgerSummary | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [warning, setWarning] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setWarning(null);

      const results =
        await Promise.allSettled([
          getCases({
            clientId: client.id,
            page: 1,
            pageSize: 10,
            sortBy: 'created_at',
            sortOrder: 'desc',
          }),

          getHearingsByClient(
            client.id,
          ),

          getTasksByClient(
            client.id,
          ),

          getDocumentsByClient(
            client.id,
          ),

          getFinancialLedger({
            clientId: client.id,
          }),
        ]);

      if (!active) {
        return;
      }

      const [
        casesResult,
        hearingsResult,
        tasksResult,
        documentsResult,
        financialLedgerResult,
      ] = results;

      if (
        casesResult.status ===
        'fulfilled'
      ) {
        setCases(
          casesResult.value.data,
        );
      }

      if (
        hearingsResult.status ===
        'fulfilled'
      ) {
        setHearings(
          hearingsResult.value,
        );
      }

      if (
        tasksResult.status ===
        'fulfilled'
      ) {
        setTasks(
          extractArray<Task>(
            tasksResult.value,
          ),
        );
      }

      if (
        documentsResult.status ===
        'fulfilled'
      ) {
        setDocuments(
          documentsResult.value,
        );
      }

      if (
        financialLedgerResult.status ===
        'fulfilled'
      ) {
        setInvoices(
          financialLedgerResult.value.invoices,
        );

        setPayments(
          financialLedgerResult.value.payments,
        );

        setFinancialSummary(
          financialLedgerResult.value.summary,
        );
      } else {
        setInvoices([]);
        setPayments([]);
        setFinancialSummary(null);
      }

      if (
        results.some(
          (result) =>
            result.status ===
            'rejected',
        )
      ) {
        setWarning(
          'Some client workspace information could not be loaded.',
        );
      }

      setLoading(false);
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [client.id]);

  const activeCases = useMemo(
    () =>
      cases.filter(
        (caseRecord) =>
          normalize(
            caseRecord.status,
          ) !== 'closed',
      ),
    [cases],
  );

  const urgentCases = useMemo(
    () =>
      activeCases.filter(
        (caseRecord) =>
          Boolean(
            caseRecord
              .requires_urgent_action,
          ) ||
          normalize(
            caseRecord.priority,
          ) === 'urgent',
      ),
    [activeCases],
  );

  const openTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          normalize(
            task.status,
          ) !== 'completed',
      ),
    [tasks],
  );

  const overdueTasks = useMemo(
    () =>
      openTasks.filter(
        (task) =>
          isPast(task.due_at),
      ),
    [openTasks],
  );

  const upcomingHearings =
    useMemo(
      () =>
        hearings
          .filter(
            (hearing) => {
              const hearingTime =
                new Date(
                  hearing.hearing_at,
                ).getTime();

              return (
                !Number.isNaN(
                  hearingTime,
                ) &&
                hearingTime >=
                  Date.now() &&
                ![
                  'completed',
                  'cancelled',
                ].includes(
                  normalize(
                    hearing.status,
                  ),
                )
              );
            },
          )
          .sort(
            (first, second) =>
              new Date(
                first.hearing_at,
              ).getTime() -
              new Date(
                second.hearing_at,
              ).getTime(),
          ),
      [hearings],
    );

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          Number(
            invoice.balance_amount ??
              0,
          ) > 0 &&
          ![
            'cancelled',
            'written_off',
          ].includes(
            normalize(
              invoice.status,
            ),
          ),
      ),
    [invoices],
  );

  const overdueInvoices = useMemo(
    () =>
      unpaidInvoices.filter(
        (invoice) =>
          normalize(
            invoice.status,
          ) === 'overdue' ||
          isPast(
            invoice.due_date,
          ),
      ),
    [unpaidInvoices],
  );

  const totalBilled =
    financialSummary?.totalBilled ?? 0;

  const totalPaid =
    financialSummary?.netCollected ?? 0;

  const outstanding =
    financialSummary?.outstanding ?? 0;

  const collectionRate =
    financialSummary?.collectionRate ?? 0;

  const health = useMemo(() => {
    let score = 100;

    score -= Math.min(
      30,
      overdueTasks.length * 10,
    );

    score -= Math.min(
      20,
      overdueInvoices.length *
        10,
    );

    score -= Math.min(
      20,
      urgentCases.length * 10,
    );

    if (
      normalize(
        client.status,
      ) !== 'active'
    ) {
      score -= 10;
    }

    if (
      [
        'high',
        'critical',
      ].includes(
        normalize(
          client.risk_level,
        ),
      )
    ) {
      score -= 15;
    }

    if (
      collectionRate >= 80
    ) {
      score += 5;
    }

    score = Math.round(
      Math.max(
        0,
        Math.min(100, score),
      ),
    );

    if (score >= 90) {
      return {
        score,
        label: 'Excellent',
        tone: 'excellent',
      };
    }

    if (score >= 75) {
      return {
        score,
        label: 'Healthy',
        tone: 'healthy',
      };
    }

    if (score >= 50) {
      return {
        score,
        label:
          'Needs Attention',
        tone: 'attention',
      };
    }

    return {
      score,
      label: 'Critical',
      tone: 'critical',
    };
  }, [
    client.risk_level,
    client.status,
    collectionRate,
    overdueInvoices.length,
    overdueTasks.length,
    urgentCases.length,
  ]);

  const latestPayment =
    [...payments]
      .sort(
        (first, second) =>
          getRecordTime(second) -
          getRecordTime(first),
      )[0] ?? null;

  const latestInvoice =
    [...invoices]
      .sort(
        (first, second) =>
          getRecordTime(second) -
          getRecordTime(first),
      )[0] ?? null;

  return (
    <div className="client-workspace">
      {warning ? (
        <div className="client-workspace-warning">
          <AlertTriangle
            size={17}
          />

          {warning}
        </div>
      ) : null}

      <section className="client-workspace-command">
        <div className="client-workspace-command-heading">
          <div>
            <span>
              Relationship intelligence
            </span>

            <h3>
              Client Command Centre
            </h3>

            <p>
              Matters, financial exposure and immediate actions for this client.
            </p>
          </div>

          <span
            className={`client-health-badge ${health.tone}`}
          >
            {health.score}%{' '}
            {health.label}
          </span>
        </div>

        <div className="client-command-grid">
          <CommandMetric
            icon={
              <FolderKanban
                size={18}
              />
            }
            label="Active Matters"
            value={
              loading
                ? '—'
                : String(
                    activeCases.length,
                  )
            }
            detail={`${urgentCases.length} urgent`}
            tone={
              urgentCases.length > 0
                ? 'danger'
                : 'normal'
            }
            to={`/cases?clientId=${client.id}`}
          />

          <CommandMetric
            icon={
              <ListTodo
                size={18}
              />
            }
            label="Open Tasks"
            value={
              loading
                ? '—'
                : String(
                    openTasks.length,
                  )
            }
            detail={`${overdueTasks.length} overdue`}
            tone={
              overdueTasks.length > 0
                ? 'danger'
                : 'normal'
            }
            to={`/tasks?clientId=${client.id}`}
          />

          <CommandMetric
            icon={
              <Gavel size={18} />
            }
            label="Next Hearing"
            value={
              loading
                ? '—'
                : upcomingHearings[0]
                  ? formatDate(
                      upcomingHearings[0]
                        .hearing_at,
                    )
                  : 'Not scheduled'
            }
            detail={
              upcomingHearings[0]
                ?.court ??
              'Court calendar'
            }
            tone={
              upcomingHearings[0]
                ? 'warning'
                : 'normal'
            }
            to={`/hearings?clientId=${client.id}`}
          />

          <CommandMetric
            icon={
              <BadgeDollarSign
                size={18}
              />
            }
            label="Outstanding"
            value={
              loading
                ? '—'
                : financialSummary
                  ? formatCurrency(
                      outstanding,
                    )
                  : '—'
            }
            detail={`${overdueInvoices.length} overdue invoices`}
            tone={
              outstanding > 0
                ? 'warning'
                : 'success'
            }
            to={`/payments?clientId=${client.id}`}
          />
        </div>
      </section>

      <section className="client-workspace-main-grid">
        <div className="client-workspace-main-column">
          <WorkspaceCard
            icon={
              <FolderKanban
                size={18}
              />
            }
            title="Current Matters"
            subtitle={`${activeCases.length} active matters`}
            link={`/cases?clientId=${client.id}`}
            linkLabel="View all"
          >
            {loading ? (
              <WorkspaceState>
                Loading matters…
              </WorkspaceState>
            ) : activeCases.length ===
              0 ? (
              <WorkspaceState>
                No active matters.
              </WorkspaceState>
            ) : (
              <div className="client-workspace-matter-list">
                {activeCases
                  .slice(0, 5)
                  .map(
                    (caseRecord) => (
                      <Link
                        key={
                          caseRecord.id
                        }
                        to={`/cases/${caseRecord.id}`}
                      >
                        <div>
                          <strong>
                            {caseRecord.matter_number ??
                              caseRecord.case_number ??
                              'Legal matter'}
                          </strong>

                          <span>
                            {caseRecord.case_type}
                            {' · '}
                            {formatLabel(
                              caseRecord.status,
                            )}
                          </span>
                        </div>

                        <div>
                          {caseRecord
                            .requires_urgent_action ? (
                            <span className="client-workspace-danger-chip">
                              Urgent
                            </span>
                          ) : (
                            <span>
                              {formatLabel(
                                caseRecord.priority,
                              )}
                            </span>
                          )}

                          <ArrowRight
                            size={14}
                          />
                        </div>
                      </Link>
                    ),
                  )}
              </div>
            )}
          </WorkspaceCard>

          <div className="client-workspace-two-column">
            <WorkspaceCard
              icon={
                <ListTodo
                  size={18}
                />
              }
              title="Tasks Requiring Attention"
              subtitle={`${overdueTasks.length} overdue`}
              link={`/tasks?clientId=${client.id}`}
              linkLabel="View tasks"
            >
              {loading ? (
                <WorkspaceState>
                  Loading tasks…
                </WorkspaceState>
              ) : openTasks.length ===
                0 ? (
                <WorkspaceState>
                  No open tasks.
                </WorkspaceState>
              ) : (
                <CompactList>
                  {openTasks
                    .sort(
                      (
                        first,
                        second,
                      ) =>
                        getDateTime(
                          first.due_at,
                        ) -
                        getDateTime(
                          second.due_at,
                        ),
                    )
                    .slice(0, 4)
                    .map(
                      (task) => (
                        <Link
                          key={task.id}
                          to={`/tasks?taskId=${task.id}`}
                        >
                          <div>
                            <strong>
                              {task.title}
                            </strong>

                            <span>
                              {task.due_at
                                ? formatDate(
                                    task.due_at,
                                  )
                                : 'No due date'}
                            </span>
                          </div>

                          <span
                            className={
                              isPast(
                                task.due_at,
                              )
                                ? 'danger'
                                : ''
                            }
                          >
                            {formatLabel(
                              task.priority,
                            )}
                          </span>
                        </Link>
                      ),
                    )}
                </CompactList>
              )}
            </WorkspaceCard>

            <WorkspaceCard
              icon={
                <FileText
                  size={18}
                />
              }
              title="Recent Documents"
              subtitle={`${documents.length} client files`}
              link={`/documents?clientId=${client.id}`}
              linkLabel="View documents"
            >
              {loading ? (
                <WorkspaceState>
                  Loading documents…
                </WorkspaceState>
              ) : documents.length ===
                0 ? (
                <WorkspaceState>
                  No client documents.
                </WorkspaceState>
              ) : (
                <CompactList>
                  {documents
                    .slice(0, 4)
                    .map(
                      (
                        documentRecord,
                      ) => (
                        <Link
                          key={
                            documentRecord.id
                          }
                          to={`/documents?documentId=${documentRecord.id}`}
                        >
                          <div>
                            <strong>
                              {documentRecord.name}
                            </strong>

                            <span>
                              {documentRecord.document_type ??
                                'Document'}
                            </span>
                          </div>

                          <FileText
                            size={14}
                          />
                        </Link>
                      ),
                    )}
                </CompactList>
              )}
            </WorkspaceCard>
          </div>

          <WorkspaceCard
            icon={
              <CalendarClock
                size={18}
              />
            }
            title="Upcoming Hearings"
            subtitle={`${upcomingHearings.length} scheduled`}
            link={`/hearings?clientId=${client.id}`}
            linkLabel="Open calendar"
          >
            {loading ? (
              <WorkspaceState>
                Loading hearings…
              </WorkspaceState>
            ) : upcomingHearings.length ===
              0 ? (
              <WorkspaceState>
                No upcoming hearings.
              </WorkspaceState>
            ) : (
              <div className="client-hearing-preview-grid">
                {upcomingHearings
                  .slice(0, 3)
                  .map(
                    (hearing) => (
                      <Link
                        key={hearing.id}
                        to={`/hearings?hearingId=${hearing.id}`}
                      >
                        <time>
                          {formatDate(
                            hearing.hearing_at,
                          )}
                        </time>

                        <strong>
                          {hearing.title ??
                            hearing.case_number ??
                            'Court Hearing'}
                        </strong>

                        <span>
                          {hearing.court ??
                            'Court not specified'}
                        </span>
                      </Link>
                    ),
                  )}
              </div>
            )}
          </WorkspaceCard>
        </div>

        <aside className="client-workspace-side-column">
          <WorkspaceCard
            icon={
              <TrendingUp
                size={18}
              />
            }
            title="Financial Snapshot"
            subtitle="Client collection position"
            link={`/payments?clientId=${client.id}`}
            linkLabel="Open finance"
          >
            <div className="client-financial-metrics">
              <FinancialMetric
                icon={
                  <ReceiptText
                    size={15}
                  />
                }
                label="Total Billed"
                value={
                  financialSummary
                    ? formatCurrency(
                        totalBilled,
                      )
                    : '—'
                }
              />

              <FinancialMetric
                icon={
                  <WalletCards
                    size={15}
                  />
                }
                label="Net Collected"
                value={
                  financialSummary
                    ? formatCurrency(
                        totalPaid,
                      )
                    : '—'
                }
              />

              <FinancialMetric
                icon={
                  <CircleDollarSign
                    size={15}
                  />
                }
                label="Outstanding"
                value={
                  financialSummary
                    ? formatCurrency(
                        outstanding,
                      )
                    : '—'
                }
                danger={
                  outstanding > 0
                }
              />
            </div>

            <div className="client-collection-heading">
              <span>
                Collection rate
              </span>

              <strong>
                {financialSummary
                  ? `${collectionRate.toFixed(
                      0,
                    )}%`
                  : '—'}
              </strong>
            </div>

            <div className="client-collection-track">
              <div
                style={{
                  width:
                    financialSummary
                      ? `${collectionRate}%`
                      : '0%',
                }}
              />
            </div>
          </WorkspaceCard>

          <WorkspaceCard
            icon={
              <ReceiptText
                size={18}
              />
            }
            title="Latest Invoice"
            subtitle="Most recent billing record"
            link={`/payments?clientId=${client.id}&tab=invoices`}
            linkLabel="Invoices"
          >
            {latestInvoice ? (
              <div className="client-highlight-record">
                <strong>
                  {latestInvoice.invoice_number}
                </strong>

                <span>
                  {formatCurrency(
                    latestInvoice.total_amount,
                  )}
                </span>

                <small>
                  {formatLabel(
                    latestInvoice.status,
                  )}
                  {' · '}
                  {formatDate(
                    latestInvoice.issue_date,
                  )}
                </small>
              </div>
            ) : (
              <WorkspaceState>
                No invoices recorded.
              </WorkspaceState>
            )}
          </WorkspaceCard>

          <WorkspaceCard
            icon={
              <WalletCards
                size={18}
              />
            }
            title="Latest Payment"
            subtitle="Most recent client receipt"
            link={`/payments?clientId=${client.id}&tab=payments`}
            linkLabel="Payments"
          >
            {latestPayment ? (
              <div className="client-highlight-record success">
                <strong>
                  {formatCurrency(
                    latestPayment.amount,
                  )}
                </strong>

                <span>
                  Payment received
                </span>

                <small>
                  {formatDate(
                    getPaymentDate(
                      latestPayment,
                    ),
                  )}
                </small>
              </div>
            ) : (
              <WorkspaceState>
                No payments recorded.
              </WorkspaceState>
            )}
          </WorkspaceCard>

          <WorkspaceCard
            icon={
              <UserRoundCheck
                size={18}
              />
            }
            title="Client Status"
            subtitle="Relationship and risk"
          >
            <div className="client-status-list">
              <StatusRow
                label="Relationship"
                value={formatLabel(
                  client.status,
                )}
                positive={
                  normalize(
                    client.status,
                  ) === 'active'
                }
              />

              <StatusRow
                label="Risk Level"
                value={formatLabel(
                  client.risk_level ??
                    'low',
                )}
                positive={
                  ![
                    'high',
                    'critical',
                  ].includes(
                    normalize(
                      client.risk_level,
                    ),
                  )
                }
              />

              <StatusRow
                label="VIP Client"
                value={
                  client.is_vip ||
                  client.vip
                    ? 'Yes'
                    : 'No'
                }
                positive={
                  Boolean(
                    client.is_vip ||
                      client.vip,
                  )
                }
              />
            </div>
          </WorkspaceCard>
        </aside>
      </section>

      <section className="client-workspace-actions">
        <QuickAction
          icon={
            <FolderKanban
              size={17}
            />
          }
          label="Create Matter"
          to={`/cases/new?clientId=${client.id}`}
        />

        <QuickAction
          icon={
            <ReceiptText
              size={17}
            />
          }
          label="Create Invoice"
          to={`/payments?clientId=${client.id}&tab=invoices&createInvoice=1`}
        />

        <QuickAction
          icon={
            <Upload size={17} />
          }
          label="Upload Document"
          to={`/documents?clientId=${client.id}&upload=1`}
        />

        <QuickAction
          icon={
            <Gavel size={17} />
          }
          label="Schedule Hearing"
          to={`/hearings?clientId=${client.id}&schedule=1`}
        />

        <QuickAction
          icon={
            <ListTodo
              size={17}
            />
          }
          label="Create Task"
          to={`/tasks?clientId=${client.id}&create=1`}
        />

        <QuickAction
          icon={
            <BadgeDollarSign
              size={17}
            />
          }
          label="Record Payment"
          to={`/payments?clientId=${client.id}&tab=payments&createPayment=1`}
        />
      </section>
    </div>
  );
}

function CommandMetric({
  icon,
  label,
  value,
  detail,
  tone,
  to,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone:
    | 'normal'
    | 'success'
    | 'warning'
    | 'danger';
  to: string;
}) {
  return (
    <Link
      className={`client-command-metric ${tone}`}
      to={to}
    >
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>

        <p>
          {detail}
        </p>
      </div>
    </Link>
  );
}

function WorkspaceCard({
  icon,
  title,
  subtitle,
  link,
  linkLabel,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  link?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <article className="client-workspace-card">
      <header>
        <span>
          {icon}
        </span>

        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        {link &&
        linkLabel ? (
          <Link to={link}>
            {linkLabel}
            <ArrowRight
              size={13}
            />
          </Link>
        ) : null}
      </header>

      {children}
    </article>
  );
}

function FinancialMetric({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={
        danger
          ? 'client-financial-metric danger'
          : 'client-financial-metric'
      }
    >
      <span>{icon}</span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="client-status-row">
      <span>
        {positive ? (
          <CheckCircle2
            size={15}
          />
        ) : (
          <ShieldAlert
            size={15}
          />
        )}
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function CompactList({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="client-workspace-compact-list">
      {children}
    </div>
  );
}

function WorkspaceState({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="client-workspace-state">
      {children}
    </div>
  );
}

function QuickAction({
  icon,
  label,
  to,
}: {
  icon: ReactNode;
  label: string;
  to: string;
}) {
  return (
    <Link to={to}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function extractArray<T>(
  value: unknown,
): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    Array.isArray(
      (
        value as {
          data?: unknown;
        }
      ).data,
    )
  ) {
    return (
      value as {
        data: T[];
      }
    ).data;
  }

  return [];
}

function normalize(
  value: unknown,
): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function formatLabel(
  value: unknown,
): string {
  const normalized =
    normalize(value);

  if (!normalized) {
    return 'Not provided';
  }

  return normalized
    .replace(/_/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatCurrency(
  value: unknown,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency: 'AED',
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value ?? 0),
  );
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not scheduled';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Unknown';
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

function isPast(
  value: string | null | undefined,
): boolean {
  return (
    getDateTime(value) <
      Date.now() &&
    getDateTime(value) > 0
  );
}

function getDateTime(
  value: string | null | undefined,
): number {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  const time =
    new Date(value).getTime();

  return Number.isNaN(time)
    ? Number.MAX_SAFE_INTEGER
    : time;
}

function getRecordTime(
  value: {
    created_at?: string | null;
    payment_date?: string | null;
    issue_date?: string | null;
  },
): number {
  return getDateTime(
    value.payment_date ??
      value.issue_date ??
      value.created_at,
  );
}

function getPaymentDate(
  payment: Payment,
): string | null {
  const record =
    payment as Payment & {
      payment_date?: string | null;
      created_at?: string | null;
    };

  return (
    record.payment_date ??
    record.created_at ??
    null
  );
}

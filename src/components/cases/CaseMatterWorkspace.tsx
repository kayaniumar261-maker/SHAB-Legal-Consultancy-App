import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  History,
  ListTodo,
  LockKeyhole,
  MessageSquareText,
  Scale,
  ShieldAlert,
  TrendingUp,
  UsersRound,
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
  getCaseActivities,
  getCaseNotes,
  getCaseStatusHistory,
} from '../../services/caseService';

import {
  getHearingsByCase,
} from '../../services/hearingService';

import {
  getTasksByCase,
} from '../../services/taskService';

import {
  getDocumentsByCase,
} from '../../services/documentService';

import type {
  CaseActivity,
  CaseNote,
  CaseStatusHistory,
  CaseWithRelations,
} from '../../types/case';

import type {
  Hearing,
} from '../../types/hearing';

import type {
  Task,
} from '../../types/task';

import type {
  DocumentWithRelations,
} from '../../types/document';

import {
  CaseHealthPanel,
} from './CaseHealthPanel';

import './CaseMatterWorkspace.css';

type CaseMatterWorkspaceProps = {
  caseRecord: CaseWithRelations;
  clientName: string;
};

type TimelineItem = {
  id: string;
  type: 'activity' | 'status' | 'note';
  title: string;
  description: string | null;
  occurredAt: string;
  private?: boolean;
  pinned?: boolean;
};

export function CaseMatterWorkspace({
  caseRecord,
  clientName,
}: CaseMatterWorkspaceProps) {
  const [activities, setActivities] =
    useState<CaseActivity[]>([]);

  const [statusHistory, setStatusHistory] =
    useState<CaseStatusHistory[]>([]);

  const [notes, setNotes] =
    useState<CaseNote[]>([]);

  const [hearings, setHearings] =
    useState<Hearing[]>([]);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [documents, setDocuments] =
    useState<DocumentWithRelations[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [warning, setWarning] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setWarning(null);

      const results = await Promise.allSettled([
        getCaseActivities(caseRecord.id),
        getCaseStatusHistory(caseRecord.id),
        getCaseNotes(caseRecord.id),
        getHearingsByCase(caseRecord.id),
        getTasksByCase(caseRecord.id),
        getDocumentsByCase(caseRecord.id),
      ]);

      if (!active) {
        return;
      }

      const [
        activitiesResult,
        statusResult,
        notesResult,
        hearingsResult,
        tasksResult,
        documentsResult,
      ] = results;

      if (activitiesResult.status === 'fulfilled') {
        setActivities(activitiesResult.value);
      }

      if (statusResult.status === 'fulfilled') {
        setStatusHistory(statusResult.value);
      }

      if (notesResult.status === 'fulfilled') {
        setNotes(notesResult.value);
      }

      if (hearingsResult.status === 'fulfilled') {
        setHearings(hearingsResult.value);
      }

      if (tasksResult.status === 'fulfilled') {
        setTasks(tasksResult.value);
      }

      if (documentsResult.status === 'fulfilled') {
        setDocuments(documentsResult.value);
      }

      if (
        results.some(
          (result) => result.status === 'rejected',
        )
      ) {
        setWarning(
          'Some matter workspace information could not be loaded.',
        );
      }

      setLoading(false);
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [caseRecord.id]);

  const openTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !['completed'].includes(
            normalizeValue(task.status),
          ),
      ),
    [tasks],
  );

  const overdueTasks = useMemo(() => {
    const now = Date.now();

    return openTasks.filter((task) => {
      if (!task.due_at) {
        return false;
      }

      const dueTime =
        new Date(task.due_at).getTime();

      return (
        !Number.isNaN(dueTime) &&
        dueTime < now
      );
    });
  }, [openTasks]);

  const nextHearing = useMemo(() => {
    const now = Date.now();

    return hearings
      .filter((hearing) => {
        const hearingTime =
          new Date(
            hearing.hearing_at,
          ).getTime();

        const status =
          normalizeValue(
            hearing.status,
          );

        return (
          !Number.isNaN(hearingTime) &&
          hearingTime >= now &&
          ![
            'cancelled',
            'completed',
          ].includes(status)
        );
      })
      .sort(
        (first, second) =>
          new Date(
            first.hearing_at,
          ).getTime() -
          new Date(
            second.hearing_at,
          ).getTime(),
      )[0] ?? null;
  }, [hearings]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const activityItems =
      activities.map(
        (activity): TimelineItem => ({
          id: `activity-${activity.id}`,
          type: 'activity',
          title: activity.title,
          description:
            activity.description,
          occurredAt:
            activity.activity_at ??
            activity.created_at,
        }),
      );

    const statusItems =
      statusHistory.map(
        (status): TimelineItem => ({
          id: `status-${status.id}`,
          type: 'status',
          title: `Status changed to ${formatLabel(
            status.new_status,
          )}`,
          description:
            status.change_reason ??
            (
              status.previous_status
                ? `${formatLabel(
                    status.previous_status,
                  )} → ${formatLabel(
                    status.new_status,
                  )}`
                : null
            ),
          occurredAt:
            status.changed_at,
        }),
      );

    const noteItems =
      notes.map(
        (note): TimelineItem => ({
          id: `note-${note.id}`,
          type: 'note',
          title: note.is_pinned
            ? 'Pinned case note'
            : 'Case note added',
          description: note.note,
          occurredAt:
            note.created_at,
          private: note.is_private,
          pinned: note.is_pinned,
        }),
      );

    return [
      ...activityItems,
      ...statusItems,
      ...noteItems,
    ]
      .sort(
        (first, second) =>
          new Date(
            second.occurredAt,
          ).getTime() -
          new Date(
            first.occurredAt,
          ).getTime(),
      )
      .slice(0, 8);
  }, [
    activities,
    notes,
    statusHistory,
  ]);

  const recoveryRate = useMemo(() => {
    const claimAmount = Number(
      caseRecord.claim_amount ??
        caseRecord.case_value ??
        0,
    );

    const recoveredAmount = Number(
      caseRecord.recovered_amount ?? 0,
    );

    if (claimAmount <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(
        0,
        (
          recoveredAmount /
          claimAmount
        ) * 100,
      ),
    );
  }, [
    caseRecord.case_value,
    caseRecord.claim_amount,
    caseRecord.recovered_amount,
  ]);

  const progress = Math.min(
    100,
    Math.max(
      0,
      Number(
        caseRecord.completion_percentage ??
          inferProgress(
            caseRecord.status,
          ),
      ),
    ),
  );

  const recentDocuments =
    documents.slice(0, 4);

  const recentTasks =
    openTasks
      .sort((first, second) => {
        if (!first.due_at) {
          return 1;
        }

        if (!second.due_at) {
          return -1;
        }

        return (
          new Date(
            first.due_at,
          ).getTime() -
          new Date(
            second.due_at,
          ).getTime()
        );
      })
      .slice(0, 4);

  return (
    <div className="matter-workspace">
      {warning ? (
        <div className="matter-workspace-warning">
          <AlertCircle size={17} />
          {warning}
        </div>
      ) : null}

      <section className="matter-action-center">
        <div className="matter-section-heading">
          <div>
            <span>Immediate attention</span>
            <h3>Action Centre</h3>
            <p>
              The next deadlines, risks and financial
              actions for this matter.
            </p>
          </div>

          <ShieldAlert size={22} />
        </div>

        <div className="matter-action-grid">
          <ActionItem
            icon={<Gavel size={18} />}
            label="Next Hearing"
            value={
              loading
                ? 'Loading…'
                : nextHearing
                  ? formatDateTime(
                      nextHearing.hearing_at,
                    )
                  : 'Not scheduled'
            }
            detail={
              nextHearing?.court ??
              'Court schedule'
            }
            to={`/hearings?caseId=${caseRecord.id}`}
            tone={
              nextHearing
                ? 'warning'
                : 'neutral'
            }
          />

          <ActionItem
            icon={<ListTodo size={18} />}
            label="Open Tasks"
            value={
              loading
                ? '—'
                : String(openTasks.length)
            }
            detail={`${overdueTasks.length} overdue`}
            to={`/tasks?caseId=${caseRecord.id}`}
            tone={
              overdueTasks.length > 0
                ? 'danger'
                : 'success'
            }
          />

          <ActionItem
            icon={<Banknote size={18} />}
            label="Outstanding Fees"
            value={formatCurrency(
              caseRecord.outstanding_balance,
              caseRecord.currency,
            )}
            detail="Unpaid case balance"
            to={`/payments?caseId=${caseRecord.id}`}
            tone={
              Number(
                caseRecord.outstanding_balance ??
                  0,
              ) > 0
                ? 'warning'
                : 'success'
            }
          />

          <ActionItem
            icon={<Clock3 size={18} />}
            label="Next Action"
            value={
              caseRecord.next_action_at
                ? formatDateTime(
                    caseRecord.next_action_at,
                  )
                : 'Not scheduled'
            }
            detail={
              caseRecord.next_actions ??
              'No action description'
            }
            to={`/tasks?caseId=${caseRecord.id}`}
            tone={
              isPast(
                caseRecord.next_action_at,
              )
                ? 'danger'
                : 'neutral'
            }
          />
        </div>
      </section>

      <CaseHealthPanel
        progress={progress}
        recoveryRate={recoveryRate}
        openTasks={openTasks.length}
        overdueTasks={overdueTasks.length}
        hasUpcomingHearing={Boolean(nextHearing)}
        nextHearingAt={
          nextHearing?.hearing_at ?? null
        }
        timelineCount={timeline.length}
        urgent={Boolean(
          caseRecord.requires_urgent_action ||
          normalizeValue(
            caseRecord.priority,
          ) === 'urgent'
        )}
        highRisk={
          [
            'high',
            'critical',
          ].includes(
            normalizeValue(
              caseRecord.risk_level,
            ),
          )
        }
        outstandingBalance={Number(
          caseRecord.outstanding_balance ?? 0,
        )}
        nextActionOverdue={isPast(
          caseRecord.next_action_at,
        )}
      />

      <section className="matter-workspace-primary-grid">
        <article className="matter-workspace-card matter-progress-card">
          <SectionHeader
            icon={<TrendingUp size={18} />}
            title="Matter Progress"
            subtitle={formatLabel(
              caseRecord.status,
            )}
          />

          <strong className="matter-progress-value">
            {progress.toFixed(0)}%
          </strong>

          <div className="matter-progress-track">
            <div
              className="matter-progress-fill"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>

          <div className="matter-progress-stages">
            {[
              'Opened',
              'Review',
              'Court',
              'Judgment',
              'Execution',
              'Closed',
            ].map((stage, index) => (
              <span
                key={stage}
                className={
                  progress >=
                  (
                    index /
                    5
                  ) * 100
                    ? 'complete'
                    : ''
                }
              >
                {stage}
              </span>
            ))}
          </div>

          <div className="matter-progress-details">
            <DetailMetric
              label="Priority"
              value={formatLabel(
                caseRecord.priority,
              )}
            />

            <DetailMetric
              label="Risk"
              value={formatLabel(
                caseRecord.risk_level,
              )}
            />

            <DetailMetric
              label="Opened"
              value={formatDate(
                caseRecord.opened_at ??
                  caseRecord.filing_date,
              )}
            />
          </div>
        </article>

        <article className="matter-workspace-card">
          <SectionHeader
            icon={<UsersRound size={18} />}
            title="Matter Team"
            subtitle={clientName}
          />

          <div className="matter-team-list">
            <TeamMember
              label="Responsible Lawyer"
              name={
                caseRecord
                  .responsible_lawyer
                  ?.full_name ??
                caseRecord
                  .assigned_staff
                  ?.full_name ??
                'Unassigned'
              }
            />

            <TeamMember
              label="Case Manager"
              name={
                caseRecord
                  .case_manager
                  ?.full_name ??
                'Unassigned'
              }
            />

            <TeamMember
              label="Legal Assistant"
              name={
                caseRecord
                  .legal_assistant
                  ?.full_name ??
                'Unassigned'
              }
            />

            <TeamMember
              label="Department"
              name={
                caseRecord.department ??
                caseRecord.assigned_team ??
                'Not specified'
              }
            />
          </div>
        </article>

        <article className="matter-workspace-card matter-financial-card">
          <SectionHeader
            icon={<Scale size={18} />}
            title="Financial Snapshot"
            subtitle="Recovery and billing position"
          />

          <div className="matter-financial-grid">
            <DetailMetric
              label="Claim Value"
              value={formatCurrency(
                caseRecord.claim_amount ??
                  caseRecord.case_value,
                caseRecord.currency,
              )}
            />

            <DetailMetric
              label="Recovered"
              value={formatCurrency(
                caseRecord.recovered_amount,
                caseRecord.currency,
              )}
            />

            <DetailMetric
              label="Total Billed"
              value={formatCurrency(
                caseRecord.total_billed,
                caseRecord.currency,
              )}
            />

            <DetailMetric
              label="Outstanding"
              value={formatCurrency(
                caseRecord.outstanding_balance,
                caseRecord.currency,
              )}
            />
          </div>

          <div className="matter-recovery-heading">
            <span>Recovery rate</span>
            <strong>
              {recoveryRate.toFixed(0)}%
            </strong>
          </div>

          <div className="matter-recovery-track">
            <div
              className="matter-recovery-fill"
              style={{
                width:
                  `${recoveryRate}%`,
              }}
            />
          </div>

          <Link
            className="matter-card-link"
            to={`/payments?caseId=${caseRecord.id}`}
          >
            Open case finance
            <ArrowRight size={14} />
          </Link>
        </article>
      </section>

      <section className="matter-workspace-secondary-grid">
        <article className="matter-workspace-card matter-activity-card">
          <SectionHeader
            icon={<History size={18} />}
            title="Recent Matter Activity"
            subtitle="Activities, notes and status changes"
          />

          {loading ? (
            <WorkspaceState>
              Loading activity…
            </WorkspaceState>
          ) : timeline.length === 0 ? (
            <WorkspaceState>
              No activity recorded yet.
            </WorkspaceState>
          ) : (
            <div className="matter-timeline">
              {timeline.map((item) => (
                <div
                  key={item.id}
                  className={`matter-timeline-item ${item.type}`}
                >
                  <div className="matter-timeline-marker">
                    {item.type === 'note' ? (
                      <MessageSquareText
                        size={14}
                      />
                    ) : item.type ===
                      'status' ? (
                      <CheckCircle2
                        size={14}
                      />
                    ) : (
                      <History size={14} />
                    )}
                  </div>

                  <div>
                    <div className="matter-timeline-heading">
                      <strong>
                        {item.title}
                      </strong>

                      <time>
                        {formatRelativeTime(
                          item.occurredAt,
                        )}
                      </time>
                    </div>

                    {item.description ? (
                      <p>
                        {item.description}
                      </p>
                    ) : null}

                    {item.private ? (
                      <span className="matter-private-badge">
                        <LockKeyhole
                          size={11}
                        />
                        Private
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="matter-card-actions">
            <button
              type="button"
              onClick={() => {
                document
                  .querySelector<HTMLButtonElement>(
                    '[data-case-tab="Timeline"]',
                  )
                  ?.click();
              }}
            >
              View full history
            </button>

            <button
              type="button"
              onClick={() => {
                document
                  .querySelector<HTMLButtonElement>(
                    '[data-case-tab="Notes"]',
                  )
                  ?.click();
              }}
            >
              Open notes
            </button>
          </div>
        </article>

        <div className="matter-workspace-side-stack">
          <article className="matter-workspace-card">
            <SectionHeader
              icon={<ListTodo size={18} />}
              title="Priority Tasks"
              subtitle={`${openTasks.length} open`}
            />

            {loading ? (
              <WorkspaceState>
                Loading tasks…
              </WorkspaceState>
            ) : recentTasks.length === 0 ? (
              <WorkspaceState>
                No open tasks.
              </WorkspaceState>
            ) : (
              <div className="matter-compact-list">
                {recentTasks.map((task) => (
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
                          ? formatDateTime(
                              task.due_at,
                            )
                          : 'No due date'}
                      </span>
                    </div>

                    <span
                      className={`matter-list-status ${
                        isPast(
                          task.due_at,
                        )
                          ? 'danger'
                          : ''
                      }`}
                    >
                      {formatLabel(
                        task.priority,
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <Link
              className="matter-card-link"
              to={`/tasks?caseId=${caseRecord.id}`}
            >
              View all tasks
              <ArrowRight size={14} />
            </Link>
          </article>

          <article className="matter-workspace-card">
            <SectionHeader
              icon={<FileText size={18} />}
              title="Recent Documents"
              subtitle={`${documents.length} linked files`}
            />

            {loading ? (
              <WorkspaceState>
                Loading documents…
              </WorkspaceState>
            ) : recentDocuments.length === 0 ? (
              <WorkspaceState>
                No documents uploaded.
              </WorkspaceState>
            ) : (
              <div className="matter-compact-list">
                {recentDocuments.map(
                  (documentRecord) => (
                    <Link
                      key={documentRecord.id}
                      to={`/documents?caseId=${caseRecord.id}`}
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

                      {documentRecord.is_confidential ? (
                        <LockKeyhole
                          size={14}
                        />
                      ) : (
                        <FileText
                          size={14}
                        />
                      )}
                    </Link>
                  ),
                )}
              </div>
            )}

            <Link
              className="matter-card-link"
              to={`/documents?caseId=${caseRecord.id}`}
            >
              View all documents
              <ArrowRight size={14} />
            </Link>
          </article>
        </div>
      </section>

      <section className="matter-quick-links">
        <MatterQuickLink
          icon={<Gavel size={17} />}
          label="Schedule Hearing"
          to={`/hearings?caseId=${caseRecord.id}&schedule=1`}
        />

        <MatterQuickLink
          icon={<ListTodo size={17} />}
          label="Create Task"
          to={`/tasks?caseId=${caseRecord.id}&create=1`}
        />

        <MatterQuickLink
          icon={<FileText size={17} />}
          label="Upload Document"
          to={`/documents?caseId=${caseRecord.id}&upload=1`}
        />

        <MatterQuickLink
          icon={<Banknote size={17} />}
          label="Create Invoice"
          to={`/payments?caseId=${caseRecord.id}&tab=invoices&createInvoice=1`}
        />
      </section>
    </div>
  );
}

function ActionItem({
  icon,
  label,
  value,
  detail,
  to,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  to: string;
  tone:
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral';
}) {
  return (
    <Link
      className={`matter-action-item ${tone}`}
      to={to}
    >
      <div className="matter-action-icon">
        {icon}
      </div>

      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Link>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="matter-card-header">
      <div className="matter-card-header-icon">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function TeamMember({
  label,
  name,
}: {
  label: string;
  name: string;
}) {
  return (
    <div className="matter-team-member">
      <div className="matter-team-avatar">
        {getInitials(name)}
      </div>

      <div>
        <span>{label}</span>
        <strong>{name}</strong>
      </div>
    </div>
  );
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="matter-detail-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkspaceState({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="matter-workspace-state">
      {children}
    </div>
  );
}

function MatterQuickLink({
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

function normalizeValue(
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
    normalizeValue(value);

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
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  return new Intl.NumberFormat(
    'en-AE',
    {
      style: 'currency',
      currency: currency || 'AED',
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not scheduled';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(
    'en-AE',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function formatRelativeTime(
  value: string,
): string {
  const date = new Date(value);
  const difference =
    Date.now() - date.getTime();

  if (
    Number.isNaN(date.getTime())
  ) {
    return 'Unknown';
  }

  const minutes =
    Math.floor(
      difference / 60_000,
    );

  if (minutes < 1) {
    return 'Just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(hours / 24);

  if (days < 30) {
    return `${days}d ago`;
  }

  return formatDate(value);
}

function isPast(
  value: string | null | undefined,
): boolean {
  if (!value) {
    return false;
  }

  const time =
    new Date(value).getTime();

  return (
    !Number.isNaN(time) &&
    time < Date.now()
  );
}

function inferProgress(
  status: unknown,
): number {
  const normalized =
    normalizeValue(status);

  const progressByStatus:
    Record<string, number> = {
      draft: 5,
      open: 15,
      under_review: 25,
      investigation: 30,
      negotiation: 40,
      in_court: 55,
      judgment: 70,
      appeal: 75,
      execution: 88,
      settled: 95,
      closed: 100,
    };

  return (
    progressByStatus[
      normalized
    ] ?? 20
  );
}

function getInitials(
  name: string,
): string {
  if (
    !name ||
    name === 'Unassigned'
  ) {
    return '—';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0),
    )
    .join('')
    .toUpperCase();
}

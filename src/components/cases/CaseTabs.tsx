import { useMemo, useState, useEffect } from 'react';

import {
  CalendarPlus,
  ExternalLink,
  Gavel,
  MapPin,
  FileText,
  LockKeyhole,
  Download,
  ShieldCheck,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import type { Case } from '../../types/case';
import type { Hearing } from '../../types/hearing';
import type { Task } from '../../types/task';
import type { DocumentWithRelations } from '../../types/document';
import { getHearingsByCase } from '../../services/hearingService';
import {
  getTasksByCase,
  getStaffOptions,
  type StaffOption,
} from '../../services/taskService';
import {
  getDocumentsByCase,
  openDocument,
  downloadDocument,
} from '../../services/documentService';
import { CaseBillingWorkspace } from './CaseBillingWorkspace';
import './CaseTabs.css';

const tabs = [
  'Overview',
  'Hearings',
  'Documents',
  'Tasks',
  'Billing',
  'Timeline',
  'Notes',
] as const;

type CaseTabsProps = {
  caseRecord: Case;
  clientName: string;
};

export function CaseTabs({
  caseRecord,
  clientName,
}: CaseTabsProps) {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Overview');
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [loadingHearings, setLoadingHearings] = useState(false);
  const [hearingError, setHearingError] =
    useState<string | null>(null);
  const [caseTasks, setCaseTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [taskStaff, setTaskStaff] = useState<Record<string, string>>({});
  const [caseDocuments, setCaseDocuments] = useState<DocumentWithRelations[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentActionId, setDocumentActionId] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'Hearings') {
      return;
    }

    let active = true;

    async function loadHearings() {
      try {
        setLoadingHearings(true);
        setHearingError(null);

        const rows =
          await getHearingsByCase(
            caseRecord.id,
          );

        if (active) {
          setHearings(rows);
        }
      } catch (error) {
        if (active) {
          setHearings([]);
          setHearingError(
            error instanceof Error
              ? error.message
              : 'Unable to load hearings.',
          );
        }
      } finally {
        if (active) {
          setLoadingHearings(false);
        }
      }
    }

    void loadHearings();

    return () => {
      active = false;
    };
  }, [activeTab, caseRecord.id]);

  useEffect(() => {
    if (activeTab !== 'Tasks') {
      return;
    }

    let active = true;

    async function loadCaseTasks() {
      try {
        setLoadingTasks(true);
        setTasksError(null);

        const [tasks, staffOptions] = await Promise.all([
          getTasksByCase(caseRecord.id),
          getStaffOptions(),
        ]);

        if (!active) {
          return;
        }

        setCaseTasks(tasks);
        setTaskStaff(
          staffOptions.reduce<Record<string, string>>(
            (accumulator, member) => {
              accumulator[member.id] = member.name;
              return accumulator;
            },
            {},
          ),
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setCaseTasks([]);
        setTasksError(
          error instanceof Error
            ? error.message
            : 'Unable to load tasks.',
        );
      } finally {
        if (active) {
          setLoadingTasks(false);
        }
      }
    }

    void loadCaseTasks();

    return () => {
      active = false;
    };
  }, [activeTab, caseRecord.id]);

  useEffect(() => {
    if (activeTab !== 'Documents') {
      return;
    }

    let active = true;

    async function loadCaseDocuments() {
      try {
        setLoadingDocuments(true);
        setDocumentsError(null);

        const rows = await getDocumentsByCase(
          caseRecord.id,
        );

        if (!active) {
          return;
        }

        setCaseDocuments(rows);
      } catch (error) {
        if (!active) {
          return;
        }

        setCaseDocuments([]);
        setDocumentsError(
          error instanceof Error
            ? error.message
            : 'Unable to load case documents.',
        );
      } finally {
        if (active) {
          setLoadingDocuments(false);
        }
      }
    }

    void loadCaseDocuments();

    return () => {
      active = false;
    };
  }, [activeTab, caseRecord.id]);

  const nextUpcomingHearing =
    useMemo(() => {
      const now = Date.now();

      return hearings
        .filter((hearing) => {
          const status =
            normalizeStatus(
              hearing.status,
            );

          if (
            status === 'cancelled' ||
            status === 'completed'
          ) {
            return false;
          }

          const time =
            new Date(
              hearing.hearing_at,
            ).getTime();

          return (
            !Number.isNaN(time) &&
            time >= now
          );
        })
        .sort(
          (a, b) =>
            new Date(
              a.hearing_at,
            ).getTime() -
            new Date(
              b.hearing_at,
            ).getTime(),
        )[0] ?? null;
    }, [hearings]);

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'Overview':
        return (
          <div className="case-tabs-content-grid">
            <article className="case-summary-card">
              <h3>Summary</h3>
              <div className="case-summary-row">
                <span>Case Number</span>
                <strong>{caseRecord.case_number}</strong>
              </div>
              <div className="case-summary-row">
                <span>Client</span>
                <strong>{clientName}</strong>
              </div>
              <div className="case-summary-row">
                <span>Case Type</span>
                <strong>{caseRecord.case_type}</strong>
              </div>
              <div className="case-summary-row">
                <span>Court</span>
                <strong>{caseRecord.court}</strong>
              </div>
              <div className="case-summary-row">
                <span>Assigned Staff</span>
                <strong>{caseRecord.assigned_staff_id ?? 'Unassigned'}</strong>
              </div>
              <div className="case-summary-row">
                <span>Status</span>
                <strong>{caseRecord.status}</strong>
              </div>
              <div className="case-summary-row">
                <span>Priority</span>
                <strong>{caseRecord.priority}</strong>
              </div>
            </article>

            <article className="case-summary-card">
              <h3>Dates</h3>
              <div className="case-summary-row">
                <span>Filing Date</span>
                <strong>{formatDate(caseRecord.filing_date)}</strong>
              </div>
              <div className="case-summary-row">
                <span>Next Hearing</span>
                <strong>
                  {caseRecord.next_hearing_at
                    ? formatDate(caseRecord.next_hearing_at)
                    : 'Not scheduled'}
                </strong>
              </div>
              <div className="case-summary-row">
                <span>Case Value</span>
                <strong>
                  {caseRecord.case_value != null
                    ? `AED ${caseRecord.case_value.toLocaleString('en-AE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : 'Not set'}
                </strong>
              </div>
            </article>

            <article className="case-summary-card case-summary-card-wide">
              <h3>Case details</h3>
              <p>{caseRecord.description || 'No description provided.'}</p>
            </article>
          </div>
        );

      case 'Hearings':
        return (
          <div className="case-hearings-workspace">
            <div className="case-hearings-header">
              <div>
                <span className="case-hearings-eyebrow">
                  Court schedule
                </span>

                <h3>Hearings</h3>

                <p>
                  Hearing dates are synchronized with the central Hearings module.
                </p>
              </div>

              <div className="case-hearings-actions">
                <Link
                  className="secondary-action-button"
                  to={`/hearings?caseId=${caseRecord.id}`}
                >
                  <ExternalLink size={15} />
                  View All
                </Link>

                <Link
                  className="primary-action-button"
                  to={`/hearings?caseId=${caseRecord.id}&schedule=1`}
                >
                  <CalendarPlus size={15} />
                  Schedule Hearing
                </Link>
              </div>
            </div>

            {nextUpcomingHearing && (
              <div className="case-next-hearing">
                <div className="case-next-hearing-icon">
                  <Gavel size={17} />
                </div>

                <div>
                  <span>Next Hearing</span>

                  <strong>
                    {nextUpcomingHearing.title ||
                      'Court Hearing'}
                  </strong>

                  <small>
                    {formatDateTime(
                      nextUpcomingHearing.hearing_at,
                    )}
                    {' · '}
                    {nextUpcomingHearing.court ||
                      'Court not set'}
                  </small>
                </div>
              </div>
            )}

            {loadingHearings ? (
              <div className="case-empty-state">
                Loading hearings…
              </div>
            ) : hearingError ? (
              <div className="case-empty-state case-hearing-error">
                <strong>
                  Unable to load hearings
                </strong>

                <p>{hearingError}</p>
              </div>
            ) : hearings.length === 0 ? (
              <div className="case-empty-state">
                <Gavel size={22} />

                <strong>
                  No hearings scheduled
                </strong>

                <p>
                  Schedule the first hearing for this matter.
                </p>

                <Link
                  className="primary-action-button"
                  to={`/hearings?caseId=${caseRecord.id}&schedule=1`}
                >
                  <CalendarPlus size={15} />
                  Schedule Hearing
                </Link>
              </div>
            ) : (
              <div className="case-hearing-list">
                {hearings.map((hearing) => {
                  const status =
                    normalizeStatus(
                      hearing.status,
                    );

                  const isNext =
                    nextUpcomingHearing?.id ===
                    hearing.id;

                  return (
                    <article
                      key={hearing.id}
                      className={[
                        'case-hearing-row',
                        isNext
                          ? 'is-next'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="case-hearing-date">
                        <strong>
                          {formatDay(
                            hearing.hearing_at,
                          )}
                        </strong>

                        <span>
                          {formatMonth(
                            hearing.hearing_at,
                          )}
                        </span>

                        <small>
                          {formatTime(
                            hearing.hearing_at,
                          )}
                        </small>
                      </div>

                      <div className="case-hearing-main">
                        <div className="case-hearing-title-row">
                          <div>
                            <strong>
                              {hearing.title ||
                                'Court Hearing'}
                            </strong>

                            {isNext && (
                              <span className="case-next-chip">
                                Next
                              </span>
                            )}
                          </div>

                          <span
                            className={`hearing-status-badge hearing-status-${status.replace(
                              /\s+/g,
                              '-',
                            )}`}
                          >
                            {formatLabel(
                              hearing.status ||
                                'Scheduled',
                            )}
                          </span>
                        </div>

                        <div className="case-hearing-meta">
                          <span>
                            <Gavel size={13} />
                            {formatLabel(
                              hearing.hearing_type ||
                                'Hearing',
                            )}
                          </span>

                          <span>
                            <MapPin size={13} />
                            {hearing.court ||
                              'Court not set'}

                            {hearing.courtroom
                              ? ` · ${hearing.courtroom}`
                              : ''}
                          </span>
                        </div>

                        {hearing.outcome && (
                          <p className="case-hearing-outcome">
                            <strong>
                              Outcome:
                            </strong>{' '}
                            {hearing.outcome}
                          </p>
                        )}
                      </div>

                      <Link
                        className="case-hearing-open"
                        to={`/hearings?caseId=${caseRecord.id}`}
                      >
                        Open
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'Documents':
        return (
            <div className="case-documents-workspace">
              <div className="case-documents-header">
                <div>
                  <span className="case-hearings-eyebrow">
                    Documents workspace
                  </span>
                  <h3>Case documents</h3>
                  <p>
                    Manage files attached to this case, preview metadata, and open or download documents securely.
                  </p>
                </div>

                <div className="case-hearings-actions">
                  <Link
                    className="secondary-action-button"
                    to={`/documents?caseId=${caseRecord.id}`}
                  >
                    View All
                  </Link>

                  <Link
                    className="primary-action-button"
                    to={`/documents?caseId=${caseRecord.id}&upload=1`}
                  >
                    Upload Document
                  </Link>
                </div>
              </div>

              <section className="case-documents-summary">
                <div>
                  <span>Total documents</span>
                  <strong>{caseDocuments.length}</strong>
                </div>
                <div>
                  <span>Confidential</span>
                  <strong>
                    {caseDocuments.filter(
                      (document) => document.is_confidential,
                    ).length}
                  </strong>
                </div>
                <div>
                  <span>Standard</span>
                  <strong>
                    {caseDocuments.filter(
                      (document) => !document.is_confidential,
                    ).length}
                  </strong>
                </div>
                <div>
                  <span>Latest upload</span>
                  <strong>
                    {caseDocuments.length > 0
                      ? formatDateTime(
                          caseDocuments[0].created_at,
                        )
                      : 'No uploads yet'}
                  </strong>
                </div>
              </section>

              {documentActionError && (
                <div className="case-empty-state case-hearing-error">
                  <strong>Document action failed</strong>
                  <p>{documentActionError}</p>
                </div>
              )}

              {loadingDocuments ? (
                <div className="case-empty-state">
                  <strong>Loading documents…</strong>
                </div>
              ) : documentsError ? (
                <div className="case-empty-state case-hearing-error">
                  <strong>Unable to load documents</strong>
                  <p>{documentsError}</p>
                </div>
              ) : caseDocuments.length === 0 ? (
                <div className="case-empty-state">
                  <strong>No documents found</strong>
                  <p>
                    Documents uploaded for this case will appear here. Use the upload workflow to add evidence, filings, and related materials.
                  </p>
                </div>
              ) : (
                <div className="case-documents-table-wrap">
                  <table className="case-documents-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Size</th>
                        <th>Uploaded</th>
                        <th>Version</th>
                        <th>Privacy</th>
                        <th>Uploaded by</th>
                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {caseDocuments.map((document) => {
                        const actionLoading =
                          documentActionId === document.id;

                        return (
                          <tr key={document.id}>
                            <td>{document.name}</td>
                            <td>{document.document_type || document.mime_type || 'File'}</td>
                            <td>
                              {document.description
                                ? document.description.slice(0, 80)
                                : 'No description'}
                            </td>
                            <td>{formatFileSize(document.size_bytes)}</td>
                            <td>{formatDateTime(document.created_at)}</td>
                            <td>{document.version}</td>
                            <td>
                              <span
                                className={`case-document-privacy-badge ${
                                  document.is_confidential
                                    ? 'confidential'
                                    : 'standard'
                                }`}
                              >
                                {document.is_confidential
                                  ? 'Confidential'
                                  : 'Standard'}
                              </span>
                            </td>
                            <td>
                              {document.uploaded_by_staff?.full_name ?? document.uploaded_by ?? 'Unknown'}
                            </td>
                            <td>
                              <div className="case-document-actions">
                                <Link
                                  to={`/documents?caseId=${caseRecord.id}&documentId=${document.id}`}
                                  className="case-document-action"
                                >
                                  <ExternalLink size={14} />
                                </Link>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDocumentActionId(document.id);
                                    setDocumentActionError(null);

                                    try {
                                      await openDocument(document);
                                    } catch (error) {
                                      setDocumentActionError(
                                        error instanceof Error
                                          ? error.message
                                          : 'Unable to open document.',
                                      );
                                    } finally {
                                      setDocumentActionId(null);
                                    }
                                  }}
                                  disabled={actionLoading}
                                  title="Open"
                                >
                                  <ExternalLink size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    setDocumentActionId(document.id);
                                    setDocumentActionError(null);

                                    try {
                                      await downloadDocument(document);
                                    } catch (error) {
                                      setDocumentActionError(
                                        error instanceof Error
                                          ? error.message
                                          : 'Unable to download document.',
                                      );
                                    } finally {
                                      setDocumentActionId(null);
                                    }
                                  }}
                                  disabled={actionLoading}
                                  title="Download"
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );

      case 'Tasks':
        return (
          <div className="case-tasks-workspace">
            <div className="case-tasks-header">
              <div>
                <span className="case-hearings-eyebrow">
                  Task workspace
                </span>
                <h3>Case tasks</h3>
                <p>
                  Tasks for this matter are synchronized with the central tasks module.
                </p>
              </div>

              <div className="case-hearings-actions">
                <Link
                  className="secondary-action-button"
                  to={`/tasks?caseId=${caseRecord.id}`}
                >
                  View All
                </Link>

                <Link
                  className="primary-action-button"
                  to={`/tasks?caseId=${caseRecord.id}&create=1`}
                >
                  Add Task
                </Link>
              </div>
            </div>

            <section className="case-tasks-summary">
              <div>
                <span>Total tasks</span>
                <strong>{caseTasks.length}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>
                  {caseTasks.filter(
                    (task) =>
                      task.status !== 'Completed',
                  ).length}
                </strong>
              </div>
              <div>
                <span>Overdue</span>
                <strong>
                  {caseTasks.filter((task) => {
                    if (task.status === 'Completed') {
                      return false;
                    }

                    if (!task.due_at) {
                      return false;
                    }

                    return (
                      new Date(task.due_at).getTime() <
                      Date.now()
                    );
                  }).length}
                </strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>
                  {caseTasks.filter(
                    (task) =>
                      task.status === 'Completed',
                  ).length}
                </strong>
              </div>
            </section>

            {loadingTasks ? (
              <div className="case-empty-state">
                <strong>Loading tasks…</strong>
              </div>
            ) : tasksError ? (
              <div className="case-empty-state case-hearing-error">
                <strong>Unable to load tasks</strong>
                <p>{tasksError}</p>
              </div>
            ) : caseTasks.length === 0 ? (
              <div className="case-empty-state">
                <strong>No tasks found</strong>
                <p>
                  Create the first task related to this case to track work and deadlines.
                </p>
                <Link
                  className="primary-action-button"
                  to={`/tasks?caseId=${caseRecord.id}&create=1`}
                >
                  Add Task
                </Link>
              </div>
            ) : (
              <div className="case-task-list">
                {caseTasks.map((task) => {
                  const isOverdue =
                    task.status !== 'Completed' &&
                    task.due_at &&
                    new Date(task.due_at).getTime() <
                      Date.now();

                  return (
                    <article
                      key={task.id}
                      className={`case-task-row ${
                        isOverdue ? 'is-overdue' : ''
                      } ${
                        task.priority === 'Urgent'
                          ? 'is-urgent'
                          : ''
                      } ${
                        task.status === 'Completed'
                          ? 'is-completed'
                          : ''
                      }`}
                    >
                      <div className="case-task-main">
                        <Link
                          to={`/tasks?caseId=${caseRecord.id}&taskId=${task.id}`}
                          className="case-task-title-link"
                        >
                          <strong>{task.title}</strong>
                          <span>
                            {task.description || 'No description provided.'}
                          </span>
                        </Link>
                      </div>

                      <div className="case-task-meta">
                        <span className={`status-badge status-${task.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {task.status}
                        </span>
                        <span className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        <span>
                          {task.due_at
                            ? new Intl.DateTimeFormat('en-AE', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              }).format(new Date(task.due_at))
                            : 'No due date'}
                        </span>
                        <span>
                          {task.assigned_staff_id
                            ? taskStaff[task.assigned_staff_id] ?? 'Assigned staff'
                            : 'Unassigned'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'Billing':
        return (
          <CaseBillingWorkspace
            caseId={caseRecord.id}
          />
        );

      case 'Timeline':
        return (
          <div className="case-empty-state">
            <strong>Timeline</strong>
            <p>
              Follow case progress and event history across filings, hearings, and notes in the timeline.
            </p>
          </div>
        );

      case 'Notes':
        return (
          <article className="case-summary-card case-summary-card-wide">
            <h3>Internal Notes</h3>
            <p>{caseRecord.internal_notes || 'No internal notes have been added.'}</p>
          </article>
        );

      default:
        return null;
    }
  }, [
    activeTab,
    caseRecord,
    clientName,
    hearings,
    loadingHearings,
    hearingError,
    nextUpcomingHearing,
    caseDocuments,
    loadingDocuments,
    documentsError,
    documentActionError,
    documentActionId,
  ]);

  return (
    <div className="case-tabs">
      <div className="case-tabs-navigation">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={
              tab === activeTab
                ? 'case-tab-button case-tab-button-active'
                : 'case-tab-button'
            }
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="case-tabs-panel">{tabContent}</div>
    </div>
  );
}

function normalizeStatus(
  value: string | null | undefined,
): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/_/g, '-') ??
    ''
  );
}

function formatLabel(
  value: string,
): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    );
}

function formatDateTime(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
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

function formatFileSize(
  value?: number | null,
): string {
  const bytes = Number(value ?? 0);

  if (!bytes) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDay(
  value: string,
): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '--'
    : String(date.getDate()).padStart(
        2,
        '0',
      );
}

function formatMonth(
  value: string,
): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '---'
    : new Intl.DateTimeFormat(
        'en-AE',
        {
          month: 'short',
        },
      ).format(date);
}

function formatTime(
  value: string,
): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '--:--'
    : new Intl.DateTimeFormat(
        'en-GB',
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      ).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

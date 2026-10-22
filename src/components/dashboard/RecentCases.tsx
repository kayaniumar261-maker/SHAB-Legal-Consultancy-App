import { tr, getLocale, useLocale } from '../../i18n/locale';
import {
  CalendarDays,
  FolderOpen,
  Scale,
  UserRound,
} from 'lucide-react';

import {
  useEffect,
  useState,
} from 'react';

import {
  getCases,
} from '../../services/caseService';

import type {
  CaseWithRelations,
} from '../../types/case';

import './RecentCases.css';

function getStatusClass(
  status: string | null | undefined,
): string {
  const normalized =
    String(status ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

  switch (normalized) {
    case 'open':
      return 'case-status open';

    case 'closed':
      return 'case-status closed';

    case 'in_progress':
    case 'in_court':
    case 'pending':
      return 'case-status progress';

    case 'appeal':
      return 'case-status appeal';

    case 'urgent':
      return 'case-status urgent';

    default:
      return 'case-status';
  }
}

function formatStatus(
  status: string | null | undefined,
): string {
  if (!status) {
    return tr('Unknown');
  }

  return tr(String(status)
    .replace(/[_-]/g, ' ')
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase(),
    ));
}

function formatDate(
  value: string | null,
): string {
  if (!value) {
    return 'No Hearing';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'No Hearing';
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

export function RecentCases() {
  const interfaceLanguage = useLocale();
  const [cases, setCases] =
    useState<CaseWithRelations[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const result =
          await getCases({
            page: 1,
            pageSize: 4,
          });

        if (active) {
          setCases(
            (result.data ??
              []) as CaseWithRelations[],
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load recent cases.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="dashboard-panel recent-cases-panel">
      <div className="recent-cases-header">
        <div>
          <span className="recent-eyebrow">{tr("CASE MANAGEMENT")}</span>

          <h3>{tr("Recent Cases")}</h3>

          <p>{tr("Current legal matters requiring attention.")}</p>
        </div>

        <div className="recent-header-icon">
          <Scale size={22} />
        </div>
      </div>

      {loading ? (
        <div className="recent-cases-loading">{tr("Loading recent cases...")}</div>
      ) : error ? (
        <div className="dashboard-widget-state error">
          {tr(error)}
        </div>
      ) : cases.length === 0 ? (
        <div className="dashboard-widget-state">
          <FolderOpen size={22} />
          <span>{tr("No cases available yet.")}</span>
        </div>
      ) : (
        <div className="recent-case-list">
          {cases.map((item) => (
            <div
              key={item.id}
              className="recent-case-card"
            >
              <div className="recent-top">
                <div className="case-icon">
                  <FolderOpen size={18} />
                </div>

                <div className="case-title">
                  <strong>
                    {item.case_number ||
                      tr("Unnumbered Case")}
                  </strong>

                  <span>
                    {item.case_type ||
                      tr("Legal Matter")}
                  </span>
                </div>

                <span
                  className={getStatusClass(
                    item.status,
                  )}
                >
                  {formatStatus(
                    item.status,
                  )}
                </span>
              </div>

              <div className="recent-info-grid">
                <div>
                  <UserRound size={15} />

                  <div>
                    <small>{tr("Client")}</small>

                    <strong>
                      {item.client
                        ?.full_name ??
                        tr("Unknown client")}
                    </strong>
                  </div>
                </div>

                <div>
                  <Scale size={15} />

                  <div>
                    <small>{tr("Lawyer")}</small>

                    <strong>
                      {item.assigned_staff
                        ?.full_name ??
                        item.responsible_lawyer
                          ?.full_name ??
                        '-'}
                    </strong>
                  </div>
                </div>

                <div>
                  <CalendarDays
                    size={15}
                  />

                  <div>
                    <small>{tr("Hearing")}</small>

                    <strong>
                      {formatDate(
                        item.next_hearing_at,
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="recent-footer">
                <span>{tr("Court")}</span>

                <strong>
                  {item.court || '-'}
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
import { tr, getLocale, useLocale } from '../i18n/locale';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Edit3,
  Gavel,
  Landmark,
  Scale,
  ShieldAlert,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { CaseTabs } from '../components/cases/CaseTabs';
import { DeletionRequestModal } from '../components/staff/DeletionRequestModal';
import { useAccessProfile } from '../hooks/useAccessProfile';
import { deleteCase, getCaseById } from '../services/caseService';
import {
  getFinancialLedger,
  type FinancialLedgerSummary,
} from '../services/financialLedgerService';
import type { CaseWithRelations as Case } from '../types/case';
import './CaseDetails.css';

export function CaseDetails() {
  const interfaceLanguage = useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAccessProfile();
  const administrator = profile?.access_role === 'administrator' && profile.is_active;

  const [caseRecord, setCaseRecord] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [requestDeleteOpen, setRequestDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financialSummary, setFinancialSummary] =
    useState<FinancialLedgerSummary | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Case ID is missing.');
      setLoading(false);
      return;
    }

    const caseId = id;
    let cancelled = false;

    async function loadCase() {
      setLoading(true);
      setError(null);

      try {
        const caseData = await getCaseById(caseId);

        if (cancelled) {
          return;
        }

        if (!caseData) {
          setError('Case not found.');
          return;
        }

        setCaseRecord(caseData);
      } catch (fetchError) {
        if (cancelled) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to load case details.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCase();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !administrator) {
      setFinancialSummary(null);
      return;
    }

    let cancelled = false;

    async function loadFinancialSummary(
      caseId: string,
    ) {
      setFinancialSummary(null);

      try {
        const ledger =
          await getFinancialLedger({
            caseId,
          });

        if (!cancelled) {
          setFinancialSummary(
            ledger.summary,
          );
        }
      } catch {
        if (!cancelled) {
          setFinancialSummary(null);
        }
      }
    }

    void loadFinancialSummary(id);

    return () => {
      cancelled = true;
    };
  }, [administrator, id]);

  const progress = useMemo(() => {
    const value = Number(caseRecord?.completion_percentage ?? 0);
    return Math.min(100, Math.max(0, value));
  }, [caseRecord?.completion_percentage, interfaceLanguage]);

  if (loading) {
    return (
      <div className="case-details-page page-container">
        <div className="case-details-state">
          <Scale size={30} />
          <strong>{tr("Loading matter details…")}</strong>
          <p>{tr("Retrieving the latest legal matter information.")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="case-details-page page-container">
        <section className="page-heading">
          <div>
            <p className="page-eyebrow">{tr("Case management")}</p>
            <h2>{tr("Unable to load matter")}</h2>
            <p className="page-intro">{tr("There was a problem loading this legal matter.")}</p>
          </div>
        </section>

        <div className="case-details-state error">
          <AlertTriangle size={30} />
          <strong>{tr(error)}</strong>
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => navigate('/cases')}
          >
            <ArrowLeft size={16} />{tr("Back to Cases")}</button>
        </div>
      </div>
    );
  }

  if (!caseRecord) {
    return null;
  }

  const matterReference =
    caseRecord.matter_number ?? caseRecord.case_number;
  const clientName =
    caseRecord.client?.full_name ?? 'Unknown client';
  const responsibleLawyer =
    caseRecord.responsible_lawyer?.full_name ??
    caseRecord.assigned_staff?.full_name ??
    caseRecord.assigned_lawyer ??
    'Unassigned';

  async function handleDelete() {
    if (!caseRecord) {
      return;
    }

    const confirmed = window.confirm(
      tr("Delete {0}? This action cannot be undone.", [matterReference]),
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteCase(caseRecord.id);
      navigate('/cases');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete case.',
      );
      setDeleting(false);
    }
  }

  return (
    <div className="case-details-page page-container">
      <section className="case-details-topbar">
        <button
          type="button"
          className="secondary-action-button back-button"
          onClick={() => navigate('/cases')}
        >
          <ArrowLeft size={16} />{tr("Back to Cases")}</button>

        <div className="case-details-actions">
          <Link
            to={`/cases/${caseRecord.id}/edit`}
            className="primary-action-button"
          >
            <Edit3 size={18} />{tr("Edit Matter")}</Link>

          <button
            type="button"
            className="secondary-action-button delete-case-button"
            onClick={() => administrator ? void handleDelete() : setRequestDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 size={18} />
            {deleting ? tr("Deleting…") : administrator ? tr("Delete") : tr("Request deletion")}
          </button>
        </div>
      </section>

      <section className="case-details-hero">
        <div className="case-details-hero-main">
          <div className="case-details-reference-row">
            <span>{matterReference}</span>

            {caseRecord.requires_urgent_action && (
              <span className="urgent-matter-chip">
                <AlertTriangle size={14} />{tr("Urgent action required")}</span>
            )}

            {caseRecord.is_vip && (
              <span className="vip-matter-chip">{tr("VIP")}</span>
            )}

            {caseRecord.is_archived && (
              <span className="archived-matter-chip">
                <Archive size={13} />{tr("Archived")}</span>
            )}
          </div>

          <h1>{caseRecord.case_type || tr("Untitled matter")}</h1>

          <div className="case-details-subtitle">
            <Link to={`/clients/${caseRecord.client_id}`}>
              <UserRound size={16} />
              {clientName}
            </Link>
            <span>•</span>
            <span>{caseRecord.court || tr("Court not assigned")}</span>
          </div>

          <div className="case-details-badges">
            <Badge
              label={formatLabel(caseRecord.status)}
              className={`status ${normalizeClass(caseRecord.status)}`}
            />
            <Badge
              label={tr("{0} priority", [formatLabel(caseRecord.priority)])}
              className={`priority ${normalizeClass(caseRecord.priority)}`}
            />
            <Badge
              label={tr("{0} risk", [formatLabel(caseRecord.risk_level)])}
              className={`risk ${normalizeClass(caseRecord.risk_level)}`}
              icon={<ShieldAlert size={13} />}
            />
            <Badge
              label={formatLabel(
                caseRecord.confidentiality_level,
              )}
              className="confidentiality"
            />
          </div>
        </div>

        <div className="case-details-progress-card">
          <div>
            <span>{tr("Matter progress")}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="case-details-progress-track">
            <span style={{ width: `${progress}%` }} />
          </div>
          <small>{tr("Stage:")}{" "}{formatLabel(caseRecord.case_stage)}
          </small>
        </div>
      </section>

      <section className="case-details-kpi-grid">
        <KpiCard
          icon={<CalendarClock size={20} />}
          label={tr("Next Hearing")}
          value={
            caseRecord.next_hearing_at
              ? formatDateTime(caseRecord.next_hearing_at)
              : 'Not scheduled'
          }
        />
        <KpiCard
          icon={<Clock3 size={20} />}
          label={tr("Next Action")}
          value={
            caseRecord.next_action_at
              ? formatDateTime(caseRecord.next_action_at)
              : 'Not scheduled'
          }
        />
        {administrator && (
          <>
            <KpiCard
              icon={<CircleDollarSign size={20} />}
              label={tr("Claim Amount")}
              value={formatCurrency(
                caseRecord.claim_amount ?? caseRecord.case_value,
                caseRecord.currency,
              )}
            />
            <KpiCard
              icon={<CircleDollarSign size={20} />}
              label={tr("Outstanding")}
              value={
                financialSummary
                  ? formatCurrency(
                      financialSummary.outstanding,
                      caseRecord.currency,
                    )
                  : '—'
              }
            />
          </>
        )}
      </section>

      <section className="case-details-overview-grid">
        <OverviewCard
          icon={<BriefcaseBusiness size={19} />}
          title={tr("Matter Information")}
        >
          <DetailRow
            label={tr("Matter Number")}
            value={caseRecord.matter_number}
          />
          <DetailRow
            label={tr("Internal Case Number")}
            value={caseRecord.case_number}
          />
          <DetailRow
            label={tr("External Reference")}
            value={caseRecord.external_reference}
          />
          <DetailRow
            label={tr("File Reference")}
            value={caseRecord.file_reference}
          />
          <DetailRow
            label={tr("Practice Area")}
            value={caseRecord.practice_area}
          />
          <DetailRow
            label={tr("Category")}
            value={caseRecord.case_category}
          />
          <DetailRow
            label={tr("Proceeding Type")}
            value={caseRecord.proceeding_type}
          />
          <DetailRow
            label={tr("Jurisdiction")}
            value={caseRecord.jurisdiction}
          />
        </OverviewCard>

        <OverviewCard
          icon={<Gavel size={19} />}
          title={tr("Court & Proceedings")}
        >
          <DetailRow label={tr("Court")} value={caseRecord.court} />
          <DetailRow
            label={tr("Court Division")}
            value={caseRecord.court_division}
          />
          <DetailRow
            label={tr("Court Level")}
            value={caseRecord.court_level}
          />
          <DetailRow
            label={tr("Court Case Number")}
            value={caseRecord.court_case_number}
          />
          <DetailRow
            label={tr("Police Case Number")}
            value={caseRecord.police_case_number}
          />
          <DetailRow
            label={tr("Prosecution Number")}
            value={caseRecord.prosecution_number}
          />
          <DetailRow
            label={tr("Execution Number")}
            value={caseRecord.execution_number}
          />
          <DetailRow
            label={tr("Judge")}
            value={caseRecord.judge_name}
          />
        </OverviewCard>

        <OverviewCard
          icon={<UsersRound size={19} />}
          title={tr("Client & Legal Team")}
        >
          <DetailRow
            label={tr("Client")}
            value={clientName}
            link={`/clients/${caseRecord.client_id}`}
          />
          <DetailRow
            label={tr("Responsible Lawyer")}
            value={responsibleLawyer}
          />
          <DetailRow
            label={tr("Case Manager")}
            value={caseRecord.case_manager?.full_name}
          />
          <DetailRow
            label={tr("Legal Assistant")}
            value={caseRecord.legal_assistant?.full_name}
          />
          <DetailRow
            label={tr("Assigned Team")}
            value={caseRecord.assigned_team}
          />
          <DetailRow
            label={tr("Department")}
            value={caseRecord.department}
          />
        </OverviewCard>

        <OverviewCard
          icon={<Building2 size={19} />}
          title={tr("Opponent Information")}
        >
          <DetailRow
            label={tr("Opponent")}
            value={
              caseRecord.opponent_name ??
              caseRecord.opponent_company
            }
          />
          <DetailRow
            label={tr("Opponent Type")}
            value={caseRecord.opponent_type}
          />
          <DetailRow
            label={tr("Company")}
            value={caseRecord.opponent_company}
          />
          <DetailRow
            label={tr("Opponent Lawyer")}
            value={caseRecord.opponent_lawyer}
          />
          <DetailRow
            label={tr("Law Firm")}
            value={caseRecord.opponent_law_firm}
          />
          <DetailRow
            label={tr("Email")}
            value={caseRecord.opponent_email}
          />
          <DetailRow
            label={tr("Phone")}
            value={caseRecord.opponent_phone}
          />
        </OverviewCard>

        <OverviewCard
          icon={<Landmark size={19} />}
          title={tr("Key Dates")}
        >
          <DetailRow
            label={tr("Filing Date")}
            value={formatOptionalDate(caseRecord.filing_date)}
          />
          <DetailRow
            label={tr("Opened")}
            value={formatOptionalDate(caseRecord.opened_at)}
          />
          <DetailRow
            label={tr("First Hearing")}
            value={formatOptionalDate(
              caseRecord.first_hearing_at,
            )}
          />
          <DetailRow
            label={tr("Next Hearing")}
            value={formatOptionalDate(
              caseRecord.next_hearing_at,
            )}
          />
          <DetailRow
            label={tr("Limitation Date")}
            value={formatOptionalDate(
              caseRecord.limitation_date,
            )}
          />
          <DetailRow
            label={tr("Judgment Date")}
            value={formatOptionalDate(caseRecord.judgment_at)}
          />
          <DetailRow
            label={tr("Closed")}
            value={formatOptionalDate(caseRecord.closed_at)}
          />
        </OverviewCard>

      </section>

      {(caseRecord.description ||
        caseRecord.facts_summary ||
        caseRecord.client_objective ||
        caseRecord.legal_strategy ||
        caseRecord.next_actions) && (
        <section className="case-details-narrative-grid">
          <NarrativeCard
            title={tr("Matter Description")}
            value={caseRecord.description}
          />
          <NarrativeCard
            title={tr("Facts Summary")}
            value={caseRecord.facts_summary}
          />
          <NarrativeCard
            title={tr("Client Objective")}
            value={caseRecord.client_objective}
          />
          <NarrativeCard
            title={tr("Legal Strategy")}
            value={caseRecord.legal_strategy}
          />
          <NarrativeCard
            title={tr("Next Actions")}
            value={caseRecord.next_actions}
          />
        </section>
      )}

      <CaseTabs
        caseRecord={caseRecord}
        clientName={clientName}
        isAdministrator={administrator}
      />

      <DeletionRequestModal
        open={!administrator && requestDeleteOpen}
        entityType="case"
        recordId={caseRecord.id}
        recordLabel={matterReference}
        onClose={() => setRequestDeleteOpen(false)}
      />
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const interfaceLanguage = useLocale();
  return (
    <article className="case-details-kpi-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function OverviewCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const interfaceLanguage = useLocale();
  return (
    <article className="case-details-overview-card">
      <header>
        <span>{icon}</span>
        <h3>{title}</h3>
      </header>
      <div className="case-details-overview-body">
        {children}
      </div>
    </article>
  );
}

function DetailRow({
  label,
  value,
  link,
}: {
  label: string;
  value: string | null | undefined;
  link?: string;
}) {
  const interfaceLanguage = useLocale();
  const displayValue =
    value && value.trim() !== '' ? value : 'Not provided';

  return (
    <div className="case-details-row">
      <span>{label}</span>
      {link && displayValue !== 'Not provided' ? (
        <Link to={link}>{displayValue}</Link>
      ) : (
        <strong>{displayValue}</strong>
      )}
    </div>
  );
}

function NarrativeCard({
  title,
  value,
}: {
  title: string;
  value: string | null | undefined;
}) {
  const interfaceLanguage = useLocale();
  if (!value) {
    return null;
  }

  return (
    <article className="case-details-narrative-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  );
}

function Badge({
  label,
  className,
  icon,
}: {
  label: string;
  className: string;
  icon?: ReactNode;
}) {
  const interfaceLanguage = useLocale();
  return (
    <span className={`case-details-badge ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function normalizeClass(
  value: string | null | undefined,
): string {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function formatLabel(
  value: string | null | undefined,
): string {
  if (!value) {
    return tr('Not provided');
  }

  return tr(value
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()));
}

function formatOptionalDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return 'Not scheduled';
  }

  return formatDate(value);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(getLocale("en-AE"), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(getLocale("en-AE"), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCurrency(
  value: number | null | undefined,
  currency: string | null | undefined = 'AED',
): string {
  return new Intl.NumberFormat(getLocale("en-AE"), {
    style: 'currency',
    currency: currency || 'AED',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

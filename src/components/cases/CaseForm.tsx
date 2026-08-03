import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Gavel,
  Save,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';

import type {
  Case,
  CaseInsert,
  CaseUpdate,
} from '../../types/case';
import type { Client } from '../../types/client';
import type { Staff } from '../../types/staff';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import './CaseForm.css';

type CaseStatus =
  | 'open'
  | 'pending'
  | 'in_court'
  | 'closed'
  | 'appeal';

type CasePriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

type RiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

type ConfidentialityLevel =
  | 'internal'
  | 'confidential'
  | 'highly_confidential';

export type CaseFormProps = {
  caseRecord?: Case | null;
  clients: Array<Pick<Client, 'id' | 'full_name'>>;
  staff: Array<Pick<Staff, 'id' | 'full_name'>>;
  loading: boolean;
  onSubmit: (
    data: CaseInsert | CaseUpdate,
  ) => Promise<void>;
  submitLabel: string;
};

type FormState = {
  client_id: string;
  case_number: string;
  matter_number: string;
  case_type: string;
  practice_area: string;
  department: string;
  case_category: string;
  proceeding_type: string;
  jurisdiction: string;
  external_reference: string;
  file_reference: string;

  court: string;
  court_division: string;
  court_level: string;
  court_case_number: string;
  police_case_number: string;
  prosecution_number: string;
  execution_number: string;
  judge_name: string;

  opponent_name: string;
  opponent_type: string;
  opponent_company: string;
  opponent_lawyer: string;
  opponent_law_firm: string;
  opponent_email: string;
  opponent_phone: string;

  assigned_staff_id: string;
  responsible_lawyer_id: string;
  case_manager_id: string;
  legal_assistant_id: string;
  assigned_team: string;

  status: CaseStatus;
  priority: CasePriority;
  case_stage: string;
  risk_level: RiskLevel;
  confidentiality_level: ConfidentialityLevel;
  completion_percentage: string;
  is_vip: boolean;
  requires_urgent_action: boolean;
  is_archived: boolean;

  filing_date: string;
  opened_at: string;
  first_hearing_at: string;
  next_hearing_at: string;
  next_action_at: string;
  limitation_date: string;
  judgment_at: string;
  closed_at: string;

  case_value: string;
  claim_amount: string;
  settlement_amount: string;
  judgment_amount: string;
  recovered_amount: string;
  total_billed: string;
  total_paid: string;
  outstanding_balance: string;
  currency: string;
  fee_arrangement: string;

  description: string;
  facts_summary: string;
  client_objective: string;
  legal_strategy: string;
  next_actions: string;
  internal_notes: string;

  ai_summary: string;
  ai_risk_assessment: string;
  ai_recommended_actions: string;
};

const emptyFormState: FormState = {
  client_id: '',
  case_number: '',
  matter_number: '',
  case_type: '',
  practice_area: '',
  department: '',
  case_category: '',
  proceeding_type: '',
  jurisdiction: 'UAE',
  external_reference: '',
  file_reference: '',

  court: '',
  court_division: '',
  court_level: '',
  court_case_number: '',
  police_case_number: '',
  prosecution_number: '',
  execution_number: '',
  judge_name: '',

  opponent_name: '',
  opponent_type: '',
  opponent_company: '',
  opponent_lawyer: '',
  opponent_law_firm: '',
  opponent_email: '',
  opponent_phone: '',

  assigned_staff_id: '',
  responsible_lawyer_id: '',
  case_manager_id: '',
  legal_assistant_id: '',
  assigned_team: '',

  status: 'open',
  priority: 'medium',
  case_stage: 'intake',
  risk_level: 'medium',
  confidentiality_level: 'internal',
  completion_percentage: '0',
  is_vip: false,
  requires_urgent_action: false,
  is_archived: false,

  filing_date: '',
  opened_at: '',
  first_hearing_at: '',
  next_hearing_at: '',
  next_action_at: '',
  limitation_date: '',
  judgment_at: '',
  closed_at: '',

  case_value: '',
  claim_amount: '',
  settlement_amount: '',
  judgment_amount: '',
  recovered_amount: '',
  total_billed: '',
  total_paid: '',
  outstanding_balance: '',
  currency: 'AED',
  fee_arrangement: '',

  description: '',
  facts_summary: '',
  client_objective: '',
  legal_strategy: '',
  next_actions: '',
  internal_notes: '',

  ai_summary: '',
  ai_risk_assessment: '',
  ai_recommended_actions: '',
};

function normalizeStatus(
  status: string | null | undefined,
): CaseStatus {
  switch (status?.toLowerCase().replace(/ /g, '_')) {
    case 'pending':
      return 'pending';
    case 'in_court':
      return 'in_court';
    case 'closed':
      return 'closed';
    case 'appeal':
      return 'appeal';
    default:
      return 'open';
  }
}

function normalizePriority(
  priority: string | null | undefined,
): CasePriority {
  switch (priority?.toLowerCase()) {
    case 'low':
      return 'low';
    case 'high':
      return 'high';
    case 'urgent':
      return 'urgent';
    default:
      return 'medium';
  }
}

function normalizeRisk(
  risk: string | null | undefined,
): RiskLevel {
  switch (risk?.toLowerCase()) {
    case 'low':
      return 'low';
    case 'high':
      return 'high';
    case 'critical':
      return 'critical';
    default:
      return 'medium';
  }
}

function normalizeConfidentiality(
  value: string | null | undefined,
): ConfidentialityLevel {
  switch (value?.toLowerCase().replace(/ /g, '_')) {
    case 'confidential':
      return 'confidential';
    case 'highly_confidential':
      return 'highly_confidential';
    default:
      return 'internal';
  }
}

function toInputDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

function toInputDate(
  value: string | null | undefined,
): string {
  return value ? value.slice(0, 10) : '';
}

function toNumberString(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? ''
    : String(value);
}

function loadSavedCaseDraft(
  storageKey: string,
  fallback: FormState,
): FormState {
  try {
    const saved =
      window.localStorage.getItem(storageKey);

    if (!saved) {
      return fallback;
    }

    return {
      ...fallback,
      ...(JSON.parse(saved) as Partial<FormState>),
    };
  } catch {
    return fallback;
  }
}

function saveCaseDraft(
  storageKey: string,
  state: FormState,
): void {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(state),
    );
  } catch {
    // Local drafts are a convenience only.
  }
}

function clearCaseDraft(
  storageKey: string,
): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear.
  }
}

function buildFormState(
  caseRecord?: Case | null,
): FormState {
  if (!caseRecord) {
    return { ...emptyFormState };
  }

  return {
    client_id: caseRecord.client_id ?? '',
    case_number: caseRecord.case_number ?? '',
    matter_number: caseRecord.matter_number ?? '',
    case_type: caseRecord.case_type ?? '',
    practice_area: caseRecord.practice_area ?? '',
    department: caseRecord.department ?? '',
    case_category: caseRecord.case_category ?? '',
    proceeding_type: caseRecord.proceeding_type ?? '',
    jurisdiction: caseRecord.jurisdiction ?? 'UAE',
    external_reference:
      caseRecord.external_reference ?? '',
    file_reference: caseRecord.file_reference ?? '',

    court: caseRecord.court ?? '',
    court_division: caseRecord.court_division ?? '',
    court_level: caseRecord.court_level ?? '',
    court_case_number:
      caseRecord.court_case_number ?? '',
    police_case_number:
      caseRecord.police_case_number ?? '',
    prosecution_number:
      caseRecord.prosecution_number ?? '',
    execution_number:
      caseRecord.execution_number ?? '',
    judge_name: caseRecord.judge_name ?? '',

    opponent_name: caseRecord.opponent_name ?? '',
    opponent_type: caseRecord.opponent_type ?? '',
    opponent_company:
      caseRecord.opponent_company ?? '',
    opponent_lawyer:
      caseRecord.opponent_lawyer ?? '',
    opponent_law_firm:
      caseRecord.opponent_law_firm ?? '',
    opponent_email:
      caseRecord.opponent_email ?? '',
    opponent_phone:
      caseRecord.opponent_phone ?? '',

    assigned_staff_id:
      caseRecord.assigned_staff_id ?? '',
    responsible_lawyer_id:
      caseRecord.responsible_lawyer_id ?? '',
    case_manager_id:
      caseRecord.case_manager_id ?? '',
    legal_assistant_id:
      caseRecord.legal_assistant_id ?? '',
    assigned_team: caseRecord.assigned_team ?? '',

    status: normalizeStatus(caseRecord.status),
    priority: normalizePriority(caseRecord.priority),
    case_stage: caseRecord.case_stage ?? 'intake',
    risk_level: normalizeRisk(caseRecord.risk_level),
    confidentiality_level: normalizeConfidentiality(
      caseRecord.confidentiality_level,
    ),
    completion_percentage: toNumberString(
      caseRecord.completion_percentage,
    ),
    is_vip: Boolean(caseRecord.is_vip),
    requires_urgent_action: Boolean(
      caseRecord.requires_urgent_action,
    ),
    is_archived: Boolean(caseRecord.is_archived),

    filing_date: toInputDate(caseRecord.filing_date),
    opened_at: toInputDateTime(caseRecord.opened_at),
    first_hearing_at: toInputDateTime(
      caseRecord.first_hearing_at,
    ),
    next_hearing_at: toInputDateTime(
      caseRecord.next_hearing_at,
    ),
    next_action_at: toInputDateTime(
      caseRecord.next_action_at,
    ),
    limitation_date: toInputDate(
      caseRecord.limitation_date,
    ),
    judgment_at: toInputDateTime(
      caseRecord.judgment_at,
    ),
    closed_at: toInputDateTime(caseRecord.closed_at),

    case_value: toNumberString(caseRecord.case_value),
    claim_amount: toNumberString(
      caseRecord.claim_amount,
    ),
    settlement_amount: toNumberString(
      caseRecord.settlement_amount,
    ),
    judgment_amount: toNumberString(
      caseRecord.judgment_amount,
    ),
    recovered_amount: toNumberString(
      caseRecord.recovered_amount,
    ),
    total_billed: toNumberString(
      caseRecord.total_billed,
    ),
    total_paid: toNumberString(caseRecord.total_paid),
    outstanding_balance: toNumberString(
      caseRecord.outstanding_balance,
    ),
    currency: caseRecord.currency ?? 'AED',
    fee_arrangement:
      caseRecord.fee_arrangement ?? '',

    description: caseRecord.description ?? '',
    facts_summary: caseRecord.facts_summary ?? '',
    client_objective:
      caseRecord.client_objective ?? '',
    legal_strategy:
      caseRecord.legal_strategy ?? '',
    next_actions: caseRecord.next_actions ?? '',
    internal_notes: caseRecord.internal_notes ?? '',

    ai_summary: caseRecord.ai_summary ?? '',
    ai_risk_assessment:
      caseRecord.ai_risk_analysis ?? '',
    ai_recommended_actions:
      caseRecord.ai_recommended_actions ?? '',
  };
}

export function CaseForm({
  caseRecord,
  clients,
  staff,
  loading,
  onSubmit,
  submitLabel,
}: CaseFormProps) {
  const draftStorageKey =
    caseRecord?.id
      ? `shab-case-form-draft-${caseRecord.id}`
      : 'shab-case-form-draft-new';

  const [formState, setFormState] = useState<FormState>(
    () => {
      const fallback =
        buildFormState(caseRecord);

      return loadSavedCaseDraft(
        draftStorageKey,
        fallback,
      );
    },
  );

  const [error, setError] = useState<string | null>(
    null,
  );

  const isOnline = useOnlineStatus();

  useEffect(() => {
    const fallback =
      buildFormState(caseRecord);

    setFormState(
      loadSavedCaseDraft(
        draftStorageKey,
        fallback,
      ),
    );
  }, [
    caseRecord,
    draftStorageKey,
  ]);

  useEffect(() => {
    saveCaseDraft(
      draftStorageKey,
      formState,
    );
  }, [
    draftStorageKey,
    formState,
  ]);

  const clientOptions = useMemo(
    () => [
      { id: '', full_name: 'Select client' },
      ...clients,
    ],
    [clients],
  );

  const staffOptions = useMemo(
    () => [
      { id: '', full_name: 'Select staff member' },
      ...staff,
    ],
    [staff],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!formState.client_id) {
      errors.push('Please assign a client.');
    }

    if (!formState.case_type.trim()) {
      errors.push('Matter type is required.');
    }

    if (!formState.assigned_staff_id) {
      errors.push('Assigned staff is required.');
    }

    if (
      formState.completion_percentage &&
      (Number(formState.completion_percentage) < 0 ||
        Number(formState.completion_percentage) > 100)
    ) {
      errors.push(
        'Completion percentage must be between 0 and 100.',
      );
    }

    const numericFields: Array<
      [keyof FormState, string]
    > = [
      ['case_value', 'Case value'],
      ['claim_amount', 'Claim amount'],
      ['settlement_amount', 'Settlement amount'],
      ['judgment_amount', 'Judgment amount'],
      ['recovered_amount', 'Recovered amount'],
      ['total_billed', 'Total billed'],
      ['total_paid', 'Total paid'],
      ['outstanding_balance', 'Outstanding balance'],
    ];

    numericFields.forEach(([key, label]) => {
      const value = formState[key];

      if (
        typeof value === 'string' &&
        value !== '' &&
        (Number.isNaN(Number(value)) ||
          Number(value) < 0)
      ) {
        errors.push(`${label} must be a valid number.`);
      }
    });

    return errors;
  }, [formState]);

  const setField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);

    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    const optionalText = (value: string) =>
      value.trim() || null;
    const optionalNumber = (value: string) =>
      value === '' ? null : Number(value);
    const optionalDate = (value: string) =>
      value || null;

    const payload = {
      client_id: formState.client_id,
      case_number:
        optionalText(formState.case_number) ?? '',
      matter_number:
        optionalText(formState.matter_number),
      case_type: formState.case_type.trim(),
      practice_area:
        optionalText(formState.practice_area),
      department:
        optionalText(formState.department),
      case_category:
        optionalText(formState.case_category),
      proceeding_type:
        optionalText(formState.proceeding_type),
      jurisdiction:
        optionalText(formState.jurisdiction),
      external_reference:
        optionalText(formState.external_reference),
      file_reference:
        optionalText(formState.file_reference),

      court: optionalText(formState.court) ?? '',
      court_division:
        optionalText(formState.court_division),
      court_level:
        optionalText(formState.court_level),
      court_case_number:
        optionalText(formState.court_case_number),
      police_case_number:
        optionalText(formState.police_case_number),
      prosecution_number:
        optionalText(formState.prosecution_number),
      execution_number:
        optionalText(formState.execution_number),
      judge_name:
        optionalText(formState.judge_name),

      opponent_name:
        optionalText(formState.opponent_name),
      opponent_type:
        optionalText(formState.opponent_type),
      opponent_company:
        optionalText(formState.opponent_company),
      opponent_lawyer:
        optionalText(formState.opponent_lawyer),
      opponent_law_firm:
        optionalText(formState.opponent_law_firm),
      opponent_email:
        optionalText(formState.opponent_email),
      opponent_phone:
        optionalText(formState.opponent_phone),

      assigned_staff_id:
        formState.assigned_staff_id,
      responsible_lawyer_id:
        optionalText(
          formState.responsible_lawyer_id,
        ),
      case_manager_id:
        optionalText(formState.case_manager_id),
      legal_assistant_id:
        optionalText(formState.legal_assistant_id),
      assigned_team:
        optionalText(formState.assigned_team),

      status: formState.status,
      priority: formState.priority,
      case_stage:
        optionalText(formState.case_stage),
      risk_level: formState.risk_level,
      confidentiality_level:
        formState.confidentiality_level,
      completion_percentage:
        optionalNumber(
          formState.completion_percentage,
        ) ?? 0,
      is_vip: formState.is_vip,
      requires_urgent_action:
        formState.requires_urgent_action,
      is_archived: formState.is_archived,

      filing_date:
        optionalDate(formState.filing_date),
      opened_at: optionalDate(formState.opened_at),
      next_action_at:
        optionalDate(formState.next_action_at),
      limitation_date:
        optionalDate(formState.limitation_date),
      judgment_at:
        optionalDate(formState.judgment_at),
      closed_at: optionalDate(formState.closed_at),

      case_value:
        optionalNumber(formState.case_value),
      claim_amount:
        optionalNumber(formState.claim_amount),
      settlement_amount:
        optionalNumber(formState.settlement_amount),
      judgment_amount:
        optionalNumber(formState.judgment_amount),
      recovered_amount:
        optionalNumber(formState.recovered_amount),
      total_billed:
        optionalNumber(formState.total_billed),
      total_paid:
        optionalNumber(formState.total_paid),
      outstanding_balance:
        optionalNumber(formState.outstanding_balance),
      currency:
        formState.currency.trim().toUpperCase() ||
        'AED',
      fee_arrangement:
        optionalText(formState.fee_arrangement),
      description:
        optionalText(formState.description),
      facts_summary:
        optionalText(formState.facts_summary),
      client_objective:
        optionalText(formState.client_objective),
      legal_strategy:
        optionalText(formState.legal_strategy),
      next_actions:
        optionalText(formState.next_actions),
      internal_notes:
        optionalText(formState.internal_notes),

      ai_summary:
        optionalText(formState.ai_summary),
      ai_risk_analysis:
        optionalText(formState.ai_risk_assessment),
      ai_recommended_actions:
        optionalText(
          formState.ai_recommended_actions,
        ),
    } as unknown as CaseInsert | CaseUpdate;

    try {
      await onSubmit(payload);

      clearCaseDraft(draftStorageKey);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save matter.',
      );
    }
  };

  const sectionProgress = useMemo(() => {
    const hasValue = (value: unknown) =>
      typeof value === 'string'
        ? value.trim().length > 0
        : Boolean(value);

    return {
      'case-section-matter':
        hasValue(formState.client_id) &&
        hasValue(formState.case_type),

      'case-section-court':
        hasValue(formState.court) ||
        hasValue(formState.court_case_number) ||
        hasValue(formState.police_case_number) ||
        hasValue(formState.prosecution_number) ||
        hasValue(formState.execution_number),

      'case-section-opponent':
        hasValue(formState.opponent_name) ||
        hasValue(formState.opponent_company) ||
        hasValue(formState.opponent_lawyer),

      'case-section-team':
        hasValue(formState.assigned_staff_id),

      'case-section-dates':
        hasValue(formState.filing_date) ||
        hasValue(formState.opened_at) ||
        hasValue(formState.first_hearing_at) ||
        hasValue(formState.next_hearing_at) ||
        hasValue(formState.next_action_at) ||
        hasValue(formState.limitation_date),

      'case-section-finance':
        hasValue(formState.case_value) ||
        hasValue(formState.claim_amount) ||
        hasValue(formState.total_billed) ||
        hasValue(formState.total_paid) ||
        hasValue(formState.outstanding_balance),

      'case-section-management':
        hasValue(formState.status) &&
        hasValue(formState.priority) &&
        hasValue(formState.risk_level),

      'case-section-details':
        hasValue(formState.description) ||
        hasValue(formState.facts_summary) ||
        hasValue(formState.client_objective) ||
        hasValue(formState.legal_strategy) ||
        hasValue(formState.next_actions),

      'case-section-ai':
        hasValue(formState.ai_summary) ||
        hasValue(formState.ai_risk_assessment) ||
        hasValue(formState.ai_recommended_actions),
    };
  }, [formState]);

  const completedSectionCount =
    Object.values(sectionProgress).filter(Boolean).length;

  const requiredMatterMissing =
    !formState.client_id ||
    !formState.case_type.trim();

  const requiredTeamMissing =
    !formState.assigned_staff_id;

  const [openSection, setOpenSection] =
    useState<string>('case-section-matter');

  const openFormSection = (
    sectionId: string,
  ) => {
    setOpenSection(sectionId);

    requestAnimationFrame(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    });
  };

  return (
    <form
      className="case-form"
      onSubmit={handleSubmit}
    >
      <div className="case-form-navigation">
        <div className="case-form-navigation-heading">
          <div>
            <strong>Matter Setup</strong>
            <span>
              {completedSectionCount} of 9 sections started
            </span>
          </div>

          <div className="case-form-navigation-progress">
            <span
              style={{
                width: `${(completedSectionCount / 9) * 100}%`,
              }}
            />
          </div>
        </div>

        <nav
          className="case-form-section-nav"
          aria-label="Matter form sections"
        >
          {[
            ['case-section-matter', 'Matter'],
            ['case-section-court', 'Court'],
            ['case-section-opponent', 'Opponent'],
            ['case-section-team', 'Team'],
            ['case-section-dates', 'Dates'],
            ['case-section-finance', 'Finance'],
            ['case-section-management', 'Management'],
            ['case-section-details', 'Details'],
            ['case-section-ai', 'AI'],
          ].map(([sectionId, label]) => {
            const completed =
              sectionProgress[
                sectionId as keyof typeof sectionProgress
              ];

            const requiredMissing =
              (sectionId === 'case-section-matter' &&
                requiredMatterMissing) ||
              (sectionId === 'case-section-team' &&
                requiredTeamMissing);

            return (
              <button
                key={sectionId}
                type="button"
                className={[
                  openSection === sectionId
                    ? 'active'
                    : '',
                  completed
                    ? 'completed'
                    : '',
                  requiredMissing
                    ? 'required-missing'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  openFormSection(sectionId)
                }
              >
                <span className="case-form-nav-label">
                  {label}
                </span>

                <span
                  className="case-form-nav-state"
                  aria-hidden="true"
                >
                  {completed
                    ? '✓'
                    : requiredMissing
                      ? '!'
                      : '○'}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <FormSection
        id="case-section-matter"
        isOpen={openSection === 'case-section-matter'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-matter'
              ? ''
              : 'case-section-matter',
          )
        }
        icon={<BriefcaseBusiness size={20} />}
        title="Matter Information"
        description="Core classification and internal references."
      >
        <SelectField
          id="client_id"
          label="Client"
          value={formState.client_id}
          onChange={(value) =>
            setField('client_id', value)
          }
          options={clientOptions.map((client) => ({
            value: client.id,
            label: client.full_name,
          }))}
          required
        />

        <TextField
          id="case_number"
          label="Internal Case Number"
          value={formState.case_number}
          onChange={(value) =>
            setField('case_number', value)
          }
          placeholder="Leave blank if automatically generated"
        />

        <TextField
          id="matter_number"
          label="Matter Number"
          value={formState.matter_number}
          onChange={(value) =>
            setField('matter_number', value)
          }
          placeholder="Automatically generated where configured"
          disabled={!caseRecord}
        />

        <TextField
          id="case_type"
          label="Matter Type"
          value={formState.case_type}
          onChange={(value) =>
            setField('case_type', value)
          }
          placeholder="e.g. Civil dispute"
          required
        />

        <SelectField
          id="practice_area"
          label="Practice Area"
          value={formState.practice_area}
          onChange={(value) =>
            setField('practice_area', value)
          }
          options={[
            { value: '', label: 'Select practice area' },
            { value: 'Civil', label: 'Civil' },
            { value: 'Criminal', label: 'Criminal' },
            { value: 'Commercial', label: 'Commercial' },
            { value: 'Corporate', label: 'Corporate' },
            { value: 'Labour', label: 'Labour' },
            { value: 'Real Estate', label: 'Real Estate' },
            { value: 'Family', label: 'Family' },
            { value: 'Rental Dispute', label: 'Rental Dispute' },
            { value: 'Banking', label: 'Banking' },
            { value: 'Arbitration', label: 'Arbitration' },
            { value: 'Immigration', label: 'Immigration' },
            { value: 'Debt Recovery', label: 'Debt Recovery' },
            { value: 'Other', label: 'Other' },
          ]}
        />

        <TextField
          id="department"
          label="Department"
          value={formState.department}
          onChange={(value) =>
            setField('department', value)
          }
          placeholder="e.g. Litigation"
        />

        <TextField
          id="case_category"
          label="Matter Category"
          value={formState.case_category}
          onChange={(value) =>
            setField('case_category', value)
          }
          placeholder="e.g. Recovery claim"
        />

        <TextField
          id="proceeding_type"
          label="Proceeding Type"
          value={formState.proceeding_type}
          onChange={(value) =>
            setField('proceeding_type', value)
          }
          placeholder="e.g. First instance"
        />

        <TextField
          id="jurisdiction"
          label="Jurisdiction"
          value={formState.jurisdiction}
          onChange={(value) =>
            setField('jurisdiction', value)
          }
          placeholder="e.g. Dubai, UAE"
        />

        <TextField
          id="external_reference"
          label="External Reference"
          value={formState.external_reference}
          onChange={(value) =>
            setField('external_reference', value)
          }
        />

        <TextField
          id="file_reference"
          label="File Reference"
          value={formState.file_reference}
          onChange={(value) =>
            setField('file_reference', value)
          }
        />
      </FormSection>

      <FormSection
        id="case-section-court"
        isOpen={openSection === 'case-section-court'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-court'
              ? ''
              : 'case-section-court',
          )
        }
        icon={<Gavel size={20} />}
        title="Court & Proceedings"
        description="Court, police, prosecution and execution references."
      >
        <TextField
          id="court"
          label="Court"
          value={formState.court}
          onChange={(value) =>
            setField('court', value)
          }
          placeholder="e.g. Dubai Courts"
        />

        <TextField
          id="court_division"
          label="Court Division"
          value={formState.court_division}
          onChange={(value) =>
            setField('court_division', value)
          }
        />

        <TextField
          id="court_level"
          label="Court Level"
          value={formState.court_level}
          onChange={(value) =>
            setField('court_level', value)
          }
          placeholder="e.g. First Instance"
        />

        <TextField
          id="court_case_number"
          label="Court Case Number"
          value={formState.court_case_number}
          onChange={(value) =>
            setField('court_case_number', value)
          }
        />

        <TextField
          id="police_case_number"
          label="Police Case Number"
          value={formState.police_case_number}
          onChange={(value) =>
            setField('police_case_number', value)
          }
        />

        <TextField
          id="prosecution_number"
          label="Prosecution Number"
          value={formState.prosecution_number}
          onChange={(value) =>
            setField('prosecution_number', value)
          }
        />

        <TextField
          id="execution_number"
          label="Execution Number"
          value={formState.execution_number}
          onChange={(value) =>
            setField('execution_number', value)
          }
        />

        <TextField
          id="judge_name"
          label="Judge"
          value={formState.judge_name}
          onChange={(value) =>
            setField('judge_name', value)
          }
        />
      </FormSection>

      <FormSection
        id="case-section-opponent"
        isOpen={openSection === 'case-section-opponent'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-opponent'
              ? ''
              : 'case-section-opponent',
          )
        }
        icon={<Building2 size={20} />}
        title="Opponent Information"
        description="Adverse party and opposing legal representatives."
      >
        <TextField
          id="opponent_name"
          label="Opponent Name"
          value={formState.opponent_name}
          onChange={(value) =>
            setField('opponent_name', value)
          }
        />

        <TextField
          id="opponent_type"
          label="Opponent Type"
          value={formState.opponent_type}
          onChange={(value) =>
            setField('opponent_type', value)
          }
          placeholder="Individual, company or authority"
        />

        <TextField
          id="opponent_company"
          label="Opponent Company"
          value={formState.opponent_company}
          onChange={(value) =>
            setField('opponent_company', value)
          }
        />

        <TextField
          id="opponent_lawyer"
          label="Opponent Lawyer"
          value={formState.opponent_lawyer}
          onChange={(value) =>
            setField('opponent_lawyer', value)
          }
        />

        <TextField
          id="opponent_law_firm"
          label="Opponent Law Firm"
          value={formState.opponent_law_firm}
          onChange={(value) =>
            setField('opponent_law_firm', value)
          }
        />

        <TextField
          id="opponent_email"
          label="Opponent Email"
          type="email"
          value={formState.opponent_email}
          onChange={(value) =>
            setField('opponent_email', value)
          }
        />

        <TextField
          id="opponent_phone"
          label="Opponent Phone"
          type="tel"
          value={formState.opponent_phone}
          onChange={(value) =>
            setField('opponent_phone', value)
          }
        />
      </FormSection>

      <FormSection
        id="case-section-team"
        isOpen={openSection === 'case-section-team'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-team'
              ? ''
              : 'case-section-team',
          )
        }
        icon={<UsersRound size={20} />}
        title="Legal Team"
        description="Assign the responsible legal professionals."
      >
        <SelectField
          id="assigned_staff_id"
          label="Primary Assigned Staff"
          value={formState.assigned_staff_id}
          onChange={(value) =>
            setField('assigned_staff_id', value)
          }
          options={staffOptions.map((member) => ({
            value: member.id,
            label: member.full_name,
          }))}
          required
        />

        <SelectField
          id="responsible_lawyer_id"
          label="Responsible Lawyer"
          value={formState.responsible_lawyer_id}
          onChange={(value) =>
            setField('responsible_lawyer_id', value)
          }
          options={staffOptions.map((member) => ({
            value: member.id,
            label: member.full_name,
          }))}
        />

        <SelectField
          id="case_manager_id"
          label="Case Manager"
          value={formState.case_manager_id}
          onChange={(value) =>
            setField('case_manager_id', value)
          }
          options={staffOptions.map((member) => ({
            value: member.id,
            label: member.full_name,
          }))}
        />

        <SelectField
          id="legal_assistant_id"
          label="Legal Assistant"
          value={formState.legal_assistant_id}
          onChange={(value) =>
            setField('legal_assistant_id', value)
          }
          options={staffOptions.map((member) => ({
            value: member.id,
            label: member.full_name,
          }))}
        />

        <TextField
          id="assigned_team"
          label="Assigned Team"
          value={formState.assigned_team}
          onChange={(value) =>
            setField('assigned_team', value)
          }
          placeholder="e.g. Litigation Team A"
        />
      </FormSection>

      <FormSection
        id="case-section-dates"
        isOpen={openSection === 'case-section-dates'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-dates'
              ? ''
              : 'case-section-dates',
          )
        }
        icon={<CalendarDays size={20} />}
        title="Important Dates"
        description="Track filing, deadlines, limitation, judgment and closure dates. Hearing dates are synchronized from the Hearings module."
      >
        <TextField
          id="filing_date"
          label="Filing Date"
          type="date"
          value={formState.filing_date}
          onChange={(value) =>
            setField('filing_date', value)
          }
        />

        <TextField
          id="opened_at"
          label="Opened At"
          type="datetime-local"
          value={formState.opened_at}
          onChange={(value) =>
            setField('opened_at', value)
          }
        />

        <TextField
          id="next_action_at"
          label="Next Action Due"
          type="datetime-local"
          value={formState.next_action_at}
          onChange={(value) =>
            setField('next_action_at', value)
          }
        />

        <TextField
          id="limitation_date"
          label="Limitation Date"
          type="date"
          value={formState.limitation_date}
          onChange={(value) =>
            setField('limitation_date', value)
          }
        />

        <TextField
          id="judgment_at"
          label="Judgment Date"
          type="datetime-local"
          value={formState.judgment_at}
          onChange={(value) =>
            setField('judgment_at', value)
          }
        />

        <TextField
          id="closed_at"
          label="Closed At"
          type="datetime-local"
          value={formState.closed_at}
          onChange={(value) =>
            setField('closed_at', value)
          }
        />
      </FormSection>

      <FormSection
        id="case-section-finance"
        isOpen={openSection === 'case-section-finance'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-finance'
              ? ''
              : 'case-section-finance',
          )
        }
        icon={<CircleDollarSign size={20} />}
        title="Financial Position"
        description="Matter value, recovery, billing and payment tracking."
      >
        <SelectField
          id="currency"
          label="Currency"
          value={formState.currency}
          onChange={(value) =>
            setField('currency', value)
          }
          options={[
            { value: 'AED', label: 'AED' },
            { value: 'USD', label: 'USD' },
            { value: 'EUR', label: 'EUR' },
            { value: 'GBP', label: 'GBP' },
            { value: 'PKR', label: 'PKR' },
            { value: 'INR', label: 'INR' },
          ]}
        />

        <NumberField
          id="case_value"
          label="Case Value"
          value={formState.case_value}
          onChange={(value) =>
            setField('case_value', value)
          }
        />

        <NumberField
          id="claim_amount"
          label="Claim Amount"
          value={formState.claim_amount}
          onChange={(value) =>
            setField('claim_amount', value)
          }
        />

        <NumberField
          id="settlement_amount"
          label="Settlement Amount"
          value={formState.settlement_amount}
          onChange={(value) =>
            setField('settlement_amount', value)
          }
        />

        <NumberField
          id="judgment_amount"
          label="Judgment Amount"
          value={formState.judgment_amount}
          onChange={(value) =>
            setField('judgment_amount', value)
          }
        />

        <NumberField
          id="recovered_amount"
          label="Recovered Amount"
          value={formState.recovered_amount}
          onChange={(value) =>
            setField('recovered_amount', value)
          }
        />

        <NumberField
          id="total_billed"
          label="Total Billed"
          value={formState.total_billed}
          onChange={(value) =>
            setField('total_billed', value)
          }
        />

        <NumberField
          id="total_paid"
          label="Total Paid"
          value={formState.total_paid}
          onChange={(value) =>
            setField('total_paid', value)
          }
        />

        <NumberField
          id="outstanding_balance"
          label="Outstanding Balance"
          value={formState.outstanding_balance}
          onChange={(value) =>
            setField('outstanding_balance', value)
          }
        />

        <TextField
          id="fee_arrangement"
          label="Fee Arrangement"
          value={formState.fee_arrangement}
          onChange={(value) =>
            setField('fee_arrangement', value)
          }
          placeholder="Fixed, hourly, retainer or contingency"
        />

      </FormSection>

      <FormSection
        id="case-section-management"
        isOpen={openSection === 'case-section-management'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-management'
              ? ''
              : 'case-section-management',
          )
        }
        icon={<ShieldCheck size={20} />}
        title="Matter Management"
        description="Status, stage, risk and access controls."
      >
        <SelectField
          id="status"
          label="Status"
          value={formState.status}
          onChange={(value) =>
            setField('status', value as CaseStatus)
          }
          options={[
            { value: 'open', label: 'Open' },
            { value: 'pending', label: 'Pending' },
            { value: 'in_court', label: 'In Court' },
            { value: 'appeal', label: 'Appeal' },
            { value: 'closed', label: 'Closed' },
          ]}
          required
        />

        <SelectField
          id="priority"
          label="Priority"
          value={formState.priority}
          onChange={(value) =>
            setField(
              'priority',
              value as CasePriority,
            )
          }
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
          required
        />

        <SelectField
          id="case_stage"
          label="Matter Stage"
          value={formState.case_stage}
          onChange={(value) =>
            setField('case_stage', value)
          }
          options={[
            { value: 'intake', label: 'Intake' },
            { value: 'review', label: 'Review' },
            { value: 'notice', label: 'Legal Notice' },
            { value: 'negotiation', label: 'Negotiation' },
            { value: 'filing', label: 'Filing' },
            { value: 'in_court', label: 'In Court' },
            { value: 'judgment', label: 'Judgment' },
            { value: 'execution', label: 'Execution' },
            { value: 'appeal', label: 'Appeal' },
            { value: 'settlement', label: 'Settlement' },
            { value: 'closed', label: 'Closed' },
          ]}
        />

        <SelectField
          id="risk_level"
          label="Risk Level"
          value={formState.risk_level}
          onChange={(value) =>
            setField(
              'risk_level',
              value as RiskLevel,
            )
          }
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
        />

        <SelectField
          id="confidentiality_level"
          label="Confidentiality"
          value={formState.confidentiality_level}
          onChange={(value) =>
            setField(
              'confidentiality_level',
              value as ConfidentialityLevel,
            )
          }
          options={[
            { value: 'internal', label: 'Internal' },
            { value: 'confidential', label: 'Confidential' },
            {
              value: 'highly_confidential',
              label: 'Highly Confidential',
            },
          ]}
        />

        <NumberField
          id="completion_percentage"
          label="Completion Percentage"
          value={formState.completion_percentage}
          onChange={(value) =>
            setField('completion_percentage', value)
          }
          min={0}
          max={100}
          step={1}
        />

        <div className="case-form-toggle-grid case-form-field-wide">
          <ToggleField
            id="is_vip"
            label="VIP Matter"
            description="Flag this matter for priority client handling."
            checked={formState.is_vip}
            onChange={(checked) =>
              setField('is_vip', checked)
            }
          />

          <ToggleField
            id="requires_urgent_action"
            label="Urgent Action Required"
            description="Display urgent warnings across the matter workspace."
            checked={formState.requires_urgent_action}
            onChange={(checked) =>
              setField(
                'requires_urgent_action',
                checked,
              )
            }
          />

          <ToggleField
            id="is_archived"
            label="Archived"
            description="Hide this matter from active operational views."
            checked={formState.is_archived}
            onChange={(checked) =>
              setField('is_archived', checked)
            }
          />
        </div>
      </FormSection>

      <FormSection
        id="case-section-details"
        isOpen={openSection === 'case-section-details'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-details'
              ? ''
              : 'case-section-details',
          )
        }
        icon={<FileText size={20} />}
        title="Matter Details"
        description="Facts, objectives, strategy and internal notes."
      >
        <TextAreaField
          id="description"
          label="Matter Description"
          value={formState.description}
          onChange={(value) =>
            setField('description', value)
          }
          placeholder="General summary of the legal matter"
        />

        <TextAreaField
          id="facts_summary"
          label="Facts Summary"
          value={formState.facts_summary}
          onChange={(value) =>
            setField('facts_summary', value)
          }
          placeholder="Chronology and material facts"
        />

        <TextAreaField
          id="client_objective"
          label="Client Objective"
          value={formState.client_objective}
          onChange={(value) =>
            setField('client_objective', value)
          }
          placeholder="What outcome is the client seeking?"
        />

        <TextAreaField
          id="legal_strategy"
          label="Legal Strategy"
          value={formState.legal_strategy}
          onChange={(value) =>
            setField('legal_strategy', value)
          }
          placeholder="Planned legal approach"
        />

        <TextAreaField
          id="next_actions"
          label="Next Actions"
          value={formState.next_actions}
          onChange={(value) =>
            setField('next_actions', value)
          }
          placeholder="Immediate and upcoming action items"
        />

        <TextAreaField
          id="internal_notes"
          label="Internal Notes"
          value={formState.internal_notes}
          onChange={(value) =>
            setField('internal_notes', value)
          }
          placeholder="Private notes for the legal team"
        />
      </FormSection>

      <FormSection
        id="case-section-ai"
        isOpen={openSection === 'case-section-ai'}
        onToggle={() =>
          setOpenSection(
            openSection === 'case-section-ai'
              ? ''
              : 'case-section-ai',
          )
        }
        icon={<Sparkles size={20} />}
        title="AI Legal Intelligence"
        description="Optional AI-generated summaries and recommendations."
      >
        <TextAreaField
          id="ai_summary"
          label="AI Summary"
          value={formState.ai_summary}
          onChange={(value) =>
            setField('ai_summary', value)
          }
        />

        <TextAreaField
          id="ai_risk_assessment"
          label="AI Risk Assessment"
          value={formState.ai_risk_assessment}
          onChange={(value) =>
            setField('ai_risk_assessment', value)
          }
        />

        <TextAreaField
          id="ai_recommended_actions"
          label="AI Recommended Actions"
          value={formState.ai_recommended_actions}
          onChange={(value) =>
            setField(
              'ai_recommended_actions',
              value,
            )
          }
        />
      </FormSection>

      {error ? (
        <div
          className="case-form-error"
          role="alert"
        >
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        className={
          isOnline
            ? 'case-form-draft-note'
            : 'case-form-draft-note offline'
        }
      >
        {isOnline
          ? 'Draft is saved locally on this device until the matter is successfully saved.'
          : 'Offline — draft is saved locally. Reconnect before saving this matter to SHAB.'}
      </div>

      <div className="case-form-actions">
        <button
          type="submit"
          className="primary-action-button"
          disabled={loading || !isOnline}
        >
          <Save size={18} />
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  id,
  icon,
  title,
  description,
  children,
  isOpen,
  onToggle,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      id={id}
      className={[
        'case-form-section',
        isOpen
          ? 'is-open'
          : 'is-collapsed',
      ].join(' ')}
    >
      <button
        type="button"
        className="case-form-section-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
      >
        <div className="case-form-section-heading">
          <div className="case-form-section-icon">
            {icon}
          </div>

          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>

        <span
          className="case-form-section-toggle"
          aria-hidden="true"
        >
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div
          id={`${id}-content`}
          className="case-form-grid"
        >
          {children}
        </div>
      )}
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="case-form-field">
      <label htmlFor={id}>
        {label}
        {required ? <span>*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 0.01,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="case-form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  required?: boolean;
}) {
  return (
    <div className="case-form-field">
      <label htmlFor={id}>
        {label}
        {required ? <span>*</span> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
      >
        {options.map((option) => (
          <option
            key={`${id}-${option.value}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="case-form-field case-form-field-wide">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={5}
      />
    </div>
  );
}

function ToggleField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="case-form-toggle"
      htmlFor={id}
    >
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>

      <span className="case-form-switch">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(event.target.checked)
          }
        />
        <span />
      </span>
    </label>
  );
}
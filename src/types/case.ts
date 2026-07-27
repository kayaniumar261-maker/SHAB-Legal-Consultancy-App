export type CaseStatus =
  | 'open'
  | 'pending'
  | 'in_court'
  | 'closed'
  | 'appeal'
  | 'Open'
  | 'Pending'
  | 'In Court'
  | 'Closed'
  | 'Appeal';

export type CasePriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Urgent';

export type CaseRiskLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type CaseConfidentialityLevel =
  | 'internal'
  | 'confidential'
  | 'highly_confidential';

export interface Case {
  id: string;

  client_id: string;
  assigned_staff_id: string | null;
  responsible_lawyer_id: string | null;
  case_manager_id: string | null;
  legal_assistant_id: string | null;

  case_number: string;
  matter_number: string | null;
  legacy_case_number: string | null;
  external_reference: string | null;
  file_reference: string | null;

  case_type: string;
  department: string | null;
  practice_area: string | null;
  case_category: string | null;
  case_subcategory: string | null;
  case_stage: string | null;
  proceeding_type: string | null;
  jurisdiction: string | null;

  court: string;
  court_division: string | null;
  court_level: string | null;
  court_chamber: string | null;
  judge_name: string | null;

  court_case_number: string | null;
  prosecution_number: string | null;
  police_case_number: string | null;
  execution_number: string | null;
  appeal_number: string | null;
  cassation_number: string | null;
  expert_case_number: string | null;
  expert_name: string | null;

  opponent_name: string | null;
  opponent_type: string | null;
  opponent_company: string | null;
  opponent_email: string | null;
  opponent_phone: string | null;
  opponent_address: string | null;
  opponent_lawyer: string | null;
  opponent_law_firm: string | null;
  opponent_lawyer_email: string | null;
  opponent_lawyer_phone: string | null;

  assigned_lawyer?: string | null;
  assigned_team: string | null;

  status: CaseStatus;
  priority: CasePriority;
  risk_level: CaseRiskLevel;
  confidentiality_level: CaseConfidentialityLevel;

  completion_percentage: number | null;
  is_sensitive: boolean;
  is_vip: boolean;
  is_archived: boolean;
  requires_urgent_action: boolean;
  limitation_warning_enabled: boolean;

  filing_date: string;
  opened_at: string | null;
  first_hearing_at: string | null;
  next_hearing_at: string | null;
  judgment_at: string | null;
  execution_started_at: string | null;
  limitation_date: string | null;
  next_action_at: string | null;
  next_follow_up_at: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
  archived_at: string | null;

  case_value: number | null;
  currency: string | null;
  claim_amount: number | null;
  settlement_amount: number | null;
  judgment_amount: number | null;
  recovered_amount: number | null;
  professional_fees: number | null;
  court_fees: number | null;
  expert_fees: number | null;
  execution_fees: number | null;
  other_expenses: number | null;
  total_billed: number | null;
  total_paid: number | null;
  outstanding_balance: number | null;
  fee_arrangement: string | null;
  success_fee_percentage: number | null;

  description: string | null;
  internal_notes: string | null;
  client_objective: string | null;
  facts_summary: string | null;
  legal_issues: string | null;
  legal_strategy: string | null;
  strengths: string | null;
  weaknesses: string | null;
  risks: string | null;
  next_actions: string | null;
  desired_outcome: string | null;
  final_outcome: string | null;

  ai_summary: string | null;
  ai_key_issues: string | null;
  ai_recommended_actions: string | null;
  ai_risk_analysis: string | null;
  ai_last_generated_at: string | null;

  closure_reason: string | null;
  closure_notes: string | null;
  archive_reference: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseInsert = Omit<
  Case,
  'id' | 'created_at' | 'updated_at' | 'matter_number'
> & {
  matter_number?: string | null;
};

export type CaseUpdate = Partial<CaseInsert>;

export type CaseFilterOptions = {
  search?: string;
  status?: CaseStatus | 'all';
  priority?: CasePriority | 'all';
  riskLevel?: CaseRiskLevel | 'all';
  clientId?: string | 'all';
  assignedStaffId?: string | 'all';
  caseType?: string | 'all';
  court?: string | 'all';
  isArchived?: boolean;
  requiresUrgentAction?: boolean;
  sortBy?:
    | keyof Case
    | 'filing_date'
    | 'next_hearing_at'
    | 'created_at'
    | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type CaseListResult = {
  data: Case[];
  count: number;
};

export type RelatedPerson = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
};

export type CaseWithRelations = Case & {
  client?: RelatedPerson | null;
  assigned_staff?: RelatedPerson | null;
  responsible_lawyer?: RelatedPerson | null;
  case_manager?: RelatedPerson | null;
  legal_assistant?: RelatedPerson | null;
};

export interface CaseStatusHistory {
  id: string;
  case_id: string;
  previous_status: string | null;
  new_status: string;
  previous_stage: string | null;
  new_stage: string | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface CaseActivity {
  id: string;
  case_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  activity_at: string;
  created_by: string | null;
  created_at: string;
}

export interface CaseNote {
  id: string;
  case_id: string;
  note: string;
  is_private: boolean;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseNoteInsert = Omit<
  CaseNote,
  'id' | 'created_at' | 'updated_at'
>;

export type CaseActivityInsert = Omit<
  CaseActivity,
  'id' | 'created_at'
>;
export type CaseStatus = 'Open' | 'Pending' | 'In Court' | 'Closed' | 'Appeal';

export type CasePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Case {
  id: string;
  client_id: string;
  assigned_staff_id: string | null;
  case_number: string;
  case_type: string;
  court: string;
  court_case_number: string | null;
  opponent_name: string | null;
  opponent_lawyer: string | null;
  status: CaseStatus;
  priority: CasePriority;
  filing_date: string;
  next_hearing_at: string | null;
  case_value: number | null;
  currency: string | null;
  description: string | null;
  internal_notes: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseInsert = Omit<Case, 'id' | 'created_at' | 'updated_at'>;
export type CaseUpdate = Partial<CaseInsert>;

export type CaseFilterOptions = {
  search?: string;
  status?: CaseStatus | 'all';
  priority?: CasePriority | 'all';
  clientId?: string | 'all';
  caseType?: string | 'all';
  sortBy?: keyof Case | 'filing_date' | 'next_hearing_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type CaseListResult = {
  data: Case[];
  count: number;
};

export type CaseWithRelations = Case & {
  client?: {
    id: string;
    full_name: string;
    email?: string | null;
  } | null;
  assigned_staff?: {
    id: string;
    full_name: string;
    email?: string | null;
  } | null;
};

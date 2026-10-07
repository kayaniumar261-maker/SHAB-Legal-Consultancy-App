export type HearingStatus = 'Scheduled' | 'Completed' | 'Adjourned' | 'Cancelled' | 'Pending';

export type HearingType = 'Preliminary' | 'Case Management' | 'Final Hearing' | 'Appeal' | 'Other';

export interface Hearing {
  id: string;
  case_id: string;
  case?: {
    case_number: string | null;
    matter_number: string | null;
    court_case_number: string | null;
    client: { full_name: string | null } | null;
  } | null;
  assigned_staff_id: string | null;
  title: string;
  hearing_at: string;
  end_at: string | null;
  court: string;
  courtroom: string | null;
  location: string | null;
  hearing_type: HearingType;
  status: HearingStatus;
  outcome: string | null;
  notes: string | null;
  reminder_minutes: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type HearingInsert = Omit<Hearing, 'id' | 'created_at' | 'updated_at' | 'case'>;
export type HearingUpdate = Partial<HearingInsert>;

export interface HearingFilterOptions {
  status?: HearingStatus;
  hearing_type?: HearingType;
  assigned_staff_id?: string;
  startDate?: string;
  endDate?: string;
}

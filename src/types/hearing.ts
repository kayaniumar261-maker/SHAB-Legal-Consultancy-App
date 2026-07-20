export interface Hearing {
  id: string;

  caseId: string;

  court: string;

  hearingDate: string;

  hearingTime: string;

  courtroom?: string;

  judge?: string;

  notes?: string;

  createdAt: string;

  updatedAt: string;
}

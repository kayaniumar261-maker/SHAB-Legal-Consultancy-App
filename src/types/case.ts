export type CaseStatus =
  | "Open"
  | "Pending"
  | "Closed";

export interface Case {
  id: string;

  clientId: string;

  title: string;

  caseNumber: string;

  court: string;

  category: string;

  lawyer: string;

  status: CaseStatus;

  filingDate: string;

  nextHearing?: string;

  claimAmount?: number;

  notes?: string;

  createdAt: string;

  updatedAt: string;
}

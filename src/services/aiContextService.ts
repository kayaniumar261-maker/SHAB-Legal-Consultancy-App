import {
  getCaseActivities,
  getCaseNotes,
  getCaseStatusHistory,
} from './caseService';

import { getHearingsByCase } from './hearingService';
import { getTasksByCase } from './taskService';
import { getDocumentsByCase } from './documentService';
import { getInvoices } from './invoiceService';
import { getPayments } from './paymentService';

import type {
  CaseActivity,
  CaseNote,
  CaseStatusHistory,
  CaseWithRelations,
} from '../types/case';

import type { DocumentWithRelations } from '../types/document';
import type { Hearing } from '../types/hearing';
import type { Invoice } from '../types/invoice';
import type { Payment } from '../types/payment';
import type { Task } from '../types/task';

export type AIMatterContext = {
  caseRecord: CaseWithRelations;
  clientName: string;

  hearings: Hearing[];
  tasks: Task[];
  documents: DocumentWithRelations[];
  invoices: Invoice[];
  payments: Payment[];
  notes: CaseNote[];
  activities: CaseActivity[];
  statusHistory: CaseStatusHistory[];

  loadedAt: string;
  errors: string[];
};

export type AIContextSourceCounts = {
  hearings: number;
  tasks: number;
  documents: number;
  invoices: number;
  payments: number;
  notes: number;
  activities: number;
  statusHistory: number;
};

export async function loadAIMatterContext(
  caseRecord: CaseWithRelations,
  clientName: string,
): Promise<AIMatterContext> {
  const results = await Promise.allSettled([
    getHearingsByCase(caseRecord.id),
    getTasksByCase(caseRecord.id),
    getDocumentsByCase(caseRecord.id),

    getInvoices({
      caseId: caseRecord.id,
      page: 1,
      pageSize: 100,
    }),

    getPayments({
      caseId: caseRecord.id,
      page: 1,
      pageSize: 100,
    }),

    getCaseNotes(caseRecord.id),
    getCaseActivities(caseRecord.id),
    getCaseStatusHistory(caseRecord.id),
  ]);

  const errors: string[] = [];

  return {
    caseRecord,
    clientName,

    hearings: readArray<Hearing>(
      results[0],
      'Hearings',
      errors,
    ),

    tasks: readArray<Task>(
      results[1],
      'Tasks',
      errors,
    ),

    documents: readArray<DocumentWithRelations>(
      results[2],
      'Documents',
      errors,
    ),

    invoices: readDataArray<Invoice>(
      results[3],
      'Invoices',
      errors,
    ),

    payments: readDataArray<Payment>(
      results[4],
      'Payments',
      errors,
    ),

    notes: readArray<CaseNote>(
      results[5],
      'Notes',
      errors,
    ),

    activities: readArray<CaseActivity>(
      results[6],
      'Activities',
      errors,
    ),

    statusHistory: readArray<CaseStatusHistory>(
      results[7],
      'Status history',
      errors,
    ),

    loadedAt: new Date().toISOString(),
    errors,
  };
}

export function getAIContextSourceCounts(
  context: AIMatterContext,
): AIContextSourceCounts {
  return {
    hearings: context.hearings.length,
    tasks: context.tasks.length,
    documents: context.documents.length,
    invoices: context.invoices.length,
    payments: context.payments.length,
    notes: context.notes.length,
    activities: context.activities.length,
    statusHistory: context.statusHistory.length,
  };
}

function readArray<T>(
  result: PromiseSettledResult<unknown>,
  source: string,
  errors: string[],
): T[] {
  if (result.status === 'rejected') {
    errors.push(
      `${source}: ${getErrorMessage(result.reason)}`,
    );

    return [];
  }

  return Array.isArray(result.value)
    ? (result.value as T[])
    : [];
}

function readDataArray<T>(
  result: PromiseSettledResult<unknown>,
  source: string,
  errors: string[],
): T[] {
  if (result.status === 'rejected') {
    errors.push(
      `${source}: ${getErrorMessage(result.reason)}`,
    );

    return [];
  }

  if (Array.isArray(result.value)) {
    return result.value as T[];
  }

  if (
    result.value &&
    typeof result.value === 'object' &&
    'data' in result.value
  ) {
    const data = (
      result.value as {
        data?: unknown;
      }
    ).data;

    return Array.isArray(data)
      ? (data as T[])
      : [];
  }

  return [];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error ?? 'Unknown error');
}

import {
  getCases,
} from './caseService';

import {
  getClients,
} from './clientService';

import {
  getHearingsToday,
} from './hearingService';

import {
  getTasksForToday,
} from './taskService';

import {
  countDocuments,
} from './documentService';

import {
  countStaff,
} from './staffService';

import {
  getOutstandingInvoicesAmount,
} from './invoiceService';

import {
  getRevenueForMonth,
} from './paymentService';

export type DashboardKPIData = {
  activeCases: number;
  totalClients: number;
  hearingsToday: number;
  tasksDueToday: number;
  outstandingPayments: number;
  monthlyRevenue: number;
  documentsUploaded: number;
  activeStaff: number;
};

export type DashboardServiceError = {
  section: keyof DashboardKPIData;
  message: string;
};

export type DashboardSummary = {
  data: DashboardKPIData;
  errors: DashboardServiceError[];
  loadedAt: string;
};

const initialDashboardData: DashboardKPIData = {
  activeCases: 0,
  totalClients: 0,
  hearingsToday: 0,
  tasksDueToday: 0,
  outstandingPayments: 0,
  monthlyRevenue: 0,
  documentsUploaded: 0,
  activeStaff: 0,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown dashboard error occurred.';
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();

  const results = await Promise.allSettled([
    getCases({
      status: 'open',
      page: 1,
      pageSize: 1,
    }),

    getClients({
      page: 1,
      pageSize: 1,
    }),

    getHearingsToday(),

    getTasksForToday(),

    getOutstandingInvoicesAmount(),

    getRevenueForMonth(
      now.getFullYear(),
      now.getMonth() + 1,
    ),

    countDocuments(),

    countStaff(),
  ]);

  const data: DashboardKPIData = {
    ...initialDashboardData,
  };

  const errors: DashboardServiceError[] = [];

  const [
    activeCasesResult,
    clientsResult,
    hearingsResult,
    tasksResult,
    outstandingResult,
    revenueResult,
    documentsResult,
    staffResult,
  ] = results;

  if (activeCasesResult.status === 'fulfilled') {
    data.activeCases = activeCasesResult.value.count ?? 0;
  } else {
    errors.push({
      section: 'activeCases',
      message: getErrorMessage(activeCasesResult.reason),
    });
  }

  if (clientsResult.status === 'fulfilled') {
    data.totalClients = clientsResult.value.count ?? 0;
  } else {
    errors.push({
      section: 'totalClients',
      message: getErrorMessage(clientsResult.reason),
    });
  }

  if (hearingsResult.status === 'fulfilled') {
    data.hearingsToday = hearingsResult.value.length;
  } else {
    errors.push({
      section: 'hearingsToday',
      message: getErrorMessage(hearingsResult.reason),
    });
  }

  if (tasksResult.status === 'fulfilled') {
    data.tasksDueToday = tasksResult.value.length;
  } else {
    errors.push({
      section: 'tasksDueToday',
      message: getErrorMessage(tasksResult.reason),
    });
  }

  if (outstandingResult.status === 'fulfilled') {
    data.outstandingPayments = Number(
      outstandingResult.value ?? 0,
    );
  } else {
    errors.push({
      section: 'outstandingPayments',
      message: getErrorMessage(outstandingResult.reason),
    });
  }

  if (revenueResult.status === 'fulfilled') {
    data.monthlyRevenue = Number(
      revenueResult.value ?? 0,
    );
  } else {
    errors.push({
      section: 'monthlyRevenue',
      message: getErrorMessage(revenueResult.reason),
    });
  }

  if (documentsResult.status === 'fulfilled') {
    data.documentsUploaded = Number(
      documentsResult.value ?? 0,
    );
  } else {
    errors.push({
      section: 'documentsUploaded',
      message: getErrorMessage(documentsResult.reason),
    });
  }

  if (staffResult.status === 'fulfilled') {
    data.activeStaff = Number(
      staffResult.value ?? 0,
    );
  } else {
    errors.push({
      section: 'activeStaff',
      message: getErrorMessage(staffResult.reason),
    });
  }

  return {
    data,
    errors,
    loadedAt: new Date().toISOString(),
  };
}
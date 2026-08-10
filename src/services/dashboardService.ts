import { supabase } from '../lib/supabase';

import {
  getCases,
} from './caseService';

import {
  getClients,
} from './clientService';

import {
  getHearings,
  getHearingsToday,
} from './hearingService';

import {
  getTaskDashboardStats,
  getTasksForToday,
} from './taskService';

import {
  countDocuments,
} from './documentService';

import {
  countStaff,
} from './staffService';

import {
  getFinanceSummary,
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
  collectionRate: number;
  overdueInvoices: number;
  overdueTasks: number;
  hearingsTomorrow: number;
  newClientsThisMonth: number;
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
  collectionRate: 0,
  overdueInvoices: 0,
  overdueTasks: 0,
  hearingsTomorrow: 0,
  newClientsThisMonth: 0,
  documentsUploaded: 0,
  activeStaff: 0,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown dashboard error occurred.';
}

async function countNewClientsThisMonth(
  now: Date,
): Promise<number> {
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  );

  const nextMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  );

  const result = await supabase
    .from('clients')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .gte(
      'created_at',
      monthStart.toISOString(),
    )
    .lt(
      'created_at',
      nextMonthStart.toISOString(),
    );

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.count ?? 0;
}

async function countHearingsTomorrow(
  now: Date,
): Promise<number> {
  const tomorrowStart = new Date(now);

  tomorrowStart.setDate(
    tomorrowStart.getDate() + 1,
  );

  tomorrowStart.setHours(
    0,
    0,
    0,
    0,
  );

  const tomorrowEnd = new Date(
    tomorrowStart,
  );

  tomorrowEnd.setHours(
    23,
    59,
    59,
    999,
  );

  const result = await getHearings({
    page: 1,
    pageSize: 1,
    filters: {
      startDate:
        tomorrowStart.toISOString(),
      endDate:
        tomorrowEnd.toISOString(),
    },
  });

  return result.count;
}

export async function getDashboardSummary(includeFinancial = false): Promise<DashboardSummary> {
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

    includeFinancial ? getFinanceSummary() : Promise.resolve(null),

    includeFinancial
      ? getRevenueForMonth(
          now.getFullYear(),
          now.getMonth() + 1,
        )
      : Promise.resolve(null),

    getTaskDashboardStats(),

    countHearingsTomorrow(now),

    countNewClientsThisMonth(now),

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
    financeResult,
    revenueResult,
    taskStatsResult,
    tomorrowHearingsResult,
    newClientsResult,
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

  if (includeFinancial && financeResult.status === 'fulfilled' && financeResult.value) {
    data.outstandingPayments = Number(
      financeResult.value.outstanding ?? 0,
    );

    data.collectionRate = Number(
      financeResult.value.collectionRate ?? 0,
    );

    data.overdueInvoices = Number(
      financeResult.value.overdueInvoiceCount ?? 0,
    );
  } else if (includeFinancial && financeResult.status === 'rejected') {
    errors.push({
      section: 'outstandingPayments',
      message: getErrorMessage(
        financeResult.reason,
      ),
    });
  }

  if (includeFinancial && revenueResult.status === 'fulfilled' && revenueResult.value !== null) {
    data.monthlyRevenue = Number(
      revenueResult.value ?? 0,
    );
  } else if (includeFinancial && revenueResult.status === 'rejected') {
    errors.push({
      section: 'monthlyRevenue',
      message: getErrorMessage(revenueResult.reason),
    });
  }

  if (taskStatsResult.status === 'fulfilled') {
    data.overdueTasks =
      taskStatsResult.value.overdue;
  } else {
    errors.push({
      section: 'overdueTasks',
      message: getErrorMessage(
        taskStatsResult.reason,
      ),
    });
  }

  if (
    tomorrowHearingsResult.status ===
    'fulfilled'
  ) {
    data.hearingsTomorrow =
      tomorrowHearingsResult.value;
  } else {
    errors.push({
      section: 'hearingsTomorrow',
      message: getErrorMessage(
        tomorrowHearingsResult.reason,
      ),
    });
  }

  if (newClientsResult.status === 'fulfilled') {
    data.newClientsThisMonth =
      newClientsResult.value;
  } else {
    errors.push({
      section: 'newClientsThisMonth',
      message: getErrorMessage(
        newClientsResult.reason,
      ),
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
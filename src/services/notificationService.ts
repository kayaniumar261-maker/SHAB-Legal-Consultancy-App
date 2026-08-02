import type {
  PostgrestError,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../lib/supabase';

import type {
  Notification,
  NotificationInsert,
} from '../types/notification';

import {
  getDashboardSummary,
} from './dashboardService';

import {
  getCases,
} from './caseService';

function handleNotificationError<T>(
  result: {
    error: PostgrestError | null;
    data: T | null;
  },
): T {
  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }

  if (result.data === null) {
    throw new Error(
      'No data returned from Supabase.',
    );
  }

  return result.data;
}

export async function getNotifications(
  userId?: string,
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (userId) {
    query = query.eq(
      'user_id',
      userId,
    );
  }

  const result = await query;

  return handleNotificationError(
    result,
  ) as Notification[];
}

export async function markNotificationRead(
  id: string,
): Promise<void> {
  const result = await supabase
    .from('notifications')
    .update({
      read: true,
    })
    .eq('id', id);

  if (result.error) {
    throw new Error(
      result.error.message,
    );
  }
}

export async function createNotification(
  data: NotificationInsert,
): Promise<Notification> {
  const result = await supabase
    .from('notifications')
    .insert(data)
    .select()
    .single();

  return handleNotificationError(
    result,
  ) as Notification;
}

export type NotificationTone =
  | 'danger'
  | 'warning'
  | 'info'
  | 'success';

export type PracticeNotification = {
  id: string;
  title: string;
  message: string;
  tone: NotificationTone;
  to: string;
};

export type NotificationCenterData = {
  items: PracticeNotification[];
  loadedAt: string;
  errors: string[];
};

export async function getNotificationCenterData():
  Promise<NotificationCenterData> {
  const [
    dashboardResult,
    urgentCasesResult,
  ] = await Promise.allSettled([
    getDashboardSummary(),

    getCases({
      requiresUrgentAction: true,
      page: 1,
      pageSize: 5,
      isArchived: false,
    }),
  ]);

  const items: PracticeNotification[] = [];
  const errors: string[] = [];

  if (dashboardResult.status === 'fulfilled') {
    const metrics =
      dashboardResult.value.data;

    if (metrics.overdueTasks > 0) {
      items.push({
        id: `overdue-tasks-${metrics.overdueTasks}`,
        title: 'Overdue tasks',
        message:
          `${metrics.overdueTasks} task${
            metrics.overdueTasks === 1 ? '' : 's'
          } require immediate attention.`,
        tone: 'danger',
        to: '/tasks',
      });
    }

    if (metrics.tasksDueToday > 0) {
      items.push({
        id: `tasks-today-${metrics.tasksDueToday}`,
        title: 'Tasks due today',
        message:
          `${metrics.tasksDueToday} task${
            metrics.tasksDueToday === 1 ? '' : 's'
          } must be completed today.`,
        tone: 'warning',
        to: '/tasks?date=today',
      });
    }

    if (metrics.hearingsToday > 0) {
      items.push({
        id: `hearings-today-${metrics.hearingsToday}`,
        title: 'Hearings today',
        message:
          `${metrics.hearingsToday} court appearance${
            metrics.hearingsToday === 1 ? '' : 's'
          } scheduled today.`,
        tone: 'danger',
        to: '/hearings?date=today',
      });
    }

    if (metrics.hearingsTomorrow > 0) {
      items.push({
        id: `hearings-tomorrow-${metrics.hearingsTomorrow}`,
        title: 'Hearings tomorrow',
        message:
          `${metrics.hearingsTomorrow} hearing${
            metrics.hearingsTomorrow === 1 ? '' : 's'
          } require preparation for tomorrow.`,
        tone: 'warning',
        to: '/hearings',
      });
    }

    if (metrics.overdueInvoices > 0) {
      items.push({
        id: `overdue-invoices-${metrics.overdueInvoices}`,
        title: 'Overdue invoices',
        message:
          `${metrics.overdueInvoices} invoice${
            metrics.overdueInvoices === 1 ? '' : 's'
          } require collection follow-up.`,
        tone: 'danger',
        to: '/payments?tab=invoices',
      });
    }

    if (metrics.outstandingPayments > 0) {
      items.push({
        id:
          `outstanding-${Math.round(
            metrics.outstandingPayments,
          )}`,
        title: 'Outstanding receivables',
        message:
          `${formatCurrency(
            metrics.outstandingPayments,
          )} remains unpaid.`,
        tone: 'warning',
        to: '/payments',
      });
    }

    if (
      metrics.overdueTasks === 0 &&
      metrics.hearingsToday === 0 &&
      metrics.overdueInvoices === 0
    ) {
      items.push({
        id: 'operations-clear',
        title: 'Operations are clear',
        message:
          'No overdue tasks, hearings today, or overdue invoices.',
        tone: 'success',
        to: '/',
      });
    }

    errors.push(
      ...dashboardResult.value.errors.map(
        (error) => error.message,
      ),
    );
  } else {
    errors.push(
      dashboardResult.reason instanceof Error
        ? dashboardResult.reason.message
        : 'Unable to load dashboard notifications.',
    );
  }

  if (urgentCasesResult.status === 'fulfilled') {
    for (
      const caseRecord of
      urgentCasesResult.value.data
    ) {
      items.unshift({
        id: `urgent-case-${caseRecord.id}`,
        title: 'Urgent legal matter',
        message:
          caseRecord.matter_number ??
          caseRecord.case_number ??
          caseRecord.case_type ??
          'A legal matter requires urgent action.',
        tone: 'danger',
        to: `/cases/${caseRecord.id}`,
      });
    }
  } else {
    errors.push(
      urgentCasesResult.reason instanceof Error
        ? urgentCasesResult.reason.message
        : 'Unable to load urgent matters.',
    );
  }

  return {
    items,
    loadedAt: new Date().toISOString(),
    errors,
  };
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value);
}

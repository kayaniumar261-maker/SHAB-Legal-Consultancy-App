import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type {
  Task,
  TaskInsert,
  TaskListResult,
  TaskUpdate,
  TaskFilterOptions,
} from '../types/task';
import type { Client } from '../types/client';
import type { Case } from '../types/case';

function handleError<T>(result: {
  error: PostgrestError | null;
  data: T | null;
}): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return result.data;
}

function handleCount(result: {
  error: PostgrestError | null;
  count: number | null;
}): number {
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.count ?? 0;
}

export type TaskDashboardStats = {
  total: number;
  dueToday: number;
  overdue: number;
  inProgress: number;
  completed: number;
};

export async function getTaskDashboardStats(): Promise<TaskDashboardStats> {
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const [
    totalResult,
    dueTodayResult,
    overdueResult,
    inProgressResult,
    completedResult,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      }),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .in('status', ['Pending', 'In Progress'])
      .gte('due_at', startOfToday.toISOString())
      .lt('due_at', startOfTomorrow.toISOString()),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .in('status', ['Pending', 'In Progress'])
      .lt('due_at', now.toISOString()),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'In Progress'),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'Completed'),
  ]);

  return {
    total: handleCount(totalResult),
    dueToday: handleCount(dueTodayResult),
    overdue: handleCount(overdueResult),
    inProgress: handleCount(inProgressResult),
    completed: handleCount(completedResult),
  };
}

export async function getTasks(
  options: TaskFilterOptions = {},
): Promise<TaskListResult> {
  const {
    search,
    status = 'all',
    priority = 'all',
    assignedStaffId = 'all',
    dueAfter,
    dueBefore,
    page = 1,
    pageSize = 12,
  } = options;

  const query = supabase
    .from('tasks')
    .select('*', { count: 'exact' })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query.eq('status', status);
  }

  if (priority !== 'all') {
    query.eq('priority', priority);
  }

  if (assignedStaffId !== 'all') {
    query.eq('assigned_staff_id', assignedStaffId);
  }

  if (dueAfter) {
    query.gte('due_at', dueAfter);
  }

  if (dueBefore) {
    query.lte('due_at', dueBefore);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query.or(`title.ilike.${term},description.ilike.${term}`);
  }

  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  const result = await query.range(from, to);
  const data = handleError(result);

  return {
    data,
    count: result.count ?? 0,
  };
}

export async function getAllTasks(): Promise<Task[]> {
  const result = await supabase
    .from('tasks')
    .select('*')
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  return handleError(result);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const result = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (result.error) {
    if (result.error.code === 'PGRST116') {
      return null;
    }

    throw new Error(result.error.message);
  }

  return result.data;
}

export async function createTask(data: TaskInsert): Promise<Task> {
  const result = await supabase
    .from('tasks')
    .insert(data)
    .select()
    .single();

  return handleError(result);
}

export async function updateTask(
  id: string,
  data: TaskUpdate,
): Promise<Task> {
  const result = await supabase
    .from('tasks')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  return handleError(result);
}

export async function deleteTask(id: string): Promise<void> {
  const result = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (result.error) {
    throw new Error(result.error.message);
  }
}

export async function completeTask(id: string): Promise<Task> {
  return updateTask(id, {
    status: 'Completed',
    completed_at: new Date().toISOString(),
  });
}

export async function markTaskInProgress(id: string): Promise<Task> {
  return updateTask(id, {
    status: 'In Progress',
    completed_at: null,
  });
}

export type ClientOption = Pick<Client, 'id' | 'full_name'>;

export async function getClientOptions(): Promise<ClientOption[]> {
  const result = await supabase
    .from('clients')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  return handleError(result);
}

export type CaseOption = Pick<
  Case,
  'id' | 'case_number' | 'case_type' | 'client_id'
>;

export async function getCaseOptions(): Promise<CaseOption[]> {
  const result = await supabase
    .from('cases')
    .select('id, case_number, case_type, client_id')
    .order('case_number', { ascending: true });

  return handleError(result);
}

export async function getCasesByClient(
  clientId: string,
): Promise<CaseOption[]> {
  const result = await supabase
    .from('cases')
    .select('id, case_number, case_type, client_id')
    .eq('client_id', clientId)
    .order('case_number', { ascending: true });

  return handleError(result);
}

export type StaffOption = {
  id: string;
  name: string;
};

export async function getStaffOptions(): Promise<StaffOption[]> {
  const result = await supabase
    .from('staff')
    .select('id, name')
    .order('name', { ascending: true });

  if (result.error) {
    if (result.error.code === 'PGRST116') {
      return [];
    }

    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

export async function getTasksForToday(): Promise<Task[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const result = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['Pending', 'In Progress'])
    .gte('due_at', start.toISOString())
    .lt('due_at', end.toISOString())
    .order('due_at', { ascending: true });

  return handleError(result);
}
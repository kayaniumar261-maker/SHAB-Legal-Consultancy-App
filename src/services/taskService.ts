import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type {
  Task,
  TaskInsert,
  TaskListResult,
  TaskUpdate,
  TaskFilterOptions,
  TaskPriority,
  TaskStatus,
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
    throw new Error(
      'No data returned from Supabase.',
    );
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

/* =========================================================
   DATABASE NORMALIZATION
========================================================= */

function normalizeStatusForDatabase(
  status: TaskStatus | string | null | undefined,
): string | null {
  if (!status) {
    return null;
  }

  return status
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizePriorityForDatabase(
  priority:
    | TaskPriority
    | string
    | null
    | undefined,
): string | null {
  if (!priority) {
    return null;
  }

  return priority
    .trim()
    .toLowerCase();
}

/* =========================================================
   UI NORMALIZATION
========================================================= */

function normalizeStatusForUI(
  status: string | null | undefined,
): TaskStatus {
  switch (
    status
      ?.trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
  ) {
    case 'in_progress':
      return 'In Progress';

    case 'completed':
      return 'Completed';

    case 'on_hold':
      return 'On Hold';

    case 'pending':
    default:
      return 'Pending';
  }
}

function normalizePriorityForUI(
  priority: string | null | undefined,
): TaskPriority {
  switch (
    priority
      ?.trim()
      .toLowerCase()
  ) {
    case 'low':
      return 'Low';

    case 'high':
      return 'High';

    case 'urgent':
      return 'Urgent';

    case 'medium':
    default:
      return 'Medium';
  }
}

function normalizeTask(
  task: Task,
): Task {
  return {
    ...task,

    status:
      normalizeStatusForUI(
        task.status,
      ),

    priority:
      normalizePriorityForUI(
        task.priority,
      ),
  };
}

function normalizeTaskPayload(
  data: TaskInsert | TaskUpdate,
): Record<string, unknown> {
  const payload: Record<
    string,
    unknown
  > = {
    ...data,
  };

  if (
    data.status !== undefined
  ) {
    payload.status =
      normalizeStatusForDatabase(
        data.status,
      );
  }

  if (
    data.priority !== undefined
  ) {
    payload.priority =
      normalizePriorityForDatabase(
        data.priority,
      );
  }

  return payload;
}

/* =========================================================
   DASHBOARD TYPES
========================================================= */

export type TaskDashboardStats = {
  total: number;
  dueToday: number;
  overdue: number;
  inProgress: number;
  completed: number;
};

/* =========================================================
   DASHBOARD STATS
========================================================= */

export async function getTaskDashboardStats(): Promise<TaskDashboardStats> {
  const now = new Date();

  const startOfToday =
    new Date(now);

  startOfToday.setHours(
    0,
    0,
    0,
    0,
  );

  const startOfTomorrow =
    new Date(
      startOfToday,
    );

  startOfTomorrow.setDate(
    startOfTomorrow.getDate() +
      1,
  );

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
      .in('status', [
        'pending',
        'in_progress',
      ])
      .gte(
        'due_at',
        startOfToday.toISOString(),
      )
      .lt(
        'due_at',
        startOfTomorrow.toISOString(),
      ),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .in('status', [
        'pending',
        'in_progress',
      ])
      .lt(
        'due_at',
        now.toISOString(),
      ),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq(
        'status',
        'in_progress',
      ),

    supabase
      .from('tasks')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq(
        'status',
        'completed',
      ),
  ]);

  return {
    total:
      handleCount(
        totalResult,
      ),

    dueToday:
      handleCount(
        dueTodayResult,
      ),

    overdue:
      handleCount(
        overdueResult,
      ),

    inProgress:
      handleCount(
        inProgressResult,
      ),

    completed:
      handleCount(
        completedResult,
      ),
  };
}

/* =========================================================
   TASK LIST
========================================================= */

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

  let query = supabase
    .from('tasks')
    .select('*', {
      count: 'exact',
    })
    .order(
      'due_at',
      {
        ascending: true,
        nullsFirst: false,
      },
    )
    .order(
      'created_at',
      {
        ascending: false,
      },
    );

  if (
    status !== 'all'
  ) {
    query = query.eq(
      'status',
      normalizeStatusForDatabase(
        status,
      ),
    );
  }

  if (
    priority !== 'all'
  ) {
    query = query.eq(
      'priority',
      normalizePriorityForDatabase(
        priority,
      ),
    );
  }

  if (
    assignedStaffId !== 'all'
  ) {
    query = query.eq(
      'assigned_staff_id',
      assignedStaffId,
    );
  }

  if (dueAfter) {
    query = query.gte(
      'due_at',
      dueAfter,
    );
  }

  if (dueBefore) {
    query = query.lte(
      'due_at',
      dueBefore,
    );
  }

  if (
    search?.trim()
  ) {
    const term =
      `%${search.trim()}%`;

    query = query.or(
      `title.ilike.${term},description.ilike.${term}`,
    );
  }

  const safePage =
    Math.max(
      1,
      page,
    );

  const safePageSize =
    Math.max(
      1,
      pageSize,
    );

  const from =
    (safePage - 1) *
    safePageSize;

  const to =
    from +
    safePageSize -
    1;

  const result =
    await query.range(
      from,
      to,
    );

  if (
    result.error
  ) {
    throw new Error(
      result.error.message,
    );
  }

  const data =
    (result.data ??
      []) as Task[];

  return {
    data:
      data.map(
        normalizeTask,
      ),

    count:
      result.count ??
      0,
  };
}

/* =========================================================
   ALL TASKS
========================================================= */

export async function getAllTasks(): Promise<Task[]> {
  const result =
    await supabase
      .from('tasks')
      .select('*')
      .order(
        'due_at',
        {
          ascending: true,
          nullsFirst:
            false,
        },
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      );

  const tasks =
    handleError(
      result,
    ) as Task[];

  return tasks.map(
    normalizeTask,
  );
}

/* =========================================================
   SINGLE TASK
========================================================= */

export async function getTaskById(
  id: string,
): Promise<Task | null> {
  const result =
    await supabase
      .from('tasks')
      .select('*')
      .eq(
        'id',
        id,
      )
      .maybeSingle();

  if (
    result.error
  ) {
    throw new Error(
      result.error.message,
    );
  }

  if (
    !result.data
  ) {
    return null;
  }

  return normalizeTask(
    result.data as Task,
  );
}

/* =========================================================
   CREATE
========================================================= */

export async function createTask(
  data: TaskInsert,
): Promise<Task> {
  const payload =
    normalizeTaskPayload(
      data,
    );

  const result =
    await supabase
      .from('tasks')
      .insert(payload)
      .select('*')
      .single();

  const task =
    handleError(
      result,
    ) as Task;

  return normalizeTask(
    task,
  );
}

/* =========================================================
   UPDATE
========================================================= */

export async function updateTask(
  id: string,
  data: TaskUpdate,
): Promise<Task> {
  const payload =
    normalizeTaskPayload(
      data,
    );

  const result =
    await supabase
      .from('tasks')
      .update({
        ...payload,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        id,
      )
      .select('*')
      .single();

  const task =
    handleError(
      result,
    ) as Task;

  return normalizeTask(
    task,
  );
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteTask(
  id: string,
): Promise<void> {
  const result =
    await supabase
      .from('tasks')
      .delete()
      .eq(
        'id',
        id,
      );

  if (
    result.error
  ) {
    throw new Error(
      result.error.message,
    );
  }
}

/* =========================================================
   QUICK STATUS ACTIONS
========================================================= */

export async function completeTask(
  id: string,
): Promise<Task> {
  return updateTask(
    id,
    {
      status:
        'Completed',

      completed_at:
        new Date().toISOString(),
    },
  );
}

export async function markTaskInProgress(
  id: string,
): Promise<Task> {
  return updateTask(
    id,
    {
      status:
        'In Progress',

      completed_at:
        null,
    },
  );
}

/* =========================================================
   CLIENT OPTIONS
========================================================= */

export type ClientOption =
  Pick<
    Client,
    'id' | 'full_name'
  >;

export async function getClientOptions(): Promise<ClientOption[]> {
  const result =
    await supabase
      .from('clients')
      .select(
        'id, full_name',
      )
      .order(
        'full_name',
        {
          ascending: true,
        },
      );

  return handleError(
    result,
  );
}

/* =========================================================
   CASE OPTIONS
========================================================= */

export type CaseOption =
  Pick<
    Case,
    | 'id'
    | 'case_number'
    | 'case_type'
    | 'client_id'
  >;

export async function getCaseOptions(): Promise<CaseOption[]> {
  const result =
    await supabase
      .from('cases')
      .select(
        'id, case_number, case_type, client_id',
      )
      .order(
        'case_number',
        {
          ascending: true,
        },
      );

  return handleError(
    result,
  );
}

export async function getCasesByClient(
  clientId: string,
): Promise<CaseOption[]> {
  const result =
    await supabase
      .from('cases')
      .select(
        'id, case_number, case_type, client_id',
      )
      .eq(
        'client_id',
        clientId,
      )
      .order(
        'case_number',
        {
          ascending: true,
        },
      );

  return handleError(
    result,
  );
}

/* =========================================================
   STAFF OPTIONS
========================================================= */

export type StaffOption = {
  id: string;
  name: string;
};

export async function getStaffOptions(): Promise<StaffOption[]> {
  const result = await supabase
    .from('staff')
    .select('id, full_name')
    .order('full_name', {
      ascending: true,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).map((member) => ({
    id: member.id,
    name: member.full_name,
  }));
}

/* =========================================================
   TASKS DUE TODAY
========================================================= */

export async function getTasksForToday(): Promise<Task[]> {
  const start =
    new Date();

  start.setHours(
    0,
    0,
    0,
    0,
  );

  const end =
    new Date(
      start,
    );

  end.setDate(
    end.getDate() +
      1,
  );

  const result =
    await supabase
      .from('tasks')
      .select('*')
      .in(
        'status',
        [
          'pending',
          'in_progress',
        ],
      )
      .gte(
        'due_at',
        start.toISOString(),
      )
      .lt(
        'due_at',
        end.toISOString(),
      )
      .order(
        'due_at',
        {
          ascending: true,
        },
      );

  const tasks =
    handleError(
      result,
    ) as Task[];

  return tasks.map(
    normalizeTask,
  );
}
export type TaskStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'On Hold';

export type TaskPriority =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Urgent';

export interface Task {
  id: string;
  case_id: string | null;
  client_id: string | null;
  assigned_staff_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskInsert = Omit<
  Task,
  'id' | 'created_at' | 'updated_at'
>;

export type TaskUpdate = Partial<TaskInsert>;

export type TaskFilterOptions = {
  search?: string;
  status?: TaskStatus | 'all';
  statusIn?: TaskStatus[];
  priority?: TaskPriority | 'all';
  assignedStaffId?: string | 'all';
  clientId?: string;
  caseId?: string;
  taskId?: string;
  dueAfter?: string;
  dueBefore?: string;
  page?: number;
  pageSize?: number;
};

export type TaskListResult = {
  data: Task[];
  count: number;
};

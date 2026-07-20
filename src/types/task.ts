export type TaskPriority =
  | "Low"
  | "Medium"
  | "High";

export interface Task {
  id: string;

  title: string;

  description?: string;

  assignedTo: string;

  dueDate: string;

  completed: boolean;

  priority: TaskPriority;

  relatedCase?: string;

  createdAt: string;

  updatedAt: string;
}

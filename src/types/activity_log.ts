export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export type ActivityLogInsert = Omit<ActivityLog, 'id' | 'created_at'>;

export interface Notification {
  id: string;
  user_id: string | null;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export type NotificationInsert = Omit<Notification, 'id' | 'created_at' | 'read'>;

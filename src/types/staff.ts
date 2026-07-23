export interface Staff {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  phone: string | null;
  status: 'active' | 'inactive' | 'on_leave';
  created_at: string;
  updated_at: string;
}

export type StaffInsert = Omit<Staff, 'id' | 'created_at' | 'updated_at'>;

export type StaffUpdate = Partial<StaffInsert>;

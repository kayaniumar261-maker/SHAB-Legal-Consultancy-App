export interface Client {
  id: string;
  full_name: string;
  client_type: 'individual' | 'company';
  email: string | null;
  phone: string | null;
  nationality: string | null;
  emirates_id: string | null;
  passport_number: string | null;
  company_name: string | null;
  trade_license_number: string | null;
  address: string | null;
  notes: string | null;
  status: 'active' | 'inactive' | 'prospect';
  created_at: string;
  updated_at: string;
}

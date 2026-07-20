export interface Client {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  nationality?: string;
  emiratesId?: string;
  passport?: string;
  address?: string;
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

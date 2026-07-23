export interface Document {
  id: string;
  case_id: string | null;
  client_id: string | null;
  filename: string;
  url: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at' | 'uploaded_at'>;

export type DocumentUpdate = Partial<DocumentInsert>;

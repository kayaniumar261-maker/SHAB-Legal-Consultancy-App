export interface Document {
  id: string;

  case_id: string | null;
  client_id: string | null;
  uploaded_by_staff_id: string | null;

  name: string;
  document_type: string | null;

  storage_bucket: string;
  storage_path: string;

  mime_type: string | null;
  size_bytes: number | null;

  version: number;
  is_confidential: boolean;

  description: string | null;

  uploaded_by: string | null;

  created_at: string;
  updated_at: string;
}

export type DocumentInsert = Omit<
  Document,
  'id' | 'created_at' | 'updated_at'
> & {
  uploaded_by?: string | null;
};

export type DocumentUpdate = Partial<
  Omit<
    Document,
    'id' | 'created_at' | 'updated_at'
  >
>;

export interface DocumentWithRelations extends Document {
  client?: {
    id: string;
    full_name: string;
  } | null;

  case?: {
    id: string;
    case_number: string | null;
    case_type: string;
  } | null;

  uploaded_by_staff?: {
    id: string;
    full_name: string;
  } | null;
}

export type DocumentFilterOptions = {
  search?: string;
  clientId?: string | 'all';
  caseId?: string | 'all';
  staffId?: string | 'all';
  documentType?: string | 'all';
  confidential?: boolean | 'all';
  page?: number;
  pageSize?: number;
};

export type DocumentListResult = {
  data: DocumentWithRelations[];
  count: number;
};

export type DocumentUploadInput = {
  file: File;

  name?: string;
  document_type?: string | null;

  case_id?: string | null;
  client_id?: string | null;
  uploaded_by_staff_id?: string | null;

  is_confidential?: boolean;
  description?: string | null;
};
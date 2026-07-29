import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';

import type {
  Document,
  DocumentFilterOptions,
  DocumentInsert,
  DocumentListResult,
  DocumentUpdate,
  DocumentUploadInput,
  DocumentWithRelations,
} from '../types/document';

const DOCUMENT_BUCKET = 'legal-documents';

type SupabaseResult<T> = {
  error: PostgrestError | null;
  data: T | null;
};

function handleError<T>(
  result: SupabaseResult<T>,
  fallbackMessage = 'No data returned from Supabase.',
): T {
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.data === null) {
    throw new Error(fallbackMessage);
  }

  return result.data;
}

function sanitiseFilename(filename: string): string {
  const extensionIndex = filename.lastIndexOf('.');

  const extension =
    extensionIndex >= 0
      ? filename.slice(extensionIndex).toLowerCase()
      : '';

  const base =
    extensionIndex >= 0
      ? filename.slice(0, extensionIndex)
      : filename;

  const cleanBase = base
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `${cleanBase || 'document'}${extension}`;
}

function createStoragePath(
  file: File,
  caseId?: string | null,
  clientId?: string | null,
): string {
  const ownerFolder =
    caseId
      ? `cases/${caseId}`
      : clientId
        ? `clients/${clientId}`
        : 'general';

  const uniquePart =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `${ownerFolder}/${uniquePart}-${sanitiseFilename(file.name)}`;
}

const documentRelationsSelect = `
  *,
  client:clients(
    id,
    full_name
  ),
  case:cases(
    id,
    case_number,
    case_type
  ),
  uploaded_by_staff:staff!documents_uploaded_by_staff_id_fkey(
    id,
    full_name
  )
`;

export async function getDocuments(
  options: DocumentFilterOptions = {},
): Promise<DocumentListResult> {
  const {
    search = '',
    clientId = 'all',
    caseId = 'all',
    documentType = 'all',
    confidential = 'all',
    page = 1,
    pageSize = 20,
  } = options;

  const normalisedPage = Math.max(1, page);
  const normalisedPageSize = Math.min(
    100,
    Math.max(1, pageSize),
  );

  let query = supabase
    .from('documents')
    .select(documentRelationsSelect, {
      count: 'exact',
    });

  if (clientId !== 'all') {
    query = query.eq('client_id', clientId);
  }

  if (caseId !== 'all') {
    query = query.eq('case_id', caseId);
  }

  if (documentType !== 'all') {
    query = query.eq(
      'document_type',
      documentType,
    );
  }

  if (confidential !== 'all') {
    query = query.eq(
      'is_confidential',
      confidential,
    );
  }

  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    const safeSearch = trimmedSearch
      .replace(/[%_]/g, '')
      .replace(/,/g, ' ');

    query = query.or(
      [
        `name.ilike.%${safeSearch}%`,
        `document_type.ilike.%${safeSearch}%`,
        `description.ilike.%${safeSearch}%`,
        `mime_type.ilike.%${safeSearch}%`,
      ].join(','),
    );
  }

  const from =
    (normalisedPage - 1) *
    normalisedPageSize;

  const to =
    from + normalisedPageSize - 1;

  const result = await query
    .order('created_at', {
      ascending: false,
    })
    .range(from, to);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return {
    data:
      (result.data ??
        []) as unknown as DocumentWithRelations[],
    count: result.count ?? 0,
  };
}

export async function getDocumentById(
  id: string,
): Promise<DocumentWithRelations | null> {
  const result = await supabase
    .from('documents')
    .select(documentRelationsSelect)
    .eq('id', id)
    .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (
    result.data as unknown as DocumentWithRelations | null
  );
}

export async function getDocumentsByCase(
  caseId: string,
): Promise<Document[]> {
  const result = await supabase
    .from('documents')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', {
      ascending: false,
    });

  return handleError(
    result as SupabaseResult<Document[]>,
    'Unable to load case documents.',
  );
}

export async function getDocumentsByClient(
  clientId: string,
): Promise<Document[]> {
  const result = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', {
      ascending: false,
    });

  return handleError(
    result as SupabaseResult<Document[]>,
    'Unable to load client documents.',
  );
}

export async function createDocument(
  data: DocumentInsert,
): Promise<Document> {
  const result = await supabase
    .from('documents')
    .insert(data)
    .select('*')
    .single();

  return handleError(
    result as SupabaseResult<Document>,
    'Unable to create document.',
  );
}

export async function updateDocument(
  id: string,
  data: DocumentUpdate,
): Promise<Document> {
  const result = await supabase
    .from('documents')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  return handleError(
    result as SupabaseResult<Document>,
    'Unable to update document.',
  );
}

export async function uploadDocument(
  input: DocumentUploadInput,
): Promise<Document> {
  const {
    file,
    name,
    document_type,
    case_id,
    client_id,
    uploaded_by_staff_id,
    is_confidential = true,
    description,
  } = input;

  if (!file) {
    throw new Error(
      'Please select a file to upload.',
    );
  }

  const storagePath =
    createStoragePath(
      file,
      case_id,
      client_id,
    );

  const uploadResult = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType:
        file.type ||
        'application/octet-stream',
    });

  if (uploadResult.error) {
    throw new Error(
      uploadResult.error.message,
    );
  }

  try {
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(authError.message);
    }

    const insertData: DocumentInsert = {
      case_id: case_id ?? null,
      client_id: client_id ?? null,

      uploaded_by_staff_id:
        uploaded_by_staff_id ?? null,

      name:
        name?.trim() ||
        file.name,

      document_type:
        document_type?.trim() ||
        null,

      storage_bucket:
        DOCUMENT_BUCKET,

      storage_path:
        storagePath,

      mime_type:
        file.type || null,

      size_bytes:
        file.size,

      version: 1,

      is_confidential,

      description:
        description?.trim() ||
        null,

      uploaded_by:
        authData.user?.id ??
        null,
    };

    return await createDocument(insertData);
  } catch (error) {
    await supabase.storage
      .from(DOCUMENT_BUCKET)
      .remove([storagePath]);

    throw error;
  }
}

export async function createDocumentSignedUrl(
  document: Pick<
    Document,
    'storage_bucket' | 'storage_path'
  >,
  expiresInSeconds = 300,
): Promise<string> {
  const result = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(
      document.storage_path,
      expiresInSeconds,
    );

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data?.signedUrl) {
    throw new Error(
      'Unable to create document link.',
    );
  }

  return result.data.signedUrl;
}

export async function openDocument(
  document: Pick<
    Document,
    'storage_bucket' | 'storage_path'
  >,
): Promise<void> {
  const signedUrl =
    await createDocumentSignedUrl(
      document,
      300,
    );

  window.open(
    signedUrl,
    '_blank',
    'noopener,noreferrer',
  );
}

export async function downloadDocument(
  document: Pick<
    Document,
    'storage_bucket' | 'storage_path' | 'name'
  >,
): Promise<void> {
  const result = await supabase.storage
    .from(document.storage_bucket)
    .download(document.storage_path);

  if (result.error) {
    throw new Error(result.error.message);
  }

  const url =
    URL.createObjectURL(result.data);

  const anchor =
    window.document.createElement('a');

  anchor.href = url;
  anchor.download = document.name;

  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export async function deleteDocument(
  documentOrId: Document | string,
): Promise<void> {
  let document: Document;

  if (
    typeof documentOrId === 'string'
  ) {
    const result = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentOrId)
      .single();

    document = handleError(
      result as SupabaseResult<Document>,
      'Document not found.',
    );
  } else {
    document = documentOrId;
  }

  const storageResult =
    await supabase.storage
      .from(document.storage_bucket)
      .remove([
        document.storage_path,
      ]);

  if (storageResult.error) {
    throw new Error(
      storageResult.error.message,
    );
  }

  const databaseResult = await supabase
    .from('documents')
    .delete()
    .eq('id', document.id);

  if (databaseResult.error) {
    throw new Error(
      databaseResult.error.message,
    );
  }
}

export async function countDocuments(): Promise<number> {
  const result = await supabase
    .from('documents')
    .select('id', {
      count: 'exact',
      head: true,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.count ?? 0;
}
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Document, DocumentInsert, DocumentUpdate } from '../types/document';

function handleError<T>(result: { error: PostgrestError | null; data: T | null; }) {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned from Supabase.');
  return result.data;
}

export async function getDocumentsByCase(caseId: string): Promise<Document[]> {
  const result = await supabase.from('documents').select('*').eq('case_id', caseId).order('uploaded_at', { ascending: false });
  return handleError(result);
}

export async function createDocument(data: DocumentInsert): Promise<Document> {
  const result = await supabase.from('documents').insert(data).select().single();
  return handleError(result);
}

export async function updateDocument(id: string, data: DocumentUpdate): Promise<Document> {
  const result = await supabase.from('documents').update(data).eq('id', id).select().single();
  return handleError(result);
}

export async function deleteDocument(id: string): Promise<void> {
  const result = await supabase.from('documents').delete().eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

export async function countDocuments(): Promise<number> {
  const result = await supabase.from('documents').select('id', { count: 'exact' });
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

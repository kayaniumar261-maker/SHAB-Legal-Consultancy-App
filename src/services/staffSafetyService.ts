import { supabase } from '../lib/supabase';

export type StaffSafetyEntity =
  | 'client'
  | 'case'
  | 'case_note'
  | 'task'
  | 'hearing'
  | 'document';

export async function requestRecordDeletion(
  entityType: StaffSafetyEntity,
  recordId: string,
  reason: string,
): Promise<number> {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 10) {
    throw new Error('Please provide a reason of at least 10 characters.');
  }

  const { data, error } = await supabase.rpc('shab_request_record_deletion', {
    p_entity_type: entityType,
    p_record_id: recordId,
    p_reason: normalizedReason,
  });

  if (error) throw new Error(error.message);
  return Number(data);
}

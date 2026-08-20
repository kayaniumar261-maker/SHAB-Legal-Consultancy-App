import { supabase } from '../lib/supabase';

export type StaffSafetyEntity =
  | 'client'
  | 'case'
  | 'case_note'
  | 'task'
  | 'hearing'
  | 'document';

export type DeletionRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export type StaffDeletionRequest = {
  id: number;
  entity_type: StaffSafetyEntity;
  record_id: string;
  record_snapshot: Record<string, unknown>;
  reason: string;
  status: DeletionRequestStatus;
  requested_by: string;
  requested_by_email: string;
  requested_at: string;
  resolved_by: string | null;
  resolved_by_email: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  completed_at: string | null;
};

export type StaffActivityEntry = {
  id: number;
  entity_type: StaffSafetyEntity;
  record_id: string;
  action: 'created' | 'updated' | 'deleted';
  changed_by_email: string | null;
  changed_by_role: 'administrator' | 'operations_staff' | null;
  requires_admin_attention: boolean;
  reviewed_at: string | null;
  created_at: string;
};

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

export async function listDeletionRequests(
  status: DeletionRequestStatus | 'all' = 'pending',
): Promise<StaffDeletionRequest[]> {
  const { data, error } = await supabase.rpc(
    'shab_admin_list_deletion_requests',
    {
      p_status: status === 'all' ? null : status,
      p_limit: 100,
    },
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffDeletionRequest[];
}

export async function resolveDeletionRequest(
  requestId: number,
  approve: boolean,
  note: string,
): Promise<void> {
  const normalizedNote = note.trim();
  if (normalizedNote.length < 3) {
    throw new Error('Please provide an administrator note of at least 3 characters.');
  }
  const { error } = await supabase.rpc(
    'shab_admin_resolve_deletion_request',
    {
      p_request_id: requestId,
      p_approve: approve,
      p_resolution_note: normalizedNote,
    },
  );
  if (error) throw new Error(error.message);
}

export async function markDeletionCompleted(requestId: number): Promise<void> {
  const { error } = await supabase.rpc(
    'shab_admin_mark_deletion_completed',
    { p_request_id: requestId },
  );
  if (error) throw new Error(error.message);
}

export async function listStaffActivity(
  attentionOnly = true,
): Promise<StaffActivityEntry[]> {
  const { data, error } = await supabase.rpc(
    'shab_admin_list_staff_activity',
    { p_attention_only: attentionOnly, p_limit: 100 },
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffActivityEntry[];
}

export async function markStaffActivityReviewed(activityId: number): Promise<void> {
  const { error } = await supabase.rpc(
    'shab_admin_mark_staff_activity_reviewed',
    { p_activity_id: activityId },
  );
  if (error) throw new Error(error.message);
}

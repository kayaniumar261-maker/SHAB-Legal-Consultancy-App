import { supabase } from '../lib/supabase';

export interface StaffWorkloadSummary {
  cases: number;
  tasks: number;
  hearings: number;
  documents: number;
}

function getCount(
  result: {
    count: number | null;
    error: { message: string } | null;
  },
): number {
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.count ?? 0;
}

export async function getStaffWorkloadSummary(
  staffId: string,
): Promise<StaffWorkloadSummary> {
  const [
    casesResult,
    tasksResult,
    hearingsResult,
    documentsResult,
  ] = await Promise.all([
    supabase
      .from('cases')
      .select('id', {
        head: true,
        count: 'exact',
      })
      .or(
        [
          `assigned_staff_id.eq.${staffId}`,
          `responsible_lawyer_id.eq.${staffId}`,
          `case_manager_id.eq.${staffId}`,
          `legal_assistant_id.eq.${staffId}`,
        ].join(','),
      ),

    supabase
      .from('tasks')
      .select('id', {
        head: true,
        count: 'exact',
      })
      .eq(
        'assigned_staff_id',
        staffId,
      ),

    supabase
      .from('hearings')
      .select('id', {
        head: true,
        count: 'exact',
      })
      .eq(
        'assigned_staff_id',
        staffId,
      ),

    supabase
      .from('documents')
      .select('id', {
        head: true,
        count: 'exact',
      })
      .eq(
        'uploaded_by_staff_id',
        staffId,
      ),
  ]);

  return {
    cases: getCount(casesResult),
    tasks: getCount(tasksResult),
    hearings: getCount(hearingsResult),
    documents: getCount(documentsResult),
  };
}

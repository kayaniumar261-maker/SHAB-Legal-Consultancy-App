import { supabase } from '../lib/supabase';

export type CaseDistributionItem = {
  status: string;
  count: number;
  percentage: number;
};

export async function getCaseDistribution(): Promise<
  CaseDistributionItem[]
> {
  const { data, error } = await supabase
    .from('cases')
    .select('status')
    .eq('is_archived', false);

  if (error) {
    throw new Error(error.message);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    const status =
      typeof row.status === 'string' && row.status.trim()
        ? row.status.trim().toLowerCase()
        : 'unknown';

    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  return Array.from(counts.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage:
        total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
import { supabase } from '../lib/supabase';

export type MonthlyRevenue = {
  month: string;
  revenue: number;
};

export async function getRevenueLast6Months(): Promise<MonthlyRevenue[]> {
  const now = new Date();

  const months: MonthlyRevenue[] = [];

  for (let i = 5; i >= 0; i--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1,
    );

    const start = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
    );

    const end = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      1,
    );

    const { data, error } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('payment_date', start.toISOString())
      .lt('payment_date', end.toISOString());

    if (error) {
      throw new Error(error.message);
    }

    const revenue =
      data?.reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0,
      ) ?? 0;

    months.push({
      month: start.toLocaleString('en', {
        month: 'short',
      }),
      revenue,
    });
  }

  return months;
}
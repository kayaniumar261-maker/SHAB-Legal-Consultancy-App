type PageResult<T> = { data: T[] | null; error: { message: string } | null };
type PageQuery<T> = { range(from: number, to: number): PromiseLike<PageResult<T>> };

/** Read complete datasets for totals. Callers must order by a unique key. */
export async function readAllRows<T>(buildQuery: () => PageQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const result = await buildQuery().range(rows.length, rows.length + 499);
    if (result.error) throw new Error(result.error.message);
    if (result.data === null) throw new Error('No data returned from Supabase.');
    if (result.data.length === 0) return rows;
    rows.push(...result.data);
  }
}

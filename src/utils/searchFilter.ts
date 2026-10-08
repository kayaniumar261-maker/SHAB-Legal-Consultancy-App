/** Quote a literal contains-pattern for PostgREST's .or() grammar. */
export function containsFilterValue(value: string): string {
  const pattern = `%${value.trim()
    .replace(/\\/g, '\\\\')
    .replace(/[%_]/g, (character) => `\\${character}`)
    .replace(/\*/g, ' ')}%`;
  return `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

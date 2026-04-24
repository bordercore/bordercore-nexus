/** Append "s" to ``word`` when ``count`` is anything other than 1. */
export function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

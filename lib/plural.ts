/**
 * Согласование существительного с числительным по правилам русского языка.
 *
 * Формы передаются в порядке: 1 вопрос, 2 вопроса, 5 вопросов.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100
  const last = abs % 10

  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

/** «5 вопросов», «21 вопрос», «22 вопроса». */
export function pluralize(count: number, one: string, few: string, many: string): string {
  return `${count} ${plural(count, one, few, many)}`
}

/**
 * Разовый инструмент: перемешивает варианты у вопросов, где верный ответ ещё
 * стоит первым, и раскладывает позиции равномерно по всему набору.
 *
 * Запускать после добавления новой партии вопросов:
 *   npx tsx scripts/shuffle-answers.ts
 *
 * Перестановка выводится из id вопроса, поэтому повторный запуск даёт тот же
 * результат, а diff в git остаётся читаемым. Вопросы, чьи разборы ссылаются на
 * варианты по номеру (`**(2)**`), пропускаются: их перестановка сломала бы
 * ссылки. Новые разборы ссылаются на варианты по содержанию и такого
 * ограничения не имеют.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { QuestionFileSchema, type Question } from '../lib/question'

const SOURCE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'questions')
const LETTERS = 'abcd'
const POSITIONS = [1, 2, 3, 4] as const

/** Детерминированная перестановка, выведенная из id вопроса. */
function deterministicOrder(seed: string, size: number): number[] {
  const digest = createHash('md5').update(seed).digest()
  const pool = Array.from({ length: size }, (_, i) => i)
  const order: number[] = []
  for (let i = 0; i < size; i += 1) {
    const [picked] = pool.splice(digest[i % digest.length]! % pool.length, 1)
    order.push(picked!)
  }
  return order
}

function correctPosition(question: Question): number {
  return question.options.findIndex((o) => o.id === question.correctOptionId) + 1
}

/**
 * Разбор ссылается на варианты по номеру — переставлять такой вопрос нельзя.
 * Проверять надо все части разбора: после разделения explanation на поля
 * ссылки переехали в distractors, и проверка только по explanation однажды
 * уже пропустила их, из-за чего перестановка разъехалась со ссылками.
 */
function referencesPositions(question: Question): boolean {
  const parts = [question.explanation, ...question.distractors, question.footnote ?? '']
  return parts.some((part) => /\*\*\(\d\)\*\*/.test(part))
}

const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.json')).sort()
const loaded = new Map<string, Question[]>()
for (const file of files) {
  loaded.set(file, QuestionFileSchema.parse(JSON.parse(await readFile(join(SOURCE_DIR, file), 'utf8'))))
}

const all = [...loaded.values()].flat()
const locked = all.filter(referencesPositions)
const movable = all.filter((q) => !referencesPositions(q))

const counts = new Map<number, number>(POSITIONS.map((p) => [p, 0]))
for (const question of locked) {
  counts.set(correctPosition(question), (counts.get(correctPosition(question)) ?? 0) + 1)
}

// Каждому переставляемому вопросу достаётся самая недобранная позиция.
const plan = new Map<string, number>()
for (const question of [...movable].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  const target = POSITIONS.reduce((best, p) =>
    (counts.get(p) ?? 0) < (counts.get(best) ?? 0) ? p : best,
  )
  plan.set(question.id, target)
  counts.set(target, (counts.get(target) ?? 0) + 1)
}

let moved = 0
for (const [file, questions] of loaded) {
  let touched = false
  for (const question of questions) {
    const target = plan.get(question.id)
    if (target === undefined) continue

    const correct = question.options.find((o) => o.id === question.correctOptionId)!
    const rest = question.options.filter((o) => o.id !== question.correctOptionId)
    const order = deterministicOrder(question.id, rest.length)
    const shuffled = order.map((i) => rest[i]!)

    const reordered = [...shuffled.slice(0, target - 1), correct, ...shuffled.slice(target - 1)]
    question.options = reordered.map((option, i) => ({ ...option, id: LETTERS[i]! }))
    question.correctOptionId = LETTERS[target - 1]!
    touched = true
    moved += 1
  }
  if (touched) {
    await writeFile(join(SOURCE_DIR, file), `${JSON.stringify(questions, null, 2)}\n`, 'utf8')
  }
}

const final = new Map<number, number>(POSITIONS.map((p) => [p, 0]))
for (const questions of loaded.values()) {
  for (const question of questions) {
    final.set(correctPosition(question), (final.get(correctPosition(question)) ?? 0) + 1)
  }
}

const summary = POSITIONS.map((p) => `${p}:${final.get(p) ?? 0}`).join(' ')
console.log(`✓ Переставлено вопросов: ${moved}. Позиции верных ответов — ${summary}`)

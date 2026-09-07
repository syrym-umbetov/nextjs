import * as z from 'zod'
import { MIN_EASE_FACTOR, type CardState } from './srs'

/**
 * Форма прогресса, который лежит в localStorage.
 *
 * Схема версионирована: при несовпадении `version` (или при любой другой
 * поломке) обёртка над хранилищем начинает с чистого листа, а не падает.
 * SM-2-состояние и счётчики показов разведены, чтобы `review()` из lib/srs.ts
 * работал ровно со своим типом и ничего лишнего не знал.
 */

export const PROGRESS_VERSION = 1
export const STORAGE_KEY = 'nextjs-docs-trainer:progress:v1'

const DayStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const CardStateSchema = z.object({
  easeFactor: z.number().min(MIN_EASE_FACTOR).max(10),
  interval: z.int().min(0),
  repetitions: z.int().min(0),
  dueDate: DayStringSchema,
}) satisfies z.ZodType<CardState>

export const QuestionStatsSchema = z
  .object({
    seen: z.int().min(0),
    correct: z.int().min(0),
    lastAnsweredAt: DayStringSchema,
  })
  .refine((s) => s.correct <= s.seen, {
    message: 'correct не может превышать seen',
    path: ['correct'],
  })
export type QuestionStats = z.infer<typeof QuestionStatsSchema>

export const ProgressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  cards: z.record(z.string(), CardStateSchema),
  stats: z.record(z.string(), QuestionStatsSchema),
})
export type Progress = z.infer<typeof ProgressSchema>

export function emptyProgress(): Progress {
  return { version: PROGRESS_VERSION, cards: {}, stats: {} }
}

/**
 * Разбор произвольного значения из хранилища. Никогда не бросает: любой мусор
 * (чужой ключ, старая версия, обрезанный JSON) превращается в пустой прогресс.
 */
export function parseProgress(value: unknown): Progress {
  const parsed = ProgressSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyProgress()
}

/** Сводка по теме для главной страницы. */
export interface TopicSummary {
  readonly answered: number
  readonly total: number
  readonly correctRate: number | null
  readonly due: number
}

export function summarize(
  progress: Progress,
  questionIds: readonly string[],
  isDueToday: (card: CardState) => boolean,
): TopicSummary {
  let answered = 0
  let seen = 0
  let correct = 0
  let due = 0

  for (const id of questionIds) {
    const stat = progress.stats[id]
    if (stat) {
      answered += 1
      seen += stat.seen
      correct += stat.correct
    }
    const card = progress.cards[id]
    if (card === undefined || isDueToday(card)) {
      due += 1
    }
  }

  return {
    answered,
    total: questionIds.length,
    correctRate: seen === 0 ? null : correct / seen,
    due,
  }
}

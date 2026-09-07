/**
 * Подбор вопросов на сессию. Как и SRS, модуль состоит из чистых функций:
 * состояние и текущий день приходят параметрами, порядок результата
 * детерминирован — одни и те же входные данные всегда дают одну и ту же сессию.
 */
import type { QuestionIndexEntry, Topic } from './question'
import { diffInDays, isDue, type CardState } from './srs'

export const SESSION_SIZE = 10

export interface SelectSessionInput {
  /** Лёгкий индекс всех вопросов: { id, topic, difficulty }. */
  readonly index: readonly QuestionIndexEntry[]
  /** Сохранённый прогресс по id вопроса. Отсутствие записи = вопрос новый. */
  readonly cards: Readonly<Record<string, CardState>>
  /** Сегодняшний день, `YYYY-MM-DD`. */
  readonly today: string
  /** Ограничить сессию одной темой. По умолчанию берутся все темы. */
  readonly topic?: Topic
  readonly size?: number
}

/**
 * Сначала берутся просроченные карточки (самые давние — первыми), затем добор
 * новыми вопросами от простых к сложным, пока не наберётся `size`.
 *
 * Если карточек к повторению больше лимита, новые не добавляются вовсе:
 * долги важнее нового материала.
 */
export function selectSession(input: SelectSessionInput): QuestionIndexEntry[] {
  const { index, cards, today, topic, size = SESSION_SIZE } = input
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError(`Размер сессии должен быть целым неотрицательным, получено: ${size}`)
  }

  const pool = topic ? index.filter((entry) => entry.topic === topic) : [...index]

  const due: QuestionIndexEntry[] = []
  const fresh: QuestionIndexEntry[] = []
  for (const entry of pool) {
    const card = cards[entry.id]
    if (card === undefined) {
      fresh.push(entry)
    } else if (isDue(card, today)) {
      due.push(entry)
    }
  }

  // Просроченные: сначала те, что ждут дольше всех; при равном сроке —
  // от простых к сложным, дальше по id ради устойчивого порядка.
  due.sort((a, b) => {
    const overdueA = diffInDays(today, cards[a.id]!.dueDate)
    const overdueB = diffInDays(today, cards[b.id]!.dueDate)
    if (overdueA !== overdueB) return overdueB - overdueA
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
    return a.id < b.id ? -1 : 1
  })

  // Новые: от простых к сложным.
  fresh.sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
    return a.id < b.id ? -1 : 1
  })

  return [...due, ...fresh].slice(0, size)
}

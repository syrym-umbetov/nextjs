/**
 * Интервальное повторение по алгоритму SM-2 (SuperMemo 2).
 *
 * Модуль намеренно состоит только из чистых функций: ни обращений к
 * localStorage, ни чтения системных часов, ни мутаций аргументов. Всё, что
 * зависит от «сейчас», передаётся параметром `today`. Благодаря этому модуль
 * полностью покрывается тестами без моков.
 */

/** Оценка ответа по шкале SM-2: 0 — полный провал, 5 — мгновенный точный ответ. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5

export interface CardState {
  /** Коэффициент лёгкости. Стартует с 2.5 и не опускается ниже 1.3. */
  readonly easeFactor: number
  /** Текущий интервал в днях. */
  readonly interval: number
  /** Число успешных повторений подряд. Ошибка сбрасывает счётчик в 0. */
  readonly repetitions: number
  /** Дата следующего показа, `YYYY-MM-DD` в UTC. */
  readonly dueDate: string
}

export const DEFAULT_EASE_FACTOR = 2.5
export const MIN_EASE_FACTOR = 1.3
/** Оценка ниже этого порога считается ошибкой и сбрасывает интервал. */
export const PASSING_GRADE: Grade = 3

const DAY_MS = 86_400_000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Приводит `Date` к строке дня `YYYY-MM-DD` в UTC. */
export function toDayString(date: Date): string {
  const iso = date.toISOString()
  return iso.slice(0, 10)
}

function dayToMs(day: string): number {
  if (!DAY_PATTERN.test(day)) {
    throw new RangeError(`Ожидалась дата вида YYYY-MM-DD, получено: ${JSON.stringify(day)}`)
  }
  const ms = Date.parse(`${day}T00:00:00.000Z`)
  if (Number.isNaN(ms)) {
    throw new RangeError(`Невалидная дата: ${day}`)
  }
  return ms
}

/** Прибавляет дни к дню-строке. Отрицательное значение отматывает назад. */
export function addDays(day: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new RangeError(`Ожидалось целое число дней, получено: ${days}`)
  }
  return toDayString(new Date(dayToMs(day) + days * DAY_MS))
}

/** Разница `a - b` в днях. */
export function diffInDays(a: string, b: string): number {
  return Math.round((dayToMs(a) - dayToMs(b)) / DAY_MS)
}

/** Карточка готова к показу, если её срок наступил или уже прошёл. */
export function isDue(state: CardState, today: string): boolean {
  return dayToMs(state.dueDate) <= dayToMs(today)
}

/** Состояние вопроса, который ещё ни разу не показывали: доступен сразу. */
export function createInitialCardState(today: string): CardState {
  dayToMs(today) // валидация формата даты
  return {
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    dueDate: today,
  }
}

/**
 * Пересчёт коэффициента лёгкости по формуле SM-2:
 *
 *   EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
 *
 * Как и в оригинальном SM-2, коэффициент пересчитывается при любой оценке,
 * а не только при успешной, и никогда не опускается ниже 1.3.
 */
export function nextEaseFactor(easeFactor: number, grade: Grade): number {
  const q = grade
  const next = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  return Math.max(MIN_EASE_FACTOR, next)
}

/**
 * Один шаг SM-2. Возвращает новое состояние карточки, не трогая исходное.
 *
 * При оценке ниже `PASSING_GRADE` серия повторений обнуляется, а интервал
 * сбрасывается на 1 день — карточка вернётся уже завтра. Коэффициент
 * лёгкости при этом сохраняется (с учётом штрафа), поэтому «выученная»
 * карточка после единичной ошибки восстанавливает длинные интервалы быстрее,
 * чем совсем новая.
 */
export function review(state: CardState, grade: Grade, today: string): CardState {
  if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
    throw new RangeError(`Оценка должна быть целым числом от 0 до 5, получено: ${grade}`)
  }

  const easeFactor = nextEaseFactor(state.easeFactor, grade)

  if (grade < PASSING_GRADE) {
    return { easeFactor, interval: 1, repetitions: 0, dueDate: addDays(today, 1) }
  }

  const repetitions = state.repetitions + 1
  let interval: number
  if (state.repetitions === 0) {
    interval = 1
  } else if (state.repetitions === 1) {
    interval = 6
  } else {
    interval = Math.round(state.interval * state.easeFactor)
  }
  // Защита от вырожденного случая: интервал 0 дней зациклил бы карточку.
  interval = Math.max(1, interval)

  return { easeFactor, interval, repetitions, dueDate: addDays(today, interval) }
}

/**
 * Перевод ответа интерфейса в оценку SM-2.
 *
 * В интерфейсе есть только «верно / неверно», поэтому шкала 0–5 достраивается
 * временем ответа: быстрый верный ответ означает уверенное знание, долгий —
 * припоминание с усилием.
 */
export function gradeFromAnswer(isCorrect: boolean, responseMs: number): Grade {
  if (!isCorrect) {
    return 1
  }
  if (responseMs <= 8_000) {
    return 5
  }
  if (responseMs <= 20_000) {
    return 4
  }
  return 3
}

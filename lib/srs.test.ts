import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
  addDays,
  createInitialCardState,
  diffInDays,
  gradeFromAnswer,
  isDue,
  nextEaseFactor,
  review,
  toDayString,
  type CardState,
  type Grade,
} from './srs'

const TODAY = '2026-09-07'

function correctStreak(times: number, from = createInitialCardState(TODAY)): CardState {
  let state = from
  let day = TODAY
  for (let i = 0; i < times; i += 1) {
    state = review(state, 5, day)
    day = state.dueDate
  }
  return state
}

describe('работа с датами', () => {
  it('переводит Date в день UTC', () => {
    expect(toDayString(new Date('2026-09-07T23:59:59.999Z'))).toBe('2026-09-07')
  })

  it('прибавляет дни через границу месяца и года', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('переживает переход на летнее время', () => {
    // Ночь перевода часов в Европе: в локальном времени в сутках 23 часа,
    // но расчёт идёт в UTC, поэтому день сдвигается ровно на один.
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(diffInDays('2026-03-30', '2026-03-29')).toBe(1)
  })

  it('отвергает некорректный формат даты', () => {
    expect(() => addDays('07.09.2026', 1)).toThrow(RangeError)
    expect(() => addDays('2026-9-7', 1)).toThrow(RangeError)
  })
})

describe('createInitialCardState', () => {
  it('делает новый вопрос доступным сразу', () => {
    const state = createInitialCardState(TODAY)
    expect(state).toEqual({
      easeFactor: DEFAULT_EASE_FACTOR,
      interval: 0,
      repetitions: 0,
      dueDate: TODAY,
    })
    expect(isDue(state, TODAY)).toBe(true)
  })
})

describe('review: первый ответ', () => {
  it('верный первый ответ даёт интервал 1 день', () => {
    const state = review(createInitialCardState(TODAY), 5, TODAY)
    expect(state.repetitions).toBe(1)
    expect(state.interval).toBe(1)
    expect(state.dueDate).toBe('2026-09-08')
  })

  it('верный первый ответ поднимает easeFactor при оценке 5', () => {
    const state = review(createInitialCardState(TODAY), 5, TODAY)
    expect(state.easeFactor).toBeCloseTo(2.6, 10)
  })

  it('оценка 3 на первом ответе понижает easeFactor, но интервал всё равно 1', () => {
    const state = review(createInitialCardState(TODAY), 3, TODAY)
    expect(state.interval).toBe(1)
    expect(state.repetitions).toBe(1)
    expect(state.easeFactor).toBeCloseTo(2.36, 10)
  })

  it('неверный первый ответ оставляет карточку на завтра', () => {
    const state = review(createInitialCardState(TODAY), 1, TODAY)
    expect(state.repetitions).toBe(0)
    expect(state.interval).toBe(1)
    expect(state.dueDate).toBe('2026-09-08')
  })
})

describe('review: классическая лестница SM-2', () => {
  it('идёт по интервалам 1 → 6 → округление interval × easeFactor', () => {
    const first = review(createInitialCardState(TODAY), 4, TODAY)
    expect(first.interval).toBe(1)

    const second = review(first, 4, first.dueDate)
    expect(second.interval).toBe(6)

    const third = review(second, 4, second.dueDate)
    // easeFactor после двух оценок «4» остаётся 2.5
    expect(second.easeFactor).toBeCloseTo(2.5, 10)
    expect(third.interval).toBe(15) // round(6 × 2.5)
    expect(third.repetitions).toBe(3)
  })

  it('на третьем повторении берёт easeFactor из состояния ДО ответа', () => {
    // Ловушка реализации: если взять новый easeFactor, интервал уедет.
    const state: CardState = {
      easeFactor: 2.0,
      interval: 10,
      repetitions: 4,
      dueDate: TODAY,
    }
    const next = review(state, 5, TODAY)
    expect(next.interval).toBe(20) // round(10 × 2.0), а не 10 × 2.1
    expect(next.easeFactor).toBeCloseTo(2.1, 10)
  })

  it('интервал монотонно растёт при стабильно верных ответах', () => {
    let state = createInitialCardState(TODAY)
    let day = TODAY
    const intervals: number[] = []
    for (let i = 0; i < 6; i += 1) {
      state = review(state, 5, day)
      day = state.dueDate
      intervals.push(state.interval)
    }
    expect(intervals).toEqual([1, 6, 16, 45, 131, 393])
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!)
    }
  })
})

describe('review: серия ошибок', () => {
  it('каждая ошибка сбрасывает интервал и серию повторений', () => {
    let state = correctStreak(4)
    expect(state.interval).toBeGreaterThan(6)

    const beforeEase = state.easeFactor
    state = review(state, 1, state.dueDate)
    expect(state.repetitions).toBe(0)
    expect(state.interval).toBe(1)
    expect(state.easeFactor).toBeLessThan(beforeEase)
  })

  it('после сброса лестница начинается заново с 1 → 6', () => {
    let state = correctStreak(4)
    state = review(state, 0, state.dueDate)
    expect(state.interval).toBe(1)

    state = review(state, 5, state.dueDate)
    expect(state.interval).toBe(1)
    expect(state.repetitions).toBe(1)

    state = review(state, 5, state.dueDate)
    expect(state.interval).toBe(6)
    expect(state.repetitions).toBe(2)
  })

  it('серия провалов упирает easeFactor в пол 1.3 и не проваливает ниже', () => {
    let state = createInitialCardState(TODAY)
    for (let i = 0; i < 20; i += 1) {
      state = review(state, 0, state.dueDate)
    }
    expect(state.easeFactor).toBe(MIN_EASE_FACTOR)
    expect(state.interval).toBe(1)
    expect(state.repetitions).toBe(0)
  })

  it('сохраняет наработанный easeFactor: восстановление быстрее, чем у новой карточки', () => {
    const experienced = review(correctStreak(5), 1, '2026-11-01')
    const fresh = review(createInitialCardState('2026-11-01'), 1, '2026-11-01')
    expect(experienced.easeFactor).toBeGreaterThan(fresh.easeFactor)
    // Обе карточки вернутся завтра, но дальше «опытная» разгонится быстрее.
    expect(experienced.dueDate).toBe(fresh.dueDate)

    const experiencedNext = review(review(experienced, 5, '2026-11-02'), 5, '2026-11-03')
    const freshNext = review(review(fresh, 5, '2026-11-02'), 5, '2026-11-03')
    expect(review(experiencedNext, 5, experiencedNext.dueDate).interval).toBeGreaterThan(
      review(freshNext, 5, freshNext.dueDate).interval,
    )
  })
})

describe('nextEaseFactor', () => {
  it.each<[Grade, number]>([
    [5, 0.1],
    [4, 0],
    [3, -0.14],
    [2, -0.32],
    [1, -0.54],
    [0, -0.8],
  ])('оценка %i сдвигает easeFactor на %f', (grade, delta) => {
    expect(nextEaseFactor(2.5, grade)).toBeCloseTo(Math.max(MIN_EASE_FACTOR, 2.5 + delta), 10)
  })

  it('никогда не опускается ниже 1.3', () => {
    expect(nextEaseFactor(1.3, 0)).toBe(MIN_EASE_FACTOR)
    expect(nextEaseFactor(1.31, 0)).toBe(MIN_EASE_FACTOR)
  })

  it('не имеет верхнего предела', () => {
    expect(nextEaseFactor(3.5, 5)).toBeCloseTo(3.6, 10)
  })
})

describe('review: контракт функции', () => {
  it('не мутирует переданное состояние', () => {
    const state = createInitialCardState(TODAY)
    const snapshot = { ...state }
    review(state, 5, TODAY)
    expect(state).toEqual(snapshot)
  })

  it('отвергает оценку вне диапазона 0–5', () => {
    const state = createInitialCardState(TODAY)
    expect(() => review(state, 6 as Grade, TODAY)).toThrow(RangeError)
    expect(() => review(state, -1 as Grade, TODAY)).toThrow(RangeError)
    expect(() => review(state, 2.5 as Grade, TODAY)).toThrow(RangeError)
  })

  it('считает срок от переданного дня, а не от прошлого dueDate', () => {
    // Карточку просрочили на месяц — новый срок отсчитывается от сегодня.
    const overdue: CardState = {
      easeFactor: 2.5,
      interval: 6,
      repetitions: 2,
      dueDate: '2026-08-01',
    }
    const next = review(overdue, 4, TODAY)
    expect(next.interval).toBe(15)
    expect(next.dueDate).toBe(addDays(TODAY, 15))
  })

  it('никогда не назначает интервал меньше одного дня', () => {
    const degenerate: CardState = {
      easeFactor: MIN_EASE_FACTOR,
      interval: 0,
      repetitions: 9,
      dueDate: TODAY,
    }
    const next = review(degenerate, 5, TODAY)
    expect(next.interval).toBe(1)
    expect(next.dueDate).toBe(addDays(TODAY, 1))
  })
})

describe('isDue', () => {
  it('срок сегодня или в прошлом — пора показывать', () => {
    expect(isDue({ ...createInitialCardState(TODAY), dueDate: TODAY }, TODAY)).toBe(true)
    expect(isDue({ ...createInitialCardState(TODAY), dueDate: '2026-01-01' }, TODAY)).toBe(true)
  })

  it('срок в будущем — рано', () => {
    expect(isDue({ ...createInitialCardState(TODAY), dueDate: '2026-09-08' }, TODAY)).toBe(false)
  })
})

describe('gradeFromAnswer', () => {
  it('неверный ответ всегда ниже проходного балла', () => {
    expect(gradeFromAnswer(false, 500)).toBe(1)
    expect(gradeFromAnswer(false, 120_000)).toBe(1)
  })

  it('верный ответ оценивается по времени размышления', () => {
    expect(gradeFromAnswer(true, 3_000)).toBe(5)
    expect(gradeFromAnswer(true, 8_000)).toBe(5)
    expect(gradeFromAnswer(true, 8_001)).toBe(4)
    expect(gradeFromAnswer(true, 20_000)).toBe(4)
    expect(gradeFromAnswer(true, 20_001)).toBe(3)
  })

  it('любой верный ответ проходит порог и продвигает карточку', () => {
    for (const ms of [0, 9_000, 60_000]) {
      const state = review(createInitialCardState(TODAY), gradeFromAnswer(true, ms), TODAY)
      expect(state.repetitions).toBe(1)
    }
  })
})

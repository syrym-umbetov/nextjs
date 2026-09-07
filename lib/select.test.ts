import { describe, expect, it } from 'vitest'
import type { QuestionIndexEntry } from './question'
import { SESSION_SIZE, selectSession } from './select'
import { createInitialCardState, type CardState } from './srs'

const TODAY = '2026-09-07'

function entry(id: string, difficulty: 1 | 2 | 3 = 1, topic: QuestionIndexEntry['topic'] = 'caching'): QuestionIndexEntry {
  return { id, topic, difficulty }
}

function card(dueDate: string): CardState {
  return { ...createInitialCardState(TODAY), dueDate, repetitions: 1, interval: 1 }
}

const index: QuestionIndexEntry[] = Array.from({ length: 14 }, (_, i) =>
  entry(`q${String(i + 1).padStart(2, '0')}`, ((i % 3) + 1) as 1 | 2 | 3),
)

describe('selectSession', () => {
  it('на чистом прогрессе берёт 10 новых вопросов от простых к сложным', () => {
    const picked = selectSession({ index, cards: {}, today: TODAY })
    expect(picked).toHaveLength(SESSION_SIZE)
    const difficulties = picked.map((q) => q.difficulty)
    expect([...difficulties].sort((a, b) => a - b)).toEqual(difficulties)
    expect(difficulties[0]).toBe(1)
  })

  it('отдаёт меньше 10, если вопросов в базе меньше', () => {
    const picked = selectSession({ index: index.slice(0, 4), cards: {}, today: TODAY })
    expect(picked).toHaveLength(4)
  })

  it('берёт вопросы со сроком сегодня и раньше, пропуская будущие', () => {
    const cards = {
      q01: card('2026-09-01'), // просрочен
      q02: card(TODAY), // ровно сегодня
      q03: card('2026-12-01'), // ещё рано
    }
    const picked = selectSession({ index: index.slice(0, 3), cards, today: TODAY })
    expect(picked.map((q) => q.id)).toEqual(['q01', 'q02'])
  })

  it('добирает новыми, когда к повторению меньше 10', () => {
    const cards = { q01: card('2026-09-01'), q02: card('2026-09-05') }
    const picked = selectSession({ index, cards, today: TODAY })
    expect(picked).toHaveLength(SESSION_SIZE)
    expect(picked.slice(0, 2).map((q) => q.id)).toEqual(['q01', 'q02'])
    expect(picked.slice(2).every((q) => cards[q.id as 'q01'] === undefined)).toBe(true)
  })

  it('при переполнении долгами не добавляет новые вопросы вовсе', () => {
    const cards: Record<string, CardState> = {}
    for (const item of index) {
      cards[item.id] = card('2026-08-01')
    }
    const picked = selectSession({ index, cards, today: TODAY })
    expect(picked).toHaveLength(SESSION_SIZE)
    expect(picked.every((q) => cards[q.id] !== undefined)).toBe(true)
  })

  it('самые давно просроченные идут первыми', () => {
    const cards = {
      q01: card('2026-09-06'),
      q02: card('2026-06-01'),
      q03: card('2026-08-15'),
    }
    const picked = selectSession({ index: index.slice(0, 3), cards, today: TODAY })
    expect(picked.map((q) => q.id)).toEqual(['q02', 'q03', 'q01'])
  })

  it('фильтрует по теме', () => {
    const mixed = [
      entry('r1', 1, 'rendering'),
      entry('c1', 1, 'caching'),
      entry('r2', 2, 'rendering'),
    ]
    const picked = selectSession({ index: mixed, cards: {}, today: TODAY, topic: 'rendering' })
    expect(picked.map((q) => q.id)).toEqual(['r1', 'r2'])
  })

  it('возвращает пустой список, если в теме нет вопросов', () => {
    expect(selectSession({ index, cards: {}, today: TODAY, topic: 'data-fetching' })).toEqual([])
  })

  it('детерминирован: два вызова с теми же данными дают тот же порядок', () => {
    const cards = { q05: card('2026-09-01'), q07: card('2026-09-01') }
    const a = selectSession({ index, cards, today: TODAY })
    const b = selectSession({ index, cards, today: TODAY })
    expect(a).toEqual(b)
  })

  it('не мутирует переданный индекс', () => {
    const snapshot = index.map((q) => q.id)
    selectSession({ index, cards: {}, today: TODAY })
    expect(index.map((q) => q.id)).toEqual(snapshot)
  })

  it('уважает пользовательский размер сессии и отвергает мусорный', () => {
    expect(selectSession({ index, cards: {}, today: TODAY, size: 3 })).toHaveLength(3)
    expect(selectSession({ index, cards: {}, today: TODAY, size: 0 })).toEqual([])
    expect(() => selectSession({ index, cards: {}, today: TODAY, size: -1 })).toThrow(RangeError)
  })
})

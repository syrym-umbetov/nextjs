import { describe, expect, it } from 'vitest'
import type { RenderedQuestion } from './question'
import {
  currentQuestion,
  initialSessionState,
  isRevealed,
  sessionReducer,
  summarizeSession,
  type SessionState,
} from './session'

function question(id: string, correctOptionId = 'a'): RenderedQuestion {
  return {
    id,
    topic: 'caching',
    difficulty: 1,
    type: 'multiple-choice',
    prompt: `prompt ${id}`,
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correctOptionId,
    explanation: 'explanation',
    docsUrl: 'https://nextjs.org/docs/app',
    nextVersion: '16.3',
  }
}

function loaded(ids: string[]): SessionState {
  return sessionReducer(initialSessionState, { type: 'loaded', questions: ids.map((id) => question(id)) })
}

describe('sessionReducer', () => {
  it('пустая выборка переводит сессию в состояние empty', () => {
    expect(sessionReducer(initialSessionState, { type: 'loaded', questions: [] }).status).toBe('empty')
  })

  it('ошибка загрузки сохраняет сообщение', () => {
    const state = sessionReducer(initialSessionState, { type: 'failed', message: 'сеть' })
    expect(state.status).toBe('error')
    expect(state.errorMessage).toBe('сеть')
  })

  it('ответ показывает разбор и записывает результат', () => {
    const state = sessionReducer(loaded(['q1', 'q2']), { type: 'answer', optionId: 'a', responseMs: 1200 })
    expect(isRevealed(state)).toBe(true)
    expect(state.answers).toEqual([
      { questionId: 'q1', selectedOptionId: 'a', isCorrect: true, responseMs: 1200 },
    ])
  })

  it('неверный ответ помечается как неверный', () => {
    const state = sessionReducer(loaded(['q1']), { type: 'answer', optionId: 'b', responseMs: 5000 })
    expect(state.answers[0]!.isCorrect).toBe(false)
  })

  it('повторный ответ на тот же вопрос игнорируется', () => {
    const answered = sessionReducer(loaded(['q1']), { type: 'answer', optionId: 'b', responseMs: 100 })
    const again = sessionReducer(answered, { type: 'answer', optionId: 'a', responseMs: 100 })
    expect(again).toBe(answered)
    expect(again.answers).toHaveLength(1)
  })

  it('несуществующий вариант не меняет состояние', () => {
    const state = loaded(['q1'])
    expect(sessionReducer(state, { type: 'answer', optionId: 'zzz', responseMs: 100 })).toBe(state)
  })

  it('«дальше» без ответа не работает — вопрос нельзя пропустить', () => {
    const state = loaded(['q1', 'q2'])
    expect(sessionReducer(state, { type: 'next' })).toBe(state)
  })

  it('«дальше» переводит на следующий вопрос и прячет разбор', () => {
    let state = loaded(['q1', 'q2'])
    state = sessionReducer(state, { type: 'answer', optionId: 'a', responseMs: 100 })
    state = sessionReducer(state, { type: 'next' })
    expect(currentQuestion(state)?.id).toBe('q2')
    expect(isRevealed(state)).toBe(false)
  })

  it('«дальше» на последнем вопросе показывает итоги', () => {
    let state = loaded(['q1'])
    state = sessionReducer(state, { type: 'answer', optionId: 'a', responseMs: 100 })
    state = sessionReducer(state, { type: 'next' })
    expect(state.status).toBe('summary')
    expect(sessionReducer(state, { type: 'next' })).toBe(state)
  })

  it('отрицательное время ответа нормализуется в ноль', () => {
    const state = sessionReducer(loaded(['q1']), { type: 'answer', optionId: 'a', responseMs: -50 })
    expect(state.answers[0]!.responseMs).toBe(0)
  })

  it('restart возвращает к исходному состоянию', () => {
    const state = sessionReducer(loaded(['q1']), { type: 'answer', optionId: 'a', responseMs: 1 })
    expect(sessionReducer(state, { type: 'restart' })).toEqual(initialSessionState)
  })
})

describe('summarizeSession', () => {
  it('считает верные и собирает ошибки в порядке ответов', () => {
    let state = sessionReducer(initialSessionState, {
      type: 'loaded',
      questions: [question('q1'), question('q2'), question('q3')],
    })
    state = sessionReducer(state, { type: 'answer', optionId: 'b', responseMs: 1 })
    state = sessionReducer(state, { type: 'next' })
    state = sessionReducer(state, { type: 'answer', optionId: 'a', responseMs: 1 })
    state = sessionReducer(state, { type: 'next' })
    state = sessionReducer(state, { type: 'answer', optionId: 'b', responseMs: 1 })
    state = sessionReducer(state, { type: 'next' })

    const result = summarizeSession(state)
    expect(result.total).toBe(3)
    expect(result.correct).toBe(1)
    expect(result.mistakes.map((m) => m.question.id)).toEqual(['q1', 'q3'])
  })

  it('на пустой сессии не падает', () => {
    expect(summarizeSession(initialSessionState)).toEqual({ total: 0, correct: 0, mistakes: [] })
  })
})

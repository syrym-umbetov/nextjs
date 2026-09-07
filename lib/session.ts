/**
 * Состояние сессии: чистый редьюсер без побочных эффектов.
 *
 * Загрузка вопросов, запись в localStorage и работа с клавиатурой живут
 * в компоненте; здесь только переходы состояний, поэтому логику «после ответа
 * показываем разбор, по Enter идём дальше, в конце — итоги» можно проверить
 * тестами без рендера.
 */
import type { RenderedQuestion } from './question'

export type SessionStatus = 'loading' | 'error' | 'empty' | 'active' | 'summary'

export interface AnswerRecord {
  readonly questionId: string
  readonly selectedOptionId: string
  readonly isCorrect: boolean
  readonly responseMs: number
}

export interface SessionState {
  readonly status: SessionStatus
  readonly questions: readonly RenderedQuestion[]
  readonly currentIndex: number
  /** `null`, пока пользователь не выбрал вариант; иначе показан разбор. */
  readonly selectedOptionId: string | null
  readonly answers: readonly AnswerRecord[]
  readonly errorMessage: string | null
}

export type SessionAction =
  | { type: 'loaded'; questions: RenderedQuestion[] }
  | { type: 'failed'; message: string }
  | { type: 'answer'; optionId: string; responseMs: number }
  | { type: 'next' }
  /** Переход к уже показанному вопросу — например по кнопке «назад» в браузере. */
  | { type: 'goto'; index: number }
  | { type: 'restart' }

export const initialSessionState: SessionState = {
  status: 'loading',
  questions: [],
  currentIndex: 0,
  selectedOptionId: null,
  answers: [],
  errorMessage: null,
}

/** Ответ, записанный для конкретного вопроса, если он уже был дан. */
export function answerFor(state: SessionState, questionId: string): AnswerRecord | undefined {
  return state.answers.find((answer) => answer.questionId === questionId)
}

export function currentQuestion(state: SessionState): RenderedQuestion | null {
  return state.questions[state.currentIndex] ?? null
}

/** Разбор показан ровно тогда, когда вариант уже выбран. */
export function isRevealed(state: SessionState): boolean {
  return state.status === 'active' && state.selectedOptionId !== null
}

/**
 * Переход к вопросу с восстановлением ранее данного ответа: если вопрос уже
 * отвечали, разбор показывается сразу, а не запрашивается заново.
 */
function moveTo(state: SessionState, index: number): SessionState {
  const question = state.questions[index]
  const recorded = question ? answerFor(state, question.id) : undefined
  return {
    ...state,
    currentIndex: index,
    selectedOptionId: recorded?.selectedOptionId ?? null,
  }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'loaded':
      return {
        ...initialSessionState,
        status: action.questions.length === 0 ? 'empty' : 'active',
        questions: action.questions,
      }

    case 'failed':
      return { ...initialSessionState, status: 'error', errorMessage: action.message }

    case 'answer': {
      // Повторный клик и клавиши после ответа не должны переписывать результат.
      if (state.status !== 'active' || state.selectedOptionId !== null) return state

      const question = currentQuestion(state)
      if (!question) return state
      // Вернулись назад к отвеченному вопросу — ответ уже записан, второй раз
      // засчитывать его нельзя: это исказило бы статистику и расписание SM-2.
      if (answerFor(state, question.id)) return state
      if (!question.options.some((option) => option.id === action.optionId)) return state

      const record: AnswerRecord = {
        questionId: question.id,
        selectedOptionId: action.optionId,
        isCorrect: action.optionId === question.correctOptionId,
        responseMs: Math.max(0, Math.round(action.responseMs)),
      }
      return { ...state, selectedOptionId: action.optionId, answers: [...state.answers, record] }
    }

    case 'next': {
      // «Дальше» работает только после ответа — пропускать вопрос нельзя.
      if (state.status !== 'active' || state.selectedOptionId === null) return state

      const nextIndex = state.currentIndex + 1
      if (nextIndex >= state.questions.length) {
        return { ...state, status: 'summary', selectedOptionId: null }
      }
      return moveTo(state, nextIndex)
    }

    case 'goto': {
      if (state.status !== 'active' && state.status !== 'summary') return state
      if (!Number.isInteger(action.index)) return state
      if (action.index < 0 || action.index >= state.questions.length) return state
      return moveTo({ ...state, status: 'active' }, action.index)
    }

    case 'restart':
      return initialSessionState

    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

export interface SessionResult {
  readonly total: number
  readonly correct: number
  readonly mistakes: readonly { question: RenderedQuestion; answer: AnswerRecord }[]
}

export function summarizeSession(state: SessionState): SessionResult {
  const byId = new Map(state.questions.map((question) => [question.id, question]))
  const mistakes: { question: RenderedQuestion; answer: AnswerRecord }[] = []

  for (const answer of state.answers) {
    if (answer.isCorrect) continue
    const question = byId.get(answer.questionId)
    if (question) mistakes.push({ question, answer })
  }

  return {
    total: state.answers.length,
    correct: state.answers.filter((answer) => answer.isCorrect).length,
    mistakes,
  }
}

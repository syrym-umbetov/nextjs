'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  QuestionIndexSchema,
  RenderedQuestionSchema,
  TOPIC_TITLES,
  TopicSchema,
  type RenderedQuestion,
  type Topic,
} from '@/lib/question'
import { PROGRESS_VERSION, type QuestionStats } from '@/lib/progress'
import { selectSession } from '@/lib/select'
import {
  answerFor,
  currentQuestion,
  initialSessionState,
  isRevealed,
  sessionReducer,
  summarizeSession,
} from '@/lib/session'
import { createInitialCardState, gradeFromAnswer, review, toDayString } from '@/lib/srs'
import { loadProgress, saveProgress } from '@/lib/storage'
import { Explanation } from './Explanation'
import { QuestionCard } from './QuestionCard'
import { SessionSkeleton } from './SessionSkeleton'
import { Summary } from './Summary'

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`)
  }
  return response.json()
}

export function SessionRunner() {
  const searchParams = useSearchParams()
  const topicParam = TopicSchema.safeParse(searchParams.get('topic'))
  const topic: Topic | undefined = topicParam.success ? topicParam.data : undefined

  const [state, dispatch] = useReducer(sessionReducer, initialSessionState)
  const [reloadKey, setReloadKey] = useState(0)

  const questionStartedAt = useRef(Date.now())
  const persistedCount = useRef(0)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const explanationRef = useRef<HTMLDivElement>(null)
  const questionRef = useRef<HTMLDivElement>(null)
  const isFirstQuestion = useRef(true)

  // Загрузка сессии: сначала лёгкий индекс, затем — только тела тех вопросов,
  // которые отобрал планировщик. Остальные 20+ вопросов в браузер не попадают.
  useEffect(() => {
    const controller = new AbortController()

    async function start() {
      try {
        const index = QuestionIndexSchema.parse(
          await fetchJson('/content/index.json', controller.signal),
        )
        const progress = loadProgress()
        const today = toDayString(new Date())
        const picked = selectSession({
          index: index.questions,
          cards: progress.cards,
          today,
          ...(topic ? { topic } : {}),
        })

        const bodies = await Promise.all(
          picked.map(async (entry) =>
            RenderedQuestionSchema.parse(
              await fetchJson(`/content/q/${entry.id}.json`, controller.signal),
            ),
          ),
        )

        if (controller.signal.aborted) return
        persistedCount.current = 0
        questionStartedAt.current = Date.now()
        dispatch({ type: 'loaded', questions: bodies })
      } catch (error) {
        if (controller.signal.aborted) return
        dispatch({
          type: 'failed',
          message: error instanceof Error ? error.message : 'Не удалось загрузить вопросы',
        })
      }
    }

    void start()
    return () => controller.abort()
  }, [topic, reloadKey])

  // Запись прогресса: SM-2 пересчитывается здесь, сам модуль srs.ts о хранилище
  // ничего не знает.
  useEffect(() => {
    if (state.answers.length <= persistedCount.current) return

    const pending = state.answers.slice(persistedCount.current)
    persistedCount.current = state.answers.length

    const today = toDayString(new Date())
    const progress = loadProgress()
    const cards = { ...progress.cards }
    const stats = { ...progress.stats }

    for (const answer of pending) {
      const previous = cards[answer.questionId] ?? createInitialCardState(today)
      cards[answer.questionId] = review(
        previous,
        gradeFromAnswer(answer.isCorrect, answer.responseMs),
        today,
      )
      const previousStats: QuestionStats = stats[answer.questionId] ?? {
        seen: 0,
        correct: 0,
        lastAnsweredAt: today,
      }
      stats[answer.questionId] = {
        seen: previousStats.seen + 1,
        correct: previousStats.correct + (answer.isCorrect ? 1 : 0),
        lastAnsweredAt: today,
      }
    }

    saveProgress({ version: PROGRESS_VERSION, cards, stats })
  }, [state.answers])

  const question = currentQuestion(state)
  const revealed = isRevealed(state)

  const handleSelect = useCallback((optionId: string) => {
    dispatch({ type: 'answer', optionId, responseMs: Date.now() - questionStartedAt.current })
  }, [])

  const handleNext = useCallback(() => {
    questionStartedAt.current = Date.now()
    dispatch({ type: 'next' })
  }, [])

  // Каждый показанный вопрос получает свою запись в истории браузера, чтобы
  // кнопка «назад» возвращала к предыдущему вопросу, а не уводила из сессии.
  // Индекс, равный числу вопросов, обозначает экран итогов.
  useEffect(() => {
    if (state.status !== 'active' && state.status !== 'summary') return

    const position = state.status === 'summary' ? state.questions.length : state.currentIndex
    const current = (window.history.state as { questionIndex?: number } | null)?.questionIndex

    if (current === undefined) {
      window.history.replaceState({ questionIndex: position }, '')
    } else if (current !== position) {
      window.history.pushState({ questionIndex: position }, '')
    }
  }, [state.status, state.currentIndex, state.questions.length])

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const index = (event.state as { questionIndex?: number } | null)?.questionIndex
      if (typeof index !== 'number') return
      questionStartedAt.current = Date.now()
      dispatch({ type: 'goto', index })
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleRestart = useCallback(() => {
    persistedCount.current = 0
    dispatch({ type: 'restart' })
    setReloadKey((key) => key + 1)
  }, [])

  // Разбор появился — уводим фокус на «Дальше», чтобы Enter сработал нативно.
  // preventScroll обязателен: иначе браузер сам прокрутит страницу к кнопке
  // и отложенная прокрутка к разбору ниже потеряет смысл.
  useEffect(() => {
    if (revealed) nextButtonRef.current?.focus({ preventScroll: true })
  }, [revealed, state.currentIndex])

  // Новый вопрос — подводим его к верху экрана. Иначе после «Дальше» из конца
  // длинного разбора пользователь остаётся прокрученным вниз и видит середину
  // следующего вопроса. Первый вопрос сессии не трогаем: страница и так сверху.
  useEffect(() => {
    if (isFirstQuestion.current) {
      isFirstQuestion.current = false
      return
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    questionRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [state.currentIndex])

  // Через четыре секунды после ответа подводим разбор под глаза: этого хватает,
  // чтобы заметить, верным ли был ответ, и не выдёргивает страницу мгновенно.
  useEffect(() => {
    if (!revealed) return

    const timer = window.setTimeout(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      explanationRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [revealed, state.currentIndex])

  // Клавиатура: 1–4 выбирают вариант, Enter переходит дальше.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.key >= '1' && event.key <= '4') {
        if (!question || revealed) return
        const option = question.options[Number(event.key) - 1]
        if (!option) return
        event.preventDefault()
        handleSelect(option.id)
        return
      }

      if (event.key === 'Enter') {
        if (!revealed) return
        // Если фокус на кнопке или ссылке, браузер сам вызовет клик —
        // второй обработчик пролистал бы сразу два вопроса.
        const active = document.activeElement
        if (active instanceof HTMLButtonElement || active instanceof HTMLAnchorElement) return
        event.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, revealed, handleSelect, handleNext])

  const result = useMemo(() => summarizeSession(state), [state])
  const heading = topic ? TOPIC_TITLES[topic] : 'Все темы'

  if (state.status === 'loading') {
    return <SessionSkeleton />
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
        <p className="text-sm font-medium text-rose-900">Не удалось загрузить сессию</p>
        <p className="mt-1 font-mono text-xs text-rose-800">{state.errorMessage}</p>
        <button
          type="button"
          onClick={handleRestart}
          className="mt-3 rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  if (state.status === 'empty') {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 text-center">
        <p className="text-sm text-stone-700">
          В теме «{heading}» сейчас нет вопросов к повторению — все запланированы на будущее.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
        >
          К темам
        </Link>
      </div>
    )
  }

  if (state.status === 'summary') {
    return <Summary result={result} onRestart={handleRestart} />
  }

  if (!question) return null

  const answer = answerFor(state, question.id)
  const isLast = state.currentIndex === state.questions.length - 1

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={state.questions.length}
          aria-valuenow={state.currentIndex}
          aria-label="Прогресс сессии"
        >
          <div
            className="h-full bg-stone-900 transition-[width]"
            style={{ width: `${(state.currentIndex / state.questions.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-stone-500">
          {state.currentIndex + 1} / {state.questions.length}
        </span>
      </div>

      <div ref={questionRef} className="scroll-mt-4">
        <QuestionCard
          question={question}
          selectedOptionId={state.selectedOptionId}
          questionNumber={state.currentIndex + 1}
          total={state.questions.length}
          onSelect={handleSelect}
        />
      </div>

      {revealed && answer && (
        <>
          <div ref={explanationRef} className="scroll-mt-4">
            <Explanation question={question} isCorrect={answer.isCorrect} />
          </div>
          {/* Кнопка липнет к низу экрана, пока разбор длиннее вьюпорта, и
              оседает в конце содержимого, когда он дочитан. sticky, а не fixed:
              элемент остаётся в потоке, поэтому не перекрывает конец разбора и
              не требует запаса снизу. Ширина — по колонке контента, на телефоне
              панель во всю ширину экрана. */}
          <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center border-t border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur sm:-mx-2 sm:rounded-xl sm:border sm:px-3 sm:shadow-sm">
            {/* Подсказка и счётчик выведены из потока, поэтому кнопка стоит
                ровно по центру панели независимо от их ширины. */}
            <span className="absolute left-4 text-xs text-stone-500 max-sm:hidden">
              или <kbd className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono">Enter</kbd>
            </span>
            <button
              ref={nextButtonRef}
              type="button"
              onClick={handleNext}
              className="mx-auto rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 max-sm:w-full max-sm:py-3 max-sm:text-base"
            >
              {isLast ? 'Итоги' : 'Дальше'}
            </button>
            <span className="absolute right-4 text-xs tabular-nums text-stone-400 max-sm:hidden">
              {state.currentIndex + 1} / {state.questions.length}
            </span>
          </div>
        </>
      )}

      {!revealed && (
        <p className="mt-4 text-xs text-stone-500">
          Выберите вариант мышью или клавишами{' '}
          <kbd className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono">1</kbd>
          –
          <kbd className="rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono">
            {question.options.length}
          </kbd>
        </p>
      )}
    </div>
  )
}

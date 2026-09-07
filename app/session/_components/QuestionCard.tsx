'use client'

import { useEffect, useRef } from 'react'
import { Markdown } from '@/lib/markdown'
import { TOPIC_TITLES, type RenderedQuestion } from '@/lib/question'

const TYPE_TITLES: Record<RenderedQuestion['type'], string> = {
  'multiple-choice': 'Выбор варианта',
  'find-the-bug': 'Найди ошибку',
  'predict-output': 'Предскажи поведение',
}

interface QuestionCardProps {
  question: RenderedQuestion
  selectedOptionId: string | null
  questionNumber: number
  total: number
  onSelect: (optionId: string) => void
}

export function QuestionCard({
  question,
  selectedOptionId,
  questionNumber,
  total,
  onSelect,
}: QuestionCardProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const revealed = selectedOptionId !== null

  // При переходе к новому вопросу переводим фокус на заголовок: скринридер
  // прочитает номер и формулировку, а клавиши 1–4 продолжат работать.
  // Прокруткой управляет SessionRunner, поэтому фокус её не вызывает.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [question.id])

  return (
    <article className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stone-200 px-5 py-3 text-xs text-stone-500">
        <h2 ref={headingRef} tabIndex={-1} className="font-medium text-stone-900 outline-none">
          Вопрос {questionNumber} из {total}
        </h2>
        <span>{TOPIC_TITLES[question.topic]}</span>
        <span aria-hidden="true">·</span>
        <span>{TYPE_TITLES[question.type]}</span>
        <span aria-hidden="true">·</span>
        <span>Сложность {question.difficulty} из 3</span>
        <span className="ml-auto rounded bg-stone-100 px-2 py-0.5 font-mono">
          Next.js {question.nextVersion}
        </span>
      </header>

      <div className="px-5 py-4">
        <Markdown text={question.prompt} className="text-[0.9375rem] leading-relaxed text-stone-800" />

        {question.codeHtml && (
          <div className="mt-4 overflow-hidden rounded-lg border border-stone-200">
            {/* HTML приходит от Shiki на этапе сборки из нашего же репозитория,
                пользовательского ввода тут нет. */}
            <div dangerouslySetInnerHTML={{ __html: question.codeHtml }} />
          </div>
        )}

        <fieldset className="mt-5" disabled={revealed}>
          <legend className="sr-only">Варианты ответа</legend>
          <ul className="space-y-2">
            {question.options.map((option, position) => {
              const isCorrect = option.id === question.correctOptionId
              const isChosen = option.id === selectedOptionId

              let tone = 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'
              if (revealed && isCorrect) {
                tone = 'border-emerald-500 bg-emerald-50'
              } else if (revealed && isChosen) {
                tone = 'border-rose-500 bg-rose-50'
              } else if (revealed) {
                tone = 'border-stone-200 bg-white opacity-60'
              }

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(option.id)}
                    aria-keyshortcuts={position < 9 ? String(position + 1) : undefined}
                    aria-pressed={isChosen}
                    className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-[0.9375rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-default ${tone}`}
                  >
                    <kbd className="mt-0.5 shrink-0 rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">
                      {position + 1}
                    </kbd>
                    <Markdown text={option.text} className="min-w-0 flex-1" />
                    {revealed && (
                      <span
                        className={`mt-0.5 shrink-0 text-sm font-medium ${isCorrect ? 'text-emerald-700' : isChosen ? 'text-rose-700' : 'text-transparent'}`}
                      >
                        {isCorrect ? 'верно' : isChosen ? 'ваш ответ' : ''}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </fieldset>
      </div>
    </article>
  )
}

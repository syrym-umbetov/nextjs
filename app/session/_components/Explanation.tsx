'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Markdown } from '@/lib/markdown'
import type { RenderedQuestion } from '@/lib/question'

interface ExplanationProps {
  question: RenderedQuestion
  isCorrect: boolean
}

/** Больше в строку запроса класть незачем: длинные URL режут и браузеры, и сервисы. */
const MAX_SELECTION = 600

interface SelectionState {
  readonly text: string
  readonly top: number
  readonly left: number
}

/** Собирает вопрос к Клоду вокруг выделенного фрагмента и его контекста. */
function buildClaudeUrl(selected: string, question: RenderedQuestion): string {
  const fragment =
    selected.length > MAX_SELECTION ? `${selected.slice(0, MAX_SELECTION)}…` : selected

  const prompt = [
    `Объясни подробнее фрагмент разбора по документации Next.js ${question.nextVersion}:`,
    '',
    `«${fragment}»`,
    '',
    `Контекст — вопрос тренажёра: ${question.prompt}`,
    `Раздел документации: ${question.docsUrl}`,
  ].join('\n')

  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}

export function Explanation({ question, isCorrect }: ExplanationProps) {
  const containerRef = useRef<HTMLElement>(null)
  const [selection, setSelection] = useState<SelectionState | null>(null)

  const readSelection = useCallback(() => {
    const container = containerRef.current
    const active = window.getSelection()

    if (!container || !active || active.isCollapsed || active.rangeCount === 0) {
      setSelection(null)
      return
    }

    const range = active.getRangeAt(0)
    // Реагируем только на выделение внутри разбора, а не по всей странице.
    if (!container.contains(range.commonAncestorContainer)) {
      setSelection(null)
      return
    }

    const text = active.toString().trim()
    if (text.length < 3) {
      setSelection(null)
      return
    }

    const rect = range.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    setSelection({
      text,
      top: rect.top - box.top,
      left: Math.min(Math.max(rect.left - box.left + rect.width / 2, 70), box.width - 70),
    })
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', readSelection)
    return () => document.removeEventListener('selectionchange', readSelection)
  }, [readSelection])

  // Новый вопрос — старая подсказка неактуальна.
  useEffect(() => setSelection(null), [question.id])

  return (
    <section
      ref={containerRef}
      role="status"
      className={`relative mt-4 rounded-xl border px-5 py-4 ${
        isCorrect ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
      }`}
    >
      <h3 className="text-sm font-semibold text-stone-900">
        {isCorrect ? 'Верно' : 'Неверно'} — разбор
      </h3>
      <Markdown
        text={question.explanation}
        className="mt-2 text-[0.9375rem] leading-relaxed text-stone-800"
      />
      <a
        href={question.docsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-stone-700 underline decoration-stone-400 underline-offset-4 hover:text-stone-900"
      >
        Документация Next.js {question.nextVersion}
        <span aria-hidden="true">↗</span>
      </a>

      {selection && (
        <a
          href={buildClaudeUrl(selection.text, question)}
          target="_blank"
          rel="noreferrer"
          // Без этого нажатие снимает выделение раньше, чем срабатывает переход.
          onMouseDown={(event) => event.preventDefault()}
          style={{ top: selection.top, left: selection.left }}
          className="absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          Спросить у Клода
        </a>
      )}
    </section>
  )
}

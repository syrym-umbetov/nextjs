'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Markdown } from '@/lib/markdown'
import type { RenderedQuestion } from '@/lib/question'

interface ExplanationProps {
  question: RenderedQuestion
  isCorrect: boolean
}

// Ограничения на длину: кириллица кодируется в URL по шесть символов на букву,
// поэтому запрос раздувается втрое и легко упирается в лимиты на длину URL.
const MAX_SELECTION = 400
const MAX_CODE = 700

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text
}

interface SelectionState {
  readonly text: string
  readonly top: number
  readonly left: number
}

/**
 * Собирает вопрос к Клоду вокруг выделенного фрагмента и его контекста.
 * Код из вопроса прикладывается, если он есть: без него разбор фрагмента
 * вроде «здесь не хватает `<Suspense>`» повисает в воздухе.
 */
function buildClaudeUrl(selected: string, question: RenderedQuestion): string {
  const lines = [
    `Объясни подробнее фрагмент разбора по документации Next.js ${question.nextVersion}:`,
    '',
    `«${clip(selected, MAX_SELECTION)}»`,
    '',
    `Вопрос тренажёра: ${question.prompt}`,
  ]

  if (question.code) {
    lines.push(
      '',
      'Код из вопроса:',
      '```' + question.code.language,
      clip(question.code.content, MAX_CODE),
      '```',
    )
  }

  lines.push('', `Раздел документации: ${question.docsUrl}`)

  return `https://claude.ai/new?q=${encodeURIComponent(lines.join('\n'))}`
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

  // Разбор неверных вариантов: сначала feedback, привязанный к самому варианту —
  // такой не разъезжается при перестановке. Список distractors остаётся для
  // вопросов, которые ещё не переведены на привязку.
  const bound = question.options
    .map((option, index) => ({ option, position: index + 1 }))
    .filter(({ option }) => option.id !== question.correctOptionId && option.feedback)
  const notes = bound.length
    ? bound.map(({ option, position }) => ({ text: option.feedback!, position }))
    : (question.distractors ?? []).map((text) => ({ text, position: undefined }))

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

      {/* Разбор неверных вариантов отделён: сначала читается, почему верный
          ответ верен, и только потом — что не так с остальными. */}
      <div className="mt-4 rounded-lg border border-stone-200/80 bg-white/60 px-4 py-3">
        <h4 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Почему остальные не подходят
        </h4>
        <ul className="mt-2 space-y-3">
          {notes.map((note, index) => (
            <li key={index} className="flex gap-2.5">
              {note.position === undefined ? (
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
              ) : (
                <span className="mt-0.5 shrink-0 rounded border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-500">
                  {note.position}
                </span>
              )}
              <Markdown text={note.text} className="min-w-0 flex-1 text-sm leading-relaxed text-stone-700" />
            </li>
          ))}
        </ul>
      </div>

      {question.footnote && (
        <div className="mt-3 border-l-2 border-stone-300 pl-3">
          <Markdown text={question.footnote} className="text-sm leading-relaxed text-stone-600" />
        </div>
      )}

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

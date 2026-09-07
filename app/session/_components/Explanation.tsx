'use client'

import { Markdown } from '@/lib/markdown'
import type { RenderedQuestion } from '@/lib/question'

interface ExplanationProps {
  question: RenderedQuestion
  isCorrect: boolean
}

export function Explanation({ question, isCorrect }: ExplanationProps) {
  return (
    <section
      role="status"
      className={`mt-4 rounded-xl border px-5 py-4 ${
        isCorrect ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
      }`}
    >
      <h3 className="text-sm font-semibold text-stone-900">
        {isCorrect ? 'Верно' : 'Неверно'} — разбор
      </h3>
      <Markdown
        text={question.explanation}
        className="mt-2 text-[15px] leading-relaxed text-stone-800"
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
    </section>
  )
}

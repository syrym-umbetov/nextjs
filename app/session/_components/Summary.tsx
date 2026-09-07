'use client'

import Link from 'next/link'
import { Markdown } from '@/lib/markdown'
import { TOPIC_TITLES } from '@/lib/question'
import type { SessionResult } from '@/lib/session'

export function Summary({ result, onRestart }: { result: SessionResult; onRestart: () => void }) {
  const percent = result.total === 0 ? 0 : Math.round((result.correct / result.total) * 100)

  return (
    <section aria-labelledby="summary-heading">
      <div className="rounded-xl border border-stone-200 bg-white px-5 py-6 text-center shadow-sm">
        <h2 id="summary-heading" className="text-sm font-medium text-stone-500">
          Сессия завершена
        </h2>
        <p className="mt-2 text-4xl font-semibold tabular-nums text-stone-900">
          {result.correct} / {result.total}
        </p>
        <p className="mt-1 text-sm text-stone-500">{percent}% верных ответов</p>
      </div>

      {result.mistakes.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-stone-900">
            Разобрать ({result.mistakes.length})
          </h3>
          <ul className="mt-3 space-y-3">
            {result.mistakes.map(({ question }) => (
              <li
                key={question.id}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs text-stone-500">{TOPIC_TITLES[question.topic]}</p>
                <Markdown
                  text={question.prompt}
                  className="mt-1 text-[0.9375rem] leading-relaxed text-stone-800"
                />
                <a
                  href={question.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-stone-700 underline decoration-stone-400 underline-offset-4 hover:text-stone-900"
                >
                  Документация Next.js {question.nextVersion}
                  <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          Ещё сессия
        </button>
        <Link
          href="/"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
        >
          К темам
        </Link>
      </div>
    </section>
  )
}

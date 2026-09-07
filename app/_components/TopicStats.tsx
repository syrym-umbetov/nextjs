'use client'

import { useEffect, useState } from 'react'
import { summarize, type TopicSummary } from '@/lib/progress'
import { isDue, toDayString } from '@/lib/srs'
import { loadProgress } from '@/lib/storage'

/**
 * Статистика по теме. Единственный клиентский кусок главной страницы: всё
 * остальное отрисовано на сервере, сюда приходят только id вопросов темы.
 */
export function TopicStats({ questionIds }: { questionIds: string[] }) {
  const [summary, setSummary] = useState<TopicSummary | null>(null)

  useEffect(() => {
    const today = toDayString(new Date())
    setSummary(summarize(loadProgress(), questionIds, (card) => isDue(card, today)))
  }, [questionIds])

  if (!summary) {
    // До гидратации localStorage недоступен — держим высоту строки, чтобы
    // карточка не прыгала.
    return <p className="mt-2 h-5 text-sm text-stone-400">…</p>
  }

  const rate =
    summary.correctRate === null ? '—' : `${Math.round(summary.correctRate * 100)}% верных`

  return (
    <p className="mt-2 text-sm text-stone-500 tabular-nums">
      Отвечено {summary.answered} из {summary.total} · {rate}
      {summary.due > 0 && (
        <>
          {' · '}
          <span className="font-medium text-stone-800">{summary.due} к повторению</span>
        </>
      )}
    </p>
  )
}

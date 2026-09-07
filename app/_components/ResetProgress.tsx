'use client'

import { useEffect, useRef, useState } from 'react'
import { clearProgress } from '@/lib/storage'

/**
 * Сброс прогресса. Действие необратимое, поэтому в один клик не делается:
 * первая кнопка раскрывает подтверждение, и оно само сворачивается через
 * несколько секунд, если по нему не нажали.
 */
export function ResetProgress() {
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!confirming) return
    confirmRef.current?.focus()
    const timer = window.setTimeout(() => setConfirming(false), 6000)
    return () => window.clearTimeout(timer)
  }, [confirming])

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), 4000)
    return () => window.clearTimeout(timer)
  }, [done])

  if (done) {
    return (
      <p role="status" className="text-sm text-stone-500">
        Прогресс очищен — все вопросы снова считаются новыми.
      </p>
    )
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      >
        Очистить прогресс
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-stone-700">
        Удалить статистику и расписание повторений? Отменить будет нельзя.
      </span>
      <button
        ref={confirmRef}
        type="button"
        onClick={() => {
          clearProgress()
          setConfirming(false)
          setDone(true)
        }}
        className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
      >
        Да, очистить
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      >
        Отмена
      </button>
    </div>
  )
}

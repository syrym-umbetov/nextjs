/**
 * Заглушка на время подбора вопросов.
 *
 * Повторяет геометрию карточки вопроса, поэтому при появлении содержимого
 * макет не прыгает. Интерактивности здесь нет, поэтому и директива не нужна:
 * компонент рендерится и на сервере — им же заполняется граница <Suspense>
 * на странице сессии.
 */
function Line({ className = '' }: { className?: string }) {
  return <div className={`h-3.5 rounded bg-stone-200 ${className}`} />
}

export function SessionSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {/* полоса прогресса */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-stone-200" />
        <div className="h-3 w-10 rounded bg-stone-200" />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-stone-200 px-5 py-3">
          <div className="h-3 w-28 rounded bg-stone-200" />
          <div className="h-3 w-20 rounded bg-stone-200" />
          <div className="ml-auto h-4 w-24 rounded bg-stone-200" />
        </div>

        <div className="px-5 py-4">
          <Line className="w-11/12" />
          <Line className="mt-2 w-3/4" />

          {/* блок кода */}
          <div className="mt-4 space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <Line className="w-2/3 bg-stone-200/80" />
            <Line className="w-1/2 bg-stone-200/80" />
            <Line className="w-5/6 bg-stone-200/80" />
          </div>

          {/* варианты ответа */}
          <ul className="mt-5 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-stone-200 px-4 py-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded border border-stone-200 bg-stone-100" />
                <Line className={i % 2 === 0 ? 'w-4/5' : 'w-3/5'} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="sr-only" aria-hidden="false" role="status">
        Подбираем вопросы
      </p>
    </div>
  )
}

import Link from 'next/link'
import { Suspense } from 'react'
import { SessionRunner } from './_components/SessionRunner'

// Серверная оболочка: вся интерактивность и работа с localStorage живут ниже
// по дереву, в SessionRunner.
export default function SessionPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-8">
      <Link
        href="/"
        className="text-sm text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-900"
      >
        ← К темам
      </Link>
      <div className="mt-5">
        <Suspense fallback={<p className="text-sm text-stone-500">Подбираем вопросы…</p>}>
          <SessionRunner />
        </Suspense>
      </div>
    </main>
  )
}

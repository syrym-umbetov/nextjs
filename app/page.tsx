import Link from 'next/link'
import { TopicStats } from '@/app/_components/TopicStats'
import { loadAllQuestions } from '@/lib/content'
import { TOPIC_TITLES, TOPICS, type Topic } from '@/lib/question'

export default async function HomePage() {
  // Вопросы читаются на сервере во время сборки. В браузер уходят только id —
  // они нужны, чтобы посчитать статистику по локальному прогрессу.
  const questions = await loadAllQuestions()

  const idsByTopic = new Map<Topic, string[]>()
  for (const question of questions) {
    const bucket = idsByTopic.get(question.topic)
    if (bucket) {
      bucket.push(question.id)
    } else {
      idsByTopic.set(question.topic, [question.id])
    }
  }

  const topics = TOPICS.filter((topic) => (idsByTopic.get(topic)?.length ?? 0) > 0)
  const allIds = questions.map((question) => question.id)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Тренажёр по документации Next.js
        </h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-stone-600">
          Вопросы по App Router с разбором и ссылкой на раздел документации. Вопросы возвращаются
          по алгоритму SM-2, прогресс хранится в этом браузере.
        </p>
      </header>

      <section aria-labelledby="all-heading" className="mt-8">
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
          <h2 id="all-heading" className="font-medium text-stone-900">
            Все темы
          </h2>
          <TopicStats questionIds={allIds} />
          <Link
            href="/session"
            className="mt-3 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            Начать сессию
          </Link>
        </div>
      </section>

      <section aria-labelledby="topics-heading" className="mt-8">
        <h2 id="topics-heading" className="text-sm font-semibold text-stone-900">
          По темам
        </h2>
        <ul className="mt-3 space-y-3">
          {topics.map((topic) => {
            const ids = idsByTopic.get(topic) ?? []
            return (
              <li
                key={topic}
                className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-stone-900">{TOPIC_TITLES[topic]}</h3>
                  <span className="text-xs text-stone-500 tabular-nums">{ids.length} вопросов</span>
                </div>
                <TopicStats questionIds={ids} />
                <Link
                  href={{ pathname: '/session', query: { topic } }}
                  className="mt-3 inline-block rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
                >
                  Тренировать
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}

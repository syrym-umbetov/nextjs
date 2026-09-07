import 'server-only'

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { QuestionFileSchema, type Question, type Topic } from './question'

/**
 * Чтение вопросов на сервере во время сборки.
 *
 * Модуль помечен `server-only`: если он случайно попадёт в клиентский граф,
 * сборка упадёт, а не утащит все 30 вопросов в браузерный бандл.
 */

const SOURCE_DIR = join(process.cwd(), 'content', 'questions')

export async function loadAllQuestions(): Promise<Question[]> {
  const entries = await readdir(SOURCE_DIR)
  const files = entries.filter((name) => name.endsWith('.json')).sort()

  const perFile = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(SOURCE_DIR, file), 'utf8')
      // Форма уже проверена в scripts/build-content.ts, который выполняется
      // до `next build`; parse здесь — страховка от рассинхронизации.
      return QuestionFileSchema.parse(JSON.parse(raw))
    }),
  )

  return perFile.flat()
}

export async function countQuestionsByTopic(): Promise<Partial<Record<Topic, number>>> {
  const questions = await loadAllQuestions()
  const counts: Partial<Record<Topic, number>> = {}
  for (const question of questions) {
    counts[question.topic] = (counts[question.topic] ?? 0) + 1
  }
  return counts
}

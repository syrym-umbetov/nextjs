/**
 * Сборка контента: валидация вопросов и подготовка статики.
 *
 * Запускается перед `next build` и `next dev` (npm-хуки `prebuild` / `predev`).
 * Любой битый вопрос роняет процесс с кодом 1 — то есть роняет билд, и до UI
 * такой вопрос не доезжает.
 *
 * На выходе два вида файлов в `public/content/`:
 *   index.json     — { id, topic, difficulty } для всех вопросов (нужен планировщику)
 *   q/<id>.json    — полное тело вопроса с уже подсвеченным кодом
 *
 * Благодаря такому разделению в браузер уходят тексты только тех вопросов,
 * которые реально попали в сессию.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHighlighter } from 'shiki'
import * as z from 'zod'
import {
  CODE_LANGUAGES,
  QuestionFileSchema,
  TOPICS,
  type Question,
  type QuestionIndex,
  type RenderedQuestion,
} from '../lib/question'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = join(ROOT, 'content', 'questions')
const OUT_DIR = join(ROOT, 'public', 'content')

const SHIKI_THEME = 'github-light'

class ContentError extends Error {}

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(корень)'
    return `  ${file} → ${path}: ${issue.message}`
  })
}

async function readTopicFiles(): Promise<{ file: string; questions: Question[] }[]> {
  let entries: string[]
  try {
    entries = await readdir(SOURCE_DIR)
  } catch {
    throw new ContentError(`Каталог с вопросами не найден: ${SOURCE_DIR}`)
  }

  const jsonFiles = entries.filter((name) => name.endsWith('.json')).sort()
  if (jsonFiles.length === 0) {
    throw new ContentError(`В ${SOURCE_DIR} нет ни одного .json файла с вопросами`)
  }

  const problems: string[] = []
  const result: { file: string; questions: Question[] }[] = []

  for (const file of jsonFiles) {
    const stem = file.replace(/\.json$/, '')
    if (!(TOPICS as readonly string[]).includes(stem)) {
      problems.push(`  ${file}: имя файла должно быть одной из тем: ${TOPICS.join(', ')}`)
      continue
    }

    const raw = await readFile(join(SOURCE_DIR, file), 'utf8')
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch (error) {
      problems.push(`  ${file}: невалидный JSON — ${(error as Error).message}`)
      continue
    }

    const parsed = QuestionFileSchema.safeParse(parsedJson)
    if (!parsed.success) {
      problems.push(...formatIssues(file, parsed.error))
      continue
    }

    for (const question of parsed.data) {
      if (question.topic !== stem) {
        problems.push(
          `  ${file} → ${question.id}: topic="${question.topic}" не совпадает с именем файла "${stem}"`,
        )
      }
    }

    result.push({ file, questions: parsed.data })
  }

  if (problems.length > 0) {
    throw new ContentError(`Контент не прошёл валидацию:\n${problems.join('\n')}`)
  }

  return result
}

/**
 * Правильный ответ не должен залипать на одной позиции: иначе тренажёр учит
 * не материалу, а привычке жать одну и ту же клавишу. Порядок вариантов в
 * JSON — то, что видит пользователь, поэтому проверяем именно его.
 */
function assertAnswersAreMixed(questions: Question[]): void {
  const MIN_SAMPLE = 8
  const MAX_SHARE = 0.5

  if (questions.length < MIN_SAMPLE) return

  const byPosition = new Map<number, number>()
  for (const question of questions) {
    const position = question.options.findIndex((o) => o.id === question.correctOptionId) + 1
    byPosition.set(position, (byPosition.get(position) ?? 0) + 1)
  }

  for (const [position, count] of byPosition) {
    const share = count / questions.length
    if (share > MAX_SHARE) {
      const percent = Math.round(share * 100)
      throw new ContentError(
        `Правильный ответ слишком часто стоит на позиции ${position}: ` +
          `${count} из ${questions.length} (${percent}%, допустимо не больше ${MAX_SHARE * 100}%). ` +
          `Перемешайте варианты — иначе тренажёр учит нажимать одну клавишу.`,
      )
    }
  }
}

function assertGloballyUnique(questions: Question[]): void {
  const seen = new Map<string, number>()
  for (const question of questions) {
    seen.set(question.id, (seen.get(question.id) ?? 0) + 1)
  }
  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  if (duplicates.length > 0) {
    throw new ContentError(`Повторяющиеся id вопросов: ${duplicates.join(', ')}`)
  }
}

async function main(): Promise<void> {
  const files = await readTopicFiles()
  const questions = files.flatMap((entry) => entry.questions)
  assertGloballyUnique(questions)
  assertAnswersAreMixed(questions)

  const highlighter = await createHighlighter({
    themes: [SHIKI_THEME],
    langs: [...CODE_LANGUAGES],
  })

  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(join(OUT_DIR, 'q'), { recursive: true })

  for (const question of questions) {
    const rendered: RenderedQuestion = { ...question }
    if (question.code) {
      rendered.codeHtml = highlighter.codeToHtml(question.code.content, {
        lang: question.code.language,
        theme: SHIKI_THEME,
      })
    }
    await writeFile(join(OUT_DIR, 'q', `${question.id}.json`), JSON.stringify(rendered), 'utf8')
  }

  const index: QuestionIndex = {
    generatedAt: new Date().toISOString(),
    questions: questions.map(({ id, topic, difficulty }) => ({ id, topic, difficulty })),
  }
  await writeFile(join(OUT_DIR, 'index.json'), JSON.stringify(index), 'utf8')

  highlighter.dispose()

  const byTopic = new Map<string, number>()
  for (const question of questions) {
    byTopic.set(question.topic, (byTopic.get(question.topic) ?? 0) + 1)
  }
  const breakdown = [...byTopic.entries()].map(([topic, n]) => `${topic}=${n}`).join(', ')
  console.log(`✓ Контент собран: ${questions.length} вопрос(ов) [${breakdown}]`)
}

try {
  await main()
} catch (error) {
  if (error instanceof ContentError) {
    console.error(`\n✗ ${error.message}\n`)
  } else {
    console.error(error)
  }
  process.exit(1)
}

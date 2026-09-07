import * as z from 'zod'

/**
 * Схема одного вопроса тренажёра.
 *
 * Этот модуль — единственный источник правды о форме контента. Он используется
 * и скриптом сборки (`scripts/build-content.ts`), и приложением, поэтому здесь
 * не должно быть ничего, что завязано на Node или на браузер.
 */

export const TOPICS = [
  'rendering',
  'caching',
  'routing',
  'navigation',
  'data-fetching',
  'mutations',
  'conventions',
  'errors',
  'styling',
  'metadata',
  'security',
  'deployment',
  'testing',
] as const

export const TopicSchema = z.enum(TOPICS)
export type Topic = z.infer<typeof TopicSchema>

export const TOPIC_TITLES: Record<Topic, string> = {
  rendering: 'Server / Client компоненты',
  caching: 'Кэширование',
  routing: 'Роутинг',
  navigation: 'Навигация и префетч',
  'data-fetching': 'Получение данных',
  mutations: 'Server Actions и формы',
  conventions: 'Файловые конвенции',
  errors: 'Обработка ошибок',
  styling: 'Стили, шрифты, изображения',
  metadata: 'Метаданные',
  security: 'Аутентификация и безопасность',
  deployment: 'Деплой и self-hosting',
  testing: 'Тестирование',
}

/** Языки, которые точно умеет подсветить Shiki с нашим набором грамматик. */
export const CODE_LANGUAGES = ['tsx', 'ts', 'jsx', 'js', 'json', 'bash'] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export const DifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export type Difficulty = z.infer<typeof DifficultySchema>

export const QuestionTypeSchema = z.enum([
  'multiple-choice',
  'find-the-bug',
  'predict-output',
])
export type QuestionType = z.infer<typeof QuestionTypeSchema>

export const OptionSchema = z.object({
  id: z.string().min(1).max(16),
  text: z.string().min(1),
})
export type Option = z.infer<typeof OptionSchema>

export const CodeSchema = z.object({
  language: z.enum(CODE_LANGUAGES),
  content: z.string().min(1),
})

export const QuestionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id: только строчные латинские буквы, цифры и дефис'),
    topic: TopicSchema,
    difficulty: DifficultySchema,
    type: QuestionTypeSchema,
    prompt: z.string().min(1),
    code: CodeSchema.optional(),
    // Максимум четыре варианта: интерфейс завязан на клавиши 1–4.
    options: z.array(OptionSchema).min(2).max(4),
    correctOptionId: z.string().min(1),
    /** Почему верный вариант верен. */
    explanation: z.string().min(1),
    /** Разбор неверных вариантов — по одному комментарию на вариант или группу. */
    distractors: z.array(z.string().min(1)).min(1),
    /** Необязательная заметка после разбора: смежный факт или подводный камень. */
    footnote: z.string().min(1).optional(),
    docsUrl: z
      .url()
      .startsWith('https://nextjs.org/docs', 'docsUrl: ссылка должна вести на nextjs.org/docs'),
    nextVersion: z
      .string()
      .regex(/^\d+\.\d+(\.\d+)?$/, 'nextVersion: ожидается вид "16.3" или "16.3.4"'),
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    message: 'correctOptionId не совпадает ни с одним из option.id',
    path: ['correctOptionId'],
  })
  .refine((q) => new Set(q.options.map((o) => o.id)).size === q.options.length, {
    message: 'option.id повторяются внутри вопроса',
    path: ['options'],
  })
  .refine((q) => q.type === 'multiple-choice' || q.code !== undefined, {
    message: 'вопросы типа find-the-bug и predict-output обязаны содержать code',
    path: ['code'],
  })
  .refine((q) => q.distractors.length <= q.options.length - 1, {
    message: 'комментариев в distractors больше, чем неверных вариантов',
    path: ['distractors'],
  })

export type Question = z.infer<typeof QuestionSchema>

/** Файл темы: просто массив вопросов. */
export const QuestionFileSchema = z.array(QuestionSchema).min(1)

/**
 * Лёгкая запись индекса. Только это уходит в браузер целиком — планировщику
 * SM-2 больше ничего не нужно, чтобы решить, какие вопросы показывать.
 */
export const QuestionIndexEntrySchema = z.object({
  id: z.string(),
  topic: TopicSchema,
  difficulty: DifficultySchema,
})
export type QuestionIndexEntry = z.infer<typeof QuestionIndexEntrySchema>

export const QuestionIndexSchema = z.object({
  generatedAt: z.string(),
  questions: z.array(QuestionIndexEntrySchema),
})
export type QuestionIndex = z.infer<typeof QuestionIndexSchema>

/**
 * Вопрос, готовый к показу: код уже подсвечен Shiki на этапе сборки, поэтому
 * ни грамматики, ни тема подсветки в клиентский бандл не попадают.
 */
export const RenderedQuestionSchema = QuestionSchema.safeExtend({
  codeHtml: z.string().optional(),
})
export type RenderedQuestion = z.infer<typeof RenderedQuestionSchema>

/**
 * Тонкая обёртка над localStorage.
 *
 * Единственное место в приложении, которое знает о браузерном хранилище.
 * Всё, что читается, проходит через zod: повреждённые или устаревшие данные
 * молча заменяются пустым прогрессом, чтобы приложение не падало из-за того,
 * что кто-то поправил значение в DevTools.
 */
import { STORAGE_KEY, emptyProgress, parseProgress, type Progress } from './progress'

/**
 * Событие о смене прогресса. localStorage не уведомляет вкладку о собственных
 * записях, поэтому статистику на главной обновляем сами.
 */
export const PROGRESS_CHANGED_EVENT = 'trainer:progress-changed'

function notifyChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT))
}

function getStorage(): Storage | null {
  // localStorage недоступен при SSR/пререндере, а также в приватном режиме
  // некоторых браузеров, где обращение к нему бросает исключение.
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadProgress(): Progress {
  const storage = getStorage()
  if (!storage) return emptyProgress()

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return emptyProgress()
    return parseProgress(JSON.parse(raw) as unknown)
  } catch {
    return emptyProgress()
  }
}

/** Возвращает `true`, если запись действительно прошла. */
export function saveProgress(progress: Progress): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress))
    return true
  } catch {
    // Переполненная квота или запрет на запись — прогресс просто не сохранится.
    return false
  }
}

export function clearProgress(): boolean {
  const storage = getStorage()
  if (!storage) return false

  try {
    storage.removeItem(STORAGE_KEY)
    notifyChanged()
    return true
  } catch {
    return false
  }
}

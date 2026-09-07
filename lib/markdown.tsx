import { Fragment, type ReactNode } from 'react'

/**
 * Крошечный рендерер подмножества markdown для формулировок и разборов.
 *
 * Поддерживает абзацы, списки, `код`, **жирный**, *курсив* и [ссылки](url).
 * Собирает React-узлы, а не HTML-строку, поэтому dangerouslySetInnerHTML тут
 * не нужен и текст вопроса не может внезапно стать разметкой.
 */

const INLINE_PATTERN = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^\s)]+)\)/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  INLINE_PATTERN.lastIndex = 0
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const key = `${keyPrefix}-${index}`
    index += 1

    const [, code, bold, italic, linkText, linkHref] = match
    if (code !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-stone-200/70 px-1 py-0.5 font-mono text-[0.9em] text-stone-800"
        >
          {code}
        </code>,
      )
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {bold}
        </strong>,
      )
    } else if (italic !== undefined) {
      nodes.push(<em key={key}>{italic}</em>)
    } else if (linkText !== undefined && linkHref !== undefined) {
      nodes.push(
        <a
          key={key}
          href={linkHref}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-stone-400 underline-offset-2 hover:decoration-stone-900"
        >
          {linkText}
        </a>,
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n{2,}/)

  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n')
        const isList = lines.every((line) => /^[-*]\s+/.test(line.trim()))

        if (isList) {
          return (
            <ul key={blockIndex} className="my-2 list-disc space-y-1 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.trim().replace(/^[-*]\s+/, ''), `${blockIndex}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={blockIndex} className="my-2 first:mt-0 last:mb-0">
            {lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${blockIndex}-${lineIndex}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

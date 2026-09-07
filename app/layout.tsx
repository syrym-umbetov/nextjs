import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Тренажёр по документации Next.js',
  description:
    'Вопросы по App Router с разбором и ссылками на документацию. Интервальное повторение по SM-2, прогресс хранится локально.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-dvh bg-stone-50 font-sans text-stone-900 antialiased">
        {children}
      </body>
    </html>
  )
}

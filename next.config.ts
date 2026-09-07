import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Полностью статическая сборка: `next build` кладёт готовые файлы в `out/`.
  // Бэкенда нет, весь прогресс живёт в localStorage браузера.
  output: 'export',
  reactStrictMode: true,
}

export default nextConfig

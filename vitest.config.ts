import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // O tsconfig do Next usa jsx: preserve; aqui transformamos JSX (runtime
  // automático do React) para os testes poderem importar componentes .tsx.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

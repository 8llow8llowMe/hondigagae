import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'app/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/features/**'],
      exclude: ['**/*.test.ts', 'src/test/**'],
    },
  },
  resolve: {
    alias: {
      // tsconfig.json 의 paths 와 값이 같아야 한다
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'server-only' 는 node 환경에서 throw 하므로 빈 스텁으로 대체
      'server-only': fileURLToPath(new URL('./src/test/stubs/server-only.ts', import.meta.url)),
    },
  },
})

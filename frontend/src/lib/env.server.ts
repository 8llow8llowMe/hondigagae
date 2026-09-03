import { z } from 'zod'

import 'server-only'

/**
 * 서버 전용 환경변수. 부팅 시 fail-fast 한다.
 * NEXT_PUBLIC_ 접두사를 붙이지 않는다 — 붙이면 클라이언트 번들에 박힌다.
 */
const schema = z.object({
  BACKEND_API_URL: z.string().url(),
  AUTH_SESSION_SECRET: z.string().min(32, 'AUTH_SESSION_SECRET 은 32자 이상이어야 한다'),
})

export const serverEnv = schema.parse({
  BACKEND_API_URL: process.env.BACKEND_API_URL,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
})

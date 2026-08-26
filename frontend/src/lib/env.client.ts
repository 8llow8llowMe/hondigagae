import { z } from 'zod'

/**
 * 클라이언트에 노출되는 환경변수.
 * Next는 리터럴 참조만 인라인하므로 process.env 를 통째로 넘기면 값이 비어 온다.
 */
const schema = z.object({
  NEXT_PUBLIC_KAKAO_MAP_KEY: z.string().min(1),
})

export const clientEnv = schema.parse({
  NEXT_PUBLIC_KAKAO_MAP_KEY: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY,
})

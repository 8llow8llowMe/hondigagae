import { messages } from '@/lib/messages'

/**
 * 돌아갈 곳별 "무엇을 하려고 왔는가" (#1157). 경로는 `proxy.ts` 의 `PROTECTED_PATHS` 와 같다.
 *
 * **표는 배열이다** — `ReauthNotice` 가 `Map` 을 쓰는 것과 같은 이유로, 사용자가 조작하는 값으로
 * 객체 리터럴을 조회하지 않는다(`__proto__` 같은 키가 상속 값을 돌려준다).
 */
const PURPOSES: readonly (readonly [path: string, purpose: string])[] = [
  ['/ai-plans', messages.auth.purposeAiPlan],
  ['/plans', messages.auth.purposePlan],
  ['/pets', messages.auth.purposePet],
  ['/favorites', messages.auth.purposeFavorite],
  ['/mypage', messages.auth.purposeMypage],
]

const HOME_PATH = '/'

/**
 * 로그인 · 회원가입 화면 머리에 쓸 목적 구절. 말할 것이 없으면 `null`.
 *
 * - 보호 경로 → 그 화면의 목적 (`AI 일정을 만들려면`)
 * - 그 밖의 경로 → 일반 문구 — 장소 상세의 `일정에 담기` 처럼 동작이 로그인을 요구한 경우다
 * - **홈 → `null`.** `returnTo` 가 없으면 홈으로 접히는데(`safeReturnTo`), 그것은 사용자가
 *   헤더의 `로그인` 을 스스로 누른 경우라 이유를 덧붙일 것이 없다
 *
 * `returnTo` 는 페이지가 `safeReturnTo` 로 이미 검증한 값이다. **경로 조각 단위로 본다** —
 * 접두어만 보면 `/pets` 가 `/petshop` 에도 걸린다.
 */
export function loginPurposeFor(returnTo: string): string | null {
  const pathname = returnTo.split(/[?#]/)[0] ?? ''
  if (pathname === HOME_PATH || pathname === '') return null

  const hit = PURPOSES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))
  return hit === undefined ? messages.auth.purposeGeneric : hit[1]
}

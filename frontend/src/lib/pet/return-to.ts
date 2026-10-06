import { safeReturnTo } from '@/lib/http/redirect'

const PET_CREATE_PATH = '/pets/new'
const HOME_PATH = '/'
/** 경로를 정규화하려고 빌리는 가짜 오리진 — 결과에는 실리지 않는다 */
const PARSE_BASE = 'http://return-to.invalid'

/**
 * 하던 일로 돌아올 곳을 실은 반려견 등록 경로 (#1153).
 *
 * AI 일정 · 일정 만들기 · 장소 적합도처럼 **작업 도중 반려견이 없어 등록으로 빠지는 자리**가
 * 쓴다. 예전에는 모두 `/pets/new` 로만 보내 등록이 끝나면 `/pets` 목록에 멈췄고, 사용자가
 * 하던 화면을 스스로 다시 찾아야 했다 (2026-10-06 사용성 점검).
 *
 * 홈 프로필 카드 · 반려견 목록 · 스위처처럼 **등록 자체가 목적인 자리**는 쓰지 않는다 —
 * 그때는 등록한 아이를 목록에서 보는 것이 맞다.
 */
export function petCreateHref(returnTo: string): string {
  return `${PET_CREATE_PATH}?returnTo=${encodeURIComponent(returnTo)}`
}

/**
 * 등록을 마친 뒤 돌아갈 곳. 없거나 못 쓰는 값이면 `null` — 호출부가 반려견 목록으로 간다.
 *
 * **판정은 로그인의 `safeReturnTo` 를 그대로 쓴다** (외부 URL · 스킴 · 제어문자 · 인증 화면).
 * 다만 그 함수는 못 쓰는 값을 **홈으로 접는데**, 여기서 홈으로 보내면 반려견을 등록하고
 * 엉뚱한 화면에 떨어진다. 그래서 "접힌 홈" 과 "정말 홈" 을 갈라 접힌 쪽은 `null` 로 둔다.
 *
 * **정규화한 뒤 한 번 더 본다.** `safeReturnTo` 는 문자열 앞머리만 보므로 점 세그먼트가 섞인
 * `/.//evil.com` · `/a/..//evil.com` · `/%2e//evil.com` 을 통과시킨다. 이 값은 정규화되면
 * `//evil.com`(프로토콜 상대)이 되고, 로그인과 달리 여기서는 서버 `redirect()` 가 아니라
 * 클라이언트 `router.replace` · `Link` 로 흘러 외부 이동이 될 수 있다. 그래서 `URL` 로 풀어
 * 경로를 다시 확인하고, **정규화된 경로를 돌려준다.**
 *
 * **등록 화면 자신은 돌아갈 곳이 아니다** — 같은 폼이 다시 떠 두 번 등록하게 된다. 끝 슬래시 ·
 * 해시 · 점 세그먼트로 모양만 바꾼 값(`/pets/new/` · `/pets/./new`)도 같은 화면이다.
 */
export function petCreateReturnTo(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null

  const safe = safeReturnTo(raw)
  if (safe === HOME_PATH && raw.trim() !== HOME_PATH) return null

  let url: URL
  try {
    url = new URL(safe, PARSE_BASE)
  } catch {
    return null
  }
  if (url.origin !== PARSE_BASE) return null
  if (url.pathname.startsWith('//') || url.pathname.startsWith('/\\')) return null

  const bare = url.pathname.replace(/\/+$/, '') || HOME_PATH
  if (bare === PET_CREATE_PATH) return null

  return `${url.pathname}${url.search}${url.hash}`
}

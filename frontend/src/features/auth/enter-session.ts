import type { useRouter } from 'next/navigation'

import type { QueryClient } from '@tanstack/react-query'

type SessionEntryDeps = {
  queryClient: Pick<QueryClient, 'clear'>
  router: Pick<ReturnType<typeof useRouter>, 'replace' | 'refresh'>
}

/**
 * 세션이 생긴 뒤처리 — **이메일 로그인 · 소셜 로그인**. `useSessionExit` 의 짝이다.
 *
 * - `queryClient.clear()` — 이전 사용자 캐시가 남으면 다른 계정의 데이터가 보인다.
 * - `replace` — `push` 면 뒤로가기로 로그인 화면(소셜은 이미 소모된 `?code=&state=`)에 돌아온다.
 * - **`refresh` — 헤더가 비로그인 모양으로 남는 것을 막는 방어다** (#1013). 헤더의 `authed` 는
 *   `(main)` 레이아웃(서버 컴포넌트)이 쿠키로 정하고, 같은 그룹 안의 이동에서는 레이아웃을
 *   다시 그리지 않는다. 한 번 비로그인 모양으로 남으면 새로고침 전까지 그대로다. 로그인 직후
 *   그런 화면이 실제로 보고됐지만 **재현 조건은 잡지 못했다** — 목 9회 · 실백엔드 1회 모두
 *   정상이었다. `refresh` 는 원인과 무관하게 새 쿠키로 현재 경로 전체를 서버에서 다시 받는다.
 *   로그아웃이 `replace` 뒤 `refresh` 를 부르는 것과 같은 짝이다.
 *
 * 훅이 아니라 함수다 — node 환경 테스트에서 호출 순서를 검증하려고 (docs/testing-guide.md §1).
 */
export function enterSession({ queryClient, router }: SessionEntryDeps, href: string) {
  queryClient.clear()
  router.replace(href)
  router.refresh()
}

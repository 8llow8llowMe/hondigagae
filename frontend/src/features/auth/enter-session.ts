import type { QueryClient } from '@tanstack/react-query'

type SessionEntryDeps = {
  queryClient: Pick<QueryClient, 'clear'>
  /** 호출부는 `window.location` 을 넘긴다. 주입받는 이유는 node 환경 테스트다 */
  location: Pick<Location, 'replace'>
}

/**
 * 세션이 생긴 뒤처리 — **이메일 로그인 · 소셜 로그인**. `useSessionExit` 의 짝이다.
 *
 * - `queryClient.clear()` — 이전 사용자 캐시가 남으면 다른 계정의 데이터가 보인다. 아래 이동이
 *   문서를 통째로 바꾸므로 캐시도 함께 사라지지만, 새 문서가 도착하기 전까지의 틈을 막는다.
 * - **`location.replace` — 문서 전체를 새로 받는다. `router.replace` 가 아니다** (#1075).
 *   클라이언트 라우터 캐시에는 **비로그인일 때 받은 응답**이 남아 있다. 세션이 생기는 순간
 *   그것은 전부 낡은 값인데, 캐시를 통째로 비우는 공개 API 가 없다.
 *   - route cache 는 URL → 라우트 트리를 기억한다. 비로그인으로 `/pets/new` 에 클라이언트
 *     이동하면 proxy 가 `/login?returnTo=…` 로 보내고, 캐시에는 **`/pets/new` 의 트리 = 로그인
 *     화면**으로 남는다. 그 뒤 `router.replace('/pets/new')` 는 요청 없이 이 캐시를 써서 로그인
 *     화면에 머문다 (`next/dist/client/components/segment-cache/navigation.js`
 *     `navigateUsingPrefetchedRouteTree` — 목 10/10 재현).
 *   - `router.refresh()` 로는 못 고친다. refresh 는 segment cache 만 비우고 route cache 는 그대로
 *     둔다 (`router-reducer/reducers/refresh-reducer.js` 의 주석). #1013 이 `replace` 뒤에
 *     `refresh` 를 붙인 뒤로는 그 로그인 화면을 새 쿠키로 다시 그려 "이미 로그인되어 있어요"
 *     가 떴고, 순서를 바꿔 `refresh` 를 먼저 불러도 로그인 폼에 머문다 (둘 다 목 3/3).
 *   - 새 문서는 서버가 새 쿠키로 **모든 레이아웃**을 다시 그린다. #1013 이 막으려던 "헤더가
 *     비로그인 모양으로 남는" 경우도 같은 캐시가 원인일 수 있는 자리라 함께 닫힌다.
 * - **`replace` 다 — `assign` 이 아니다.** 히스토리에 로그인 화면(소셜은 이미 소모된
 *   `?code=&state=`)이 남으면 뒤로가기로 돌아온다.
 *
 * 비용은 로그인 한 번에 문서 한 번을 새로 받는 것이다. 로그인은 세션 경계라 그 앞의 클라이언트
 * 상태를 이어 갈 이유가 없다.
 *
 * 훅이 아니라 함수다 — node 환경 테스트에서 호출 순서를 검증하려고 (docs/testing-guide.md §1).
 */
export function enterSession({ queryClient, location }: SessionEntryDeps, href: string) {
  queryClient.clear()
  location.replace(href)
}

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { HomeView } from '@/features/home/home-view'
import { paths } from '@/lib/api/paths'
import { placeListPath } from '@/lib/api/place'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { getServerQueryClient } from '@/lib/query/query-client'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { SliceResponse } from '@/types/api'
import type { PlaceSummary } from '@/types/place'
import type { PlanSummaryItem } from '@/types/plan'

export const metadata = {
  title: '혼디가개',
  description: '반려견과 함께하는 제주 여행을 설계합니다.',
}

/**
 * 홈 — 홈-세부명세 D3.
 *
 * **보호 경로가 아니다.** 미로그인도 열리고 로그인 여부로 내용이 갈린다 (공통명세 S1).
 * `proxy.ts` `PROTECTED_PATHS` 에 `/` 를 넣지 않는다 — 넣으면 첫 방문자가 로그인부터 본다.
 *
 * 프리페치는 **전부 `retry: false` + 개별 catch** 다. 한 조회가 실패해도 홈 전체가
 * 죽지 않아야 한다 (architecture-guide.md §9).
 *
 * 판정·적합도는 여기서 프리페치하지 않는다 — 기준 장소와 반려견 조건이 **클라이언트
 * localStorage 에서 결정**되므로 서버가 key 를 알 수 없다.
 */
export default async function HomePage() {
  const session = await readSession()
  const authed = session !== null

  const queryClient = getServerQueryClient()

  // 적합도 후보. 공개 API 라 미로그인도 조회한다
  const placesPromise = serverFetch<SliceResponse<PlaceSummary>>(
    placeListPath(DEFAULT_PLACE_FILTERS, null),
  ).catch(() => null)

  // 일정은 보호 리소스다. 미로그인이면 부르지 않는다
  const plansPromise =
    session === null
      ? Promise.resolve(null)
      : serverFetch<SliceResponse<PlanSummaryItem>>(paths.plans.list, {
          accessToken: session.accessToken,
        }).catch(() => null)

  const [places, plans] = await Promise.all([placesPromise, plansPromise])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeView authed={authed} places={places?.contents ?? []} plans={plans?.contents ?? []} />
    </HydrationBoundary>
  )
}

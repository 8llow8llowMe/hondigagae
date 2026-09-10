import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { Canvas } from '@/components/surface'
import { PlanListView } from '@/features/plan/plan-list-view'
import { planKeys } from '@/features/plan/queries'
import { planListPath, type PlanSlice } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parsePlanFilters } from '@/lib/url/plan-filters'

export const metadata = {
  title: `${messages.plan.pageTitle} · 혼디가개`,
  description: messages.plan.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * 여행 일정 목록 — 아트보드 `혼디가개 여행 일정.dc.html` 04(모바일) · 05(데스크톱).
 *
 * **보호 리소스다.** `GET /plans` 가 `isAuthenticated()` 라 미로그인은 화면이 성립하지
 * 않는다 — 장소·긴급 시설과 다르다.
 *
 * **필터는 프리페치 key 에 넣지 않는다.** `GET /plans` 에 좁히기 파라미터가 없어
 * 필터가 무엇이든 같은 요청이다 (공통명세 S3). 장소 목록과 갈리는 지점이다.
 */
export default async function PlansPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parsePlanFilters(await searchParams)

  const session = await readSession()
  const queryClient = getServerQueryClient()

  if (session !== null) {
    // 프리페치 실패를 화면 전체 실패로 만들지 않는다. retry: false 인 이유는
    // architecture-guide.md §9 — 서버 렌더가 재시도 백오프만큼 블로킹된다
    await queryClient
      .prefetchInfiniteQuery({
        queryKey: planKeys.list(),
        queryFn: () =>
          serverFetch<PlanSlice>(planListPath(null), { accessToken: session.accessToken }),
        initialPageParam: null as string | null,
        retry: false,
      })
      .catch(() => undefined)
  }

  /*
    데스크톱은 **좌 280 필터 레일(sticky) / 우 가변** 2단이다 (아트보드 05).
    2단은 1024+ 부터 — 280 레일에 본문을 더하면 768 에 들어가지 않아 가로 스크롤이 난다.

    **`today` 를 서버에서 만들어 내려보낸다.** 클라이언트가 따로 `new Date()` 를 부르면
    자정 근처에서 서버 렌더와 하이드레이션의 D-day 가 하루 갈릴 수 있다.

    **`main` 이 L0 바닥이다** (`DESIGN.md §0`, 이슈 #445). 장소 목록(#439)과 같은 3층 표면 —
    바닥은 전폭이어야 하므로 `Canvas` 를 `main` 에 걸고, 카드를 쌓는 일은 `PlanListView` 의
    `SurfaceStack` 이 맡는다.
  */
  return (
    <Canvas as="main" id="main-content" className="rail-layout rail-layout-filter">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PlanListView filters={filters} today={new Date()} />
      </HydrationBoundary>
    </Canvas>
  )
}

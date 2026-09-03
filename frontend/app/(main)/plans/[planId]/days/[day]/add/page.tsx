import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { PlaceFilterRail } from '@/features/place/place-filter-rail'
import { placeKeys } from '@/features/place/queries'
import { PlanAddPlaceView } from '@/features/plan/plan-add-place-view'
import { planKeys } from '@/features/plan/queries'
import { ApiError } from '@/lib/api/error'
import { placeListPath, type PlaceSlice } from '@/lib/api/place'
import { planDetailPath } from '@/lib/api/plan'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parsePlaceFilters } from '@/lib/url/place-filters'
import type { PlanDetail } from '@/types/plan'

/**
 * 일자에 담을 장소를 고르는 화면 — 세부명세 F2.
 *
 * **`loading.tsx` 를 두지 않는다.** 아래 `notFound()` 가 HTTP 상태를 바꿔야 하는데,
 * Suspense 경계가 있으면 응답이 먼저 스트리밍돼 soft 404 가 된다
 * (`plans/[planId]/page.tsx` 와 같은 이유, architecture-guide.md §7).
 *
 * 프리페치가 둘이다 — **일정 상세**(어느 일자에 무엇이 담겼는지)와 **장소 목록 첫 장**.
 * 상세는 `fetchQuery` + try/catch 라 404 를 404 로 낼 수 있고, 목록은 실패해도 화면을
 * 세우고 클라이언트가 다시 조회한다.
 */
/**
 * 보호 화면이라 크롤러가 못 들어오지만 **탭 제목은 필요하다** — `(main)` 의 다른 라우트가
 * 전부 갖고 있고, 없으면 이 화면만 `혼디가개` 로 뜬다. 일정 제목을 넣으려면 백엔드를 한 번
 * 더 불러야 해서 정적 문구로 둔다.
 */
export const metadata = {
  title: `${messages.plan.addPlacePageTitle} · 혼디가개`,
}

type Params = Promise<{ planId: string; day: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PlanAddPlacePage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { planId, day: rawDay } = await params

  /*
    **경로의 `day` 를 여기서 막는다.** 백엔드 `@PathVariable int` 라 숫자가 아니면 400 인데,
    그건 요청을 보내야 알 수 있다. 형식이 틀린 주소는 없는 페이지다.
    `1` 미만도 막는다 — `@Min(1)` 이다 (E1 규칙 5). 기간 상한은 `totalDays` 를 알아야
    해서 화면이 판단한다.
  */
  if (!/^\d+$/.test(rawDay)) notFound()
  const day = Number(rawDay)
  if (day < 1) notFound()

  const filters = parsePlaceFilters(await searchParams)

  // 보호 경로다 — `proxy.ts` 의 PROTECTED_PATHS 에 '/plans' 가 이미 있다
  const session = await readSession()

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  try {
    await queryClient.fetchQuery({
      queryKey: planKeys.detail(planId),
      queryFn: () =>
        serverFetch<PlanDetail>(planDetailPath(planId), { accessToken: session?.accessToken }),
      // 전역 기본값(5xx 2회)을 상속하면 서버 렌더가 재시도 백오프만큼 블로킹된다
      retry: false,
    })
  } catch (error) {
    // 백엔드는 **본인 소유가 아니어도 404** 다 — 화면도 존재 여부를 흘리지 않는다
    if (error instanceof ApiError && error.kind === 'not-found') notFound()
  }

  await queryClient
    .prefetchInfiniteQuery({
      queryKey: placeKeys.list(filters),
      queryFn: () => serverFetch<PlaceSlice>(placeListPath(filters, null)),
      initialPageParam: null as string | null,
      retry: false,
    })
    .catch(() => undefined)

  return (
    <main id="main-content" className="rail-layout rail-layout-filter">
      {/* 목록 화면과 같은 2단이다. 태블릿은 한 컬럼 — 280 레일을 더하면 768 을 넘는다 */}
      <div className="rail-sticky hidden lg:block">
        <PlaceFilterRail filters={filters} authed />
      </div>

      <div className="lg:border-border lg:border-l">
        {/* 모바일 필터 칩은 뷰가 제목과 목록 사이에 넣는다 — 목록 아래로 밀리면 못 쓴다 */}
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlanAddPlaceView planId={planId} day={day} filters={filters} />
        </HydrationBoundary>
      </div>
    </main>
  )
}

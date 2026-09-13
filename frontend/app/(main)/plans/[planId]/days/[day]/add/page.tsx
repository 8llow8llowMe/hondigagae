import { notFound } from 'next/navigation'

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { SkipLink } from '@/components/skip-link'
import { Canvas } from '@/components/surface'
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
import { parsePlaceFilters, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { parseViewMode, PLAN_ADD_DEFAULT_VIEW, viewModeHref } from '@/lib/url/view-mode'
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

  const resolved = await searchParams
  const filters = parsePlaceFilters(resolved)

  /*
    **이 화면의 기본 보기도 지도다** (`PLAN_ADD_DEFAULT_VIEW`, #370). 링크를 만드는 쪽과
    파싱하는 쪽에 **같은 기본값**을 넘겨야 한다 — 어긋나면 토글이 가리키는 보기와
    페이지가 그리는 보기가 달라진다.
  */
  const view = parseViewMode(resolved, PLAN_ADD_DEFAULT_VIEW)
  const basePath = `/plans/${planId}/days/${rawDay}/add`
  const filterQuery = toPlaceFilterQuery(filters)
  const listHref = viewModeHref(basePath, filterQuery, 'list', PLAN_ADD_DEFAULT_VIEW)
  const mapHref = viewModeHref(basePath, filterQuery, 'map', PLAN_ADD_DEFAULT_VIEW)

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

  /*
    **지도 보기는 레일 2단을 쓰지 않는다.** 280 레일을 함께 두면 지도가 세 번 접힌다
    (`places/(list)/page.tsx` 와 같은 판단). 필터는 패널·시트 머리가 맡고 URL 에 남아
    있으므로 목록으로 돌아가면 레일에 다시 보인다.
  */
  if (view === 'map') {
    return (
      <main id="main-content">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlanAddPlaceView
            planId={planId}
            day={day}
            filters={filters}
            view="map"
            listHref={listHref}
            mapHref={mapHref}
          />
        </HydrationBoundary>
      </main>
    )
  }

  return (
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #451). `main` 이 L0 바닥을 전폭으로 깔고, 카드를
      쌓는 일은 `PlanAddPlaceView` 의 `SurfaceStack` 이 맡는다.

      **열 구분선을 걷었다.** 2a 에서는 우측 열의 `border-left` 가 두 열을 갈랐는데,
      3a 는 **L0 바닥이 그 일을 한다** — 카드 사이·열 사이로 바닥이 비친다
      (`places/(list)/page.tsx` · 홈 #428 과 같은 이유). 선을 남기면 카드 테두리와 선이
      나란히 두 줄로 읽힌다. 선을 걷고 나면 우측 열 래퍼는 할 일이 없어 함께 걷는다 —
      뷰의 `SurfaceStack` 이 그대로 두 번째 열이 된다.
    */
    <Canvas as="main" id="main-content" className="rail-layout rail-layout-filter">
      {/*
        목록 화면과 같은 2단이다. 태블릿은 한 컬럼 — 280 레일을 더하면 768 을 넘는다.

        **`aside` 다 — `complementary` 랜드마크** (#472). 레일은 목록을 좁히는 도구이고
        본문이 아니다. 랜드마크로 내보내야 보조기기가 통째로 건너뛸 수 있다.

        **건너뛰기 링크를 레일 맨 앞에 둔다.** 전역 스킵 링크(`#main`)는 레일 **앞**으로
        보내므로 이 구간을 건너뛰지 못한다 — 키보드 사용자가 목록에 닿으려면 필터
        컨트롤을 전부 지나야 했다. `relative` 는 그 링크가 레일 좌상단에 뜨게 한다.

        **이 화면만 `h1` 을 레일 앞으로 올리지 못한다.** `/places` · `/plans` 는 페이지
        제목이 `sr-only` 라 캔버스 맨 앞으로 옮기면 그만이지만, 여기 제목(`1일차에 담을
        장소`)은 **보이는 페이지 머리**다 (#451 이 L0 위에 둔 것). 위로 옮기면 화면에서도
        레일 위로 올라간다. 그래서 이 화면의 개요는 `h2 필터` 가 `h1` 보다 먼저인 채로
        남고, 대신 **랜드마크와 건너뛰기 링크**가 그 구간을 넘게 해 준다 (#472).
      */}
      <aside
        aria-label={messages.place.filterTitle}
        className="rail-sticky relative hidden lg:block"
      >
        <SkipLink href="#plan-add-place-list">{messages.common.skipToList}</SkipLink>
        <PlaceFilterRail filters={filters} authed />
      </aside>

      {/* 모바일 필터 칩은 뷰가 제목과 목록 사이에 넣는다 — 목록 아래로 밀리면 못 쓴다 */}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PlanAddPlaceView
          planId={planId}
          day={day}
          filters={filters}
          view="list"
          listHref={listHref}
          mapHref={mapHref}
        />
      </HydrationBoundary>
    </Canvas>
  )
}

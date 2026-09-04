import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { ViewToggle } from '@/components/view-toggle'
import { filterSummaryLine } from '@/features/place/filter-summary-line'
import { PlaceFilterChips } from '@/features/place/place-filter-chips'
import { PlaceFilterRail } from '@/features/place/place-filter-rail'
import { PlaceListView } from '@/features/place/place-list-view'
import { PlaceMapView } from '@/features/place/place-map-view'
import { placeKeys } from '@/features/place/queries'
import { placeListPath, type PlaceSlice } from '@/lib/api/place'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parsePlaceFilters, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { parseViewMode, viewModeHref } from '@/lib/url/view-mode'

export const metadata = {
  title: `${messages.place.pageTitle} · 혼디가개`,
  description: messages.place.pageDescription,
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function PlacesPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams
  const filters = parsePlaceFilters(resolved)
  /*
    **공개 화면인데 로그인 여부가 필요하다** (#200). 필터의 반려견 크기 축이 내 반려견을
    기준으로 걸러서, 필터 컴포넌트가 보호 리소스(`GET /members/me/pets`)를 조회한다.
    미로그인에는 그 요청을 내지 않아야 하므로 여기서 판정해 내려보낸다 —
    `(main)/layout.tsx` 가 프리페치를 `session !== null` 로 막는 것과 같은 규칙이다.
  */
  const authed = (await readSession()) !== null
  const view = parseViewMode(resolved)
  const filterQuery = toPlaceFilterQuery(filters)
  const listHref = viewModeHref('/places', filterQuery, 'list')
  const mapHref = viewModeHref('/places', filterQuery, 'map')

  // 요청마다 새 인스턴스 — 모듈 스코프 공유는 요청 간 데이터 유출이다
  const queryClient = getServerQueryClient()

  // 프리페치 실패를 화면 전체 실패로 만들지 않는다. 실패하면 클라이언트가 재조회한다.
  //
  // retry: false 가 중요하다. 전역 기본값(5xx 2회 재시도)을 그대로 쓰면 백엔드가
  // 느리거나 죽었을 때 **서버 렌더가 재시도 백오프만큼 통째로 블로킹된다**
  // (실측: 게이트웨이 다운 시 GET /places 가 3.1초). 서버는 한 번만 시도하고
  // 실패하면 즉시 넘긴다 — 재시도는 클라이언트가 사용자 조작으로 수행한다.
  await queryClient
    .prefetchInfiniteQuery({
      queryKey: placeKeys.list(filters),
      queryFn: () => serverFetch<PlaceSlice>(placeListPath(filters, null)),
      initialPageParam: null as string | null,
      retry: false,
    })
    .catch(() => undefined)

  /*
    아트보드 `혼디가개 장소 찾기.dc.html` 03 절 — 데스크톱은 **좌 280 필터 레일(sticky) /
    우 가변** 2단이다. 레이아웃은 `.rail-layout .rail-layout-filter`(app/globals.css) 이고
    **열 구분선은 우측 열의 `border-left`** 다 (홈에서 배경 방식이 행에 가려진 전례가 있다).

    2단은 **1024+ 부터**다. 태블릿(768~1023)은 한 컬럼을 유지한다 — 280 레일에 우측 본문을
    더하면 768 에 들어가지 않아 가로 스크롤이 난다 (홈 이슈 #51 에서 실측으로 확인).
    그래서 레일은 `hidden lg:block`, 칩은 `lg:hidden` 으로 정확히 갈린다.
  */
  /*
    지도 보기는 **레일 2단 레이아웃을 쓰지 않는다.** 아트보드 05 는 지도가 바탕이고
    목록이 그 위에 얹히는 구조라, 필터 레일을 함께 두면 지도가 세 번 접힌다.
    필터는 목록과 공유하므로 URL 에 그대로 남아 있고 목록으로 돌아가면 다시 보인다.
  */
  if (view === 'map') {
    return (
      <main id="main-content">
        <h1 className="sr-only">{messages.place.pageTitle}</h1>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlaceMapView filters={filters} filterQuery={filterQuery} />
        </HydrationBoundary>
      </main>
    )
  }

  return (
    <main id="main-content" className="rail-layout rail-layout-filter">
      {/* `rail-sticky`(globals.css) — 레일이 뷰포트보다 길어도 바닥에 닿을 수 있게
          자기 스크롤을 준다. 실측: 1280×900 에서 레일 1067px 이라 실내·야외 축이 잘렸다 */}
      <div className="rail-sticky hidden lg:block">
        <PlaceFilterRail filters={filters} authed={authed} />
      </div>

      <div className="lg:border-border lg:border-l">
        {/* 좌우 여백은 `Row`(px-4 md:px-10)와 같은 값이어야 한다 — 어긋나면 제목과
            행 구분선이 다른 축에서 시작해 목록이 어긋나 보인다 (768 실렌더에서 확인) */}
        <header className="px-4 pt-5 pb-3 md:px-10 lg:pt-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-title-1 text-fg lg:text-display font-bold lg:font-extrabold">
              {messages.place.pageTitle}
            </h1>
            {/* 세 화면이 같은 세그먼트 컨트롤을 쓴다 — 아트보드 05 마지막 단락 */}
            <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
          </div>
          {/* 부제는 데스크톱에서만 — 모바일은 바로 아래 칩이 같은 것을 보여준다 */}
          <p className="text-caption text-fg-muted mt-1 hidden font-medium lg:block">
            {filterSummaryLine(filters)}
          </p>
        </header>

        <div className="lg:hidden">
          <PlaceFilterChips filters={filters} authed={authed} />
        </div>

        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlaceListView filters={filters} />
        </HydrationBoundary>
      </div>
    </main>
  )
}

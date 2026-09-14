import { dehydrate, HydrationBoundary } from '@tanstack/react-query'

import { SkipLink } from '@/components/skip-link'
import { Canvas, Surface, SurfaceStack } from '@/components/surface'
import { ViewToggle } from '@/components/view-toggle'
import { filterSummaryLine } from '@/features/place/filter-summary-line'
import { PlaceFilterChips } from '@/features/place/place-filter-chips'
import { PlaceFilterRail } from '@/features/place/place-filter-rail'
import { PlaceListView } from '@/features/place/place-list-view'
import { PlaceMapView } from '@/features/place/place-map-view'
import { PlaceSearchField } from '@/features/place/place-search-field'
import { placeKeys } from '@/features/place/queries'
import { placeListPath, type PlaceSlice } from '@/lib/api/place'
import { serverFetch } from '@/lib/api/server'
import { readSession } from '@/lib/auth/session'
import { messages } from '@/lib/messages'
import { getServerQueryClient } from '@/lib/query/query-client'
import { parsePlaceFilters, toPlaceFilterQuery } from '@/lib/url/place-filters'
import { parseViewMode, PLACES_DEFAULT_VIEW, viewModeHref } from '@/lib/url/view-mode'

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
  /*
    **이 화면의 기본 보기는 지도다** (`PLACES_DEFAULT_VIEW`). 그래서 `/places` 가 지도이고
    목록이 `?view=list` 로 붙는다 — 링크를 만드는 쪽과 파싱하는 쪽에 **같은 기본값**을
    넘겨야 한다. 어긋나면 토글이 가리키는 보기와 페이지가 그리는 보기가 달라진다.
  */
  const view = parseViewMode(resolved, PLACES_DEFAULT_VIEW)
  const filterQuery = toPlaceFilterQuery(filters)
  const listHref = viewModeHref('/places', filterQuery, 'list', PLACES_DEFAULT_VIEW)
  const mapHref = viewModeHref('/places', filterQuery, 'map', PLACES_DEFAULT_VIEW)

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
          {/* 보기 전환 링크를 페이지가 만든다 — 지도 컴포넌트가 '/places' 를 알 이유가 없다 */}
          <PlaceMapView
            filters={filters}
            authed={authed}
            searchable
            listHref={listHref}
            mapHref={mapHref}
          />
        </HydrationBoundary>
      </main>
    )
  }

  return (
    /*
      **3층 표면** (`DESIGN.md §0`, 이슈 #439). `main` 이 L0 바닥을 전폭으로 깔고,
      목록이 L1 카드 하나가 된다.

      **열 구분선을 걷었다.** 2a 에서는 우측 열의 `border-left` 가 두 열을 갈랐는데,
      3a 는 **L0 바닥이 그 일을 한다** — 카드 사이·열 사이로 바닥이 비친다. 홈(#428)이
      같은 이유로 걷었다. 선을 남기면 카드 테두리와 선이 나란히 두 줄로 읽힌다.
    */
    <Canvas as="main" id="main-content" className="rail-layout rail-layout-filter">
      {/* `rail-column`(globals.css) — 화면 높이가 `100dvh - 헤더` 로 못박힌 열이고,
          스크롤은 그 안의 카드(`.filter-rail`)가 갖는다. 레일이 뷰포트보다 길어도 바닥에
          닿을 수 있어야 한다 — 1280×900 실측에서 레일 1067px 이라 실내·야외 축이 잘렸다 */}
      {/*
        **`h1` 이 문서의 첫 제목이다** (#472). 예전에는 이것이 목록 카드와 같은 열 안에
        있어, 제목으로 탐색하면 개요가 `h2 필터` → `h3` 셋 → **`h1` 장소 찾기** 순서였다 —
        이 화면에 처음 온 사람이 "여기가 어디인가" 를 알기 전에 필터 하위 항목 셋을 먼저
        지났고, 페이지 제목보다 상위처럼 보이는 `h2` 가 그 앞에 있었다.

        **여기 남는 것은 `sr-only` 사본이다** (#531). 보이는 제목은 아래 제목 줄로 내려갔는데,
        그것은 우측 열 안이라 다시 레일 **뒤**가 된다 — `h1` 을 레일 앞에 두려고 #472 가
        만든 자리를 그대로 지키고, 눈에 보이는 쪽만 열 안에서 따로 그린다.
        `aria-hidden` 으로 보이는 제목을 접근성 트리에서 빼 이름이 두 번 들리지 않게 한다.
      */}
      <h1 className="sr-only">{messages.place.pageTitle}</h1>

      {/*
        **`aside` 다 — `complementary` 랜드마크** (#472). 레일은 목록을 좁히는 도구이고
        본문이 아니다. 랜드마크로 내보내야 보조기기가 통째로 건너뛸 수 있다.

        **건너뛰기 링크를 레일 맨 앞에 둔다.** 전역 스킵 링크(`#main`)는 레일 **앞**으로
        보내므로 이 구간을 건너뛰지 못한다 — 키보드 사용자가 목록에 닿으려면 필터
        컨트롤을 전부 지나야 했다. `relative` 는 그 링크가 레일 좌상단에 뜨게 한다.
      */}
      <aside
        aria-label={messages.place.filterTitle}
        className="rail-column relative hidden lg:block"
      >
        <SkipLink href="#place-list">{messages.common.skipToList}</SkipLink>
        <PlaceFilterRail filters={filters} authed={authed} />
      </aside>

      {/*
        **우측 열은 카드 하나다** (#556). 예전에는 제목 줄 · 검색 · 칩 · 목록 넷이 바닥 위에
        따로 서 있었다. 제목과 도구가 카드 머리로 들어가고 목록만 본문에 남는다 —
        §0 의 "도구는 카드 밖" 이 "도구는 머리, 결과는 본문" 으로 바뀐다
        (`Surface` 머리주석의 `fill` 절이 정본이다).
      */}
      <SurfaceStack id="place-list" tabIndex={-1} className="list-column">
        {/*
          **보이는 제목은 카드의 `h2` 다.** 진짜 `h1` 은 위 캔버스 맨 앞의 `sr-only` 사본이고
          (#472 가 레일보다 앞에 두려고 만든 자리), 여기에 `h1` 을 두면 DOM 에서 레일 **뒤**라
          #472 가 고친 개요가 도로 깨진다 — `H2:필터 → H3 셋 → H1:장소 찾기`.

          보조기기에서 "장소 찾기" 가 h1·h2 로 두 번 들린다. `/plans` 가 이미 같은 방식이고
          (#445), #531 이 쓰던 `p aria-hidden` 사본은 제목이 카드 밖일 때만 필요했다.
        */}
        <Surface
          fill
          titleId="place-list-heading"
          title={messages.place.pageTitle}
          /* 부제는 데스크톱에서만 — 모바일은 아래 칩이 같은 것을 보여준다 */
          description={
            <p className="text-caption text-fg-muted hidden font-medium lg:block">
              {filterSummaryLine(filters)}
            </p>
          }
          /* 네 화면이 같은 세그먼트 컨트롤을 쓴다 — 아트보드 05 마지막 단락 */
          trailing={
            <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
          }
          /*
            **검색과 칩이 머리 안이다** (#556). 둘 다 목록을 좁히는 도구이고, `fill` 머리는
            고정이라 목록을 내려가도 "무엇으로 좁히고 있었는지" 가 화면에 남는다 — 예전에는
            열 전체가 굴러 검색이 위로 사라졌다.

            **검색은 모든 폭에서 같은 자리다** (#431). 칩은 `lg:hidden` 이고 레일이 1024
            이상을 맡지만, 레일에는 검색을 두지 않았다 — 그러면 같은 도구가 폭에 따라 다른
            곳에 서고, 좁은 화면에서는 칩 줄 위에 또 하나가 생긴다.
          */
          tools={
            <>
              <PlaceSearchField filters={filters} />
              <PlaceFilterChips filters={filters} authed={authed} className="lg:hidden" />
            </>
          }
        >
          <HydrationBoundary state={dehydrate(queryClient)}>
            <PlaceListView filters={filters} />
          </HydrationBoundary>
        </Surface>
      </SurfaceStack>
    </Canvas>
  )
}

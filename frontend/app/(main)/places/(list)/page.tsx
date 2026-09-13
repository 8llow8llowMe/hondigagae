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
          <PlaceMapView filters={filters} authed={authed} listHref={listHref} mapHref={mapHref} />
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
      {/* `rail-sticky`(globals.css) — 레일이 뷰포트보다 길어도 바닥에 닿을 수 있게
          자기 스크롤을 준다. 실측: 1280×900 에서 레일 1067px 이라 실내·야외 축이 잘렸다 */}
      {/*
        **`h1` 이 문서의 첫 제목이다** (#472). 예전에는 이것이 목록 카드와 같은 열 안에
        있어, 제목으로 탐색하면 개요가 `h2 필터` → `h3` 셋 → **`h1` 장소 찾기** 순서였다 —
        이 화면에 처음 온 사람이 "여기가 어디인가" 를 알기 전에 필터 하위 항목 셋을 먼저
        지났고, 페이지 제목보다 상위처럼 보이는 `h2` 가 그 앞에 있었다.

        **보이는 제목은 여전히 카드의 `h2` 다** (§0). `sr-only` 라 자리를 차지하지 않는다 —
        `position: absolute` 이므로 grid 트랙도 만들지 않는다 (실측으로 확인).
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
        className="rail-sticky relative hidden lg:block"
      >
        <SkipLink href="#place-list">{messages.common.skipToList}</SkipLink>
        <PlaceFilterRail filters={filters} authed={authed} />
      </aside>

      <SurfaceStack id="place-list" tabIndex={-1}>
        {/*
          **모바일 칩은 카드 밖이다.** 칩은 목록을 좁히는 **도구**이고 카드는 그 결과를
          담는다 — §0 의 카드 판정 3문에서 ① 자기 제목이 없고 ③ 축이 하나뿐이라 걸린다.

          **데스크톱 레일은 반대로 카드다** (#535). 같은 필터인데 갈리는 이유는 판정 3문의
          답이 갈리기 때문이다 — 레일은 자기 제목(`h2 필터`)이 있고 축을 셋 이상 담으며
          `complementary` 랜드마크로 혼자 선다. 칩 한 줄은 그 셋 다 아니다.
        */}
        {/*
          **검색은 모든 폭에서 같은 자리다** (#431). 필터 칩은 `lg:hidden` 이고 레일이
          1024 이상을 맡지만, 레일에는 검색을 두지 않았다 — 그러면 같은 도구가 폭에 따라
          다른 곳에 서고, 좁은 화면에서는 칩 줄 위에 또 하나가 생긴다.

          **카드 밖인 것은 칩과 같은 이유다** — 검색은 목록을 좁히는 도구이고 카드는 그
          결과를 담는다.
        */}
        <PlaceSearchField filters={filters} />

        <div className="lg:hidden">
          <PlaceFilterChips filters={filters} authed={authed} />
        </div>

        {/*
          **페이지 제목이 카드 제목으로 들어왔다** (§0 "섹션 제목은 섹션 안에 있다").
          이 화면의 카드는 하나뿐이고 그 카드의 이름이 곧 페이지의 이름이라, 밖에 두면
          제목만 바닥 위에 떠 어느 묶음의 제목인지 모호해진다.

          그래서 **보이는 제목은 카드의 `h2`** 이고, 페이지의 `h1` 은 `sr-only` 로 남긴다 —
          **이 라우트의 지도 갈래(위)와 `emergency` 가 이미 쓰는 방식이다.** 두 갈래가 같은
          `h1` 을 내야 보기 전환이 문서 구조를 바꾸지 않는다.

          보조기기에서 "장소 찾기" 가 h1·h2 로 두 번 들린다. `Surface` 에 제목 레벨 prop 을
          더하면 없앨 수 있지만 **그러면 한 규칙에 두 경로가 생긴다** — 홈은 `sr-only` h1
          방식이고, 추측으로 만든 API 를 아무 화면도 검증하지 않는 것이 #422 에서
          프리미티브 넷을 걷은 이유다. 필요해지는 화면이 나오면 그때 만든다.
        */}
        <Surface
          lead
          titleId="place-list-heading"
          title={messages.place.pageTitle}
          /* 부제는 데스크톱에서만 — 모바일은 위의 칩이 같은 것을 보여준다 */
          description={
            <p className="text-caption text-fg-muted hidden font-medium lg:block">
              {filterSummaryLine(filters)}
            </p>
          }
          /* 세 화면이 같은 세그먼트 컨트롤을 쓴다 — 아트보드 05 마지막 단락 */
          trailing={
            <ViewToggle current="list" listHref={listHref} mapHref={mapHref} variant="icon" />
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

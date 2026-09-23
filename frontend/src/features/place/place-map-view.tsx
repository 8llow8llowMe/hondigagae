'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import type { ReactNode } from 'react'

import { EmptyState } from '@/components/empty-state'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from '@/components/icons'
import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { ViewToggle } from '@/components/view-toggle'
import type { MapPin } from '@/features/map/map-canvas'
import { MapLocateButton } from '@/features/map/map-locate-button'
import { PlaceListSection, type PlaceListSectionProps } from '@/features/place/place-list-section'
import { PlaceMapFilterBar } from '@/features/place/place-map-filter-bar'
import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { PlaceSearchField } from '@/features/place/place-search-field'
import { useNearbyPlaces } from '@/features/place/use-nearby-places'
import { usePlaceList } from '@/features/place/use-place-list'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { type LatLng, SELECTED_PLACE_MAP_LEVEL, toLatLng } from '@/lib/geo/coord'
import { getCurrentPosition } from '@/lib/geo/current-position'
import { shouldOfferResearch } from '@/lib/map/research-offer'
import type { MapSdkFailure } from '@/lib/map/sdk'
import {
  boundsCenter,
  boundsRadiusMeters,
  isSameViewport,
  isWithinBounds,
  type MapBounds,
} from '@/lib/map/viewport'
import { visibleCountLabel } from '@/lib/map/visible-count'
import { messages } from '@/lib/messages'
import { INSET_CLASS } from '@/lib/ui/inset'
import { cn } from '@/lib/utils/cn'
import type { PlaceFilters, PlaceSummary } from '@/types/place'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 장소 찾기 — 지도 보기.
 *
 * 아트보드 `혼디가개 장소 찾기` 05(데스크톱) · 06(모바일).
 *
 * **데이터 출처가 둘이고 갈리는 조건이 명확하다.**
 *  - 처음 들어오면 **목록 캐시를 재사용**한다 (architecture-guide.md §9 "지도 뷰: 별도
 *    조회 금지"). 목록에서 보던 것과 지도에서 보는 것이 달라지면 안 된다.
 *  - 사용자가 **"이 지역에서 재검색" 을 누르면** `GET /places/nearby` 로 갈아탄다.
 *
 * **지도를 옮겼다고 스스로 재조회하지 않는다** (#396 의 규칙을 이 화면에도 들였다).
 * 예전에는 `idle` 마다 나갔고, 그 전제가 **한 곳을 골라 확대하는 조작**에서 깨졌다 —
 * 확대는 우리가 그 핀으로 옮겨 준 결과인데 그때마다 목록이 다시 조회돼 방금 보던 결과가
 * 사라졌다. 이제 지도 조작은 버튼을 띄울 뿐이고, 목록도 **조회한 자리**(`searchedBounds`)
 * 를 세므로 팬·줌·선택 어느 것도 목록을 흔들지 않는다.
 *
 * **지도가 유일한 전달 수단이 아니다** (이슈 #14 완료 조건). SDK 가 실패하면 목록을
 * 그대로 그리고 위에 안내 한 줄을 둔다.
 */
export function PlaceMapView({
  filters,
  authed,
  fill = false,
  searchable = false,
  listHref,
  mapHref,
  renderRowAction,
  renderRowNotice,
  mutedPlaceIds,
  renderListRow,
  sheetMaxTopInset,
  panelTopInset,
}: {
  filters: PlaceFilters
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 필터의 크기 축이 빠진다 (#200) */
  authed: boolean
  /**
   * `true` 면 **부모가 높이를 정한다.** 위에 헤더가 붙는 화면(담기, #370)이 쓴다.
   * `false`(기본)면 스스로 `map-canvas-height` 로 뷰포트를 채운다.
   */
  fill?: boolean | undefined
  /**
   * 지도 위·패널·폴백에 이름·주소 검색을 그린다 (#596). **기본은 끔이다.**
   *
   * `/places` 만 켠다. 담기 화면(#370)은 **목록 갈래에도 검색이 없어서**, 지도에만 켜면
   * 같은 화면의 두 보기가 다른 도구를 갖는다 — 그 화면에 검색을 들일지는 별개 판단이라
   * 여기서 슬쩍 결정하지 않는다.
   */
  searchable?: boolean | undefined
  /**
   * 지도 우상단에 떠 있는 보기 전환의 목적지. **둘 다 있어야 토글을 그린다.**
   * 헤더가 토글을 갖는 화면은 주지 않는다 — 같은 컨트롤이 두 개 뜨면 안 된다.
   *
   * 예전에는 이 컴포넌트가 `'/places'` 를 하드코딩해 링크를 만들었다. 그래서 다른
   * 화면이 이 지도를 쓰면 토글이 남의 화면으로 보냈다 (#370).
   */
  listHref?: string | undefined
  mapHref?: string | undefined
  /** 패널·시트 행의 액션 열. 담기 버튼이 여기 온다 */
  renderRowAction?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 행 아래 전폭 줄. 담기 실패 알림이 여기 온다 */
  renderRowNotice?: ((place: PlaceSummary) => ReactNode) | undefined
  /** 핀 톤을 낮출 장소들. 담기 화면은 "이미 담은 곳" 을 넘긴다 */
  mutedPlaceIds?: ReadonlySet<string> | undefined
  /** SDK 실패 폴백의 행. 주지 않으면 상세로 가는 기본 행이다 */
  renderListRow?: PlaceListSectionProps['renderRow'] | undefined
  /**
   * 모바일 시트를 끝까지 올렸을 때 비워 둘 상단 높이(px). 주지 않으면 기본 상한이다.
   *
   * **헤더가 정상 흐름인 화면(담기, #370)이 자기 헤더 높이를 알려 준다.** 이 컴포넌트는
   * 위에 무엇이 얹히는지 모르고, 시트 기본 상한(`85dvh`)은 상단 컨트롤이 `absolute` 로
   * 떠 있는 `/places` 기준이라 그런 화면에서는 헤더를 통째로 덮는다.
   */
  sheetMaxTopInset?: number | undefined
  /**
   * 데스크톱 좌측 패널의 위 여백(px). 주지 않으면 기본 24(`top-6`)다.
   *
   * **위에 떠 있는 것이 있는 화면이 자기 높이를 알려 준다** (#556). 담기 지도는 뒤로가기와
   * 제목을 같은 기둥(`left-4`) 위에 띄우므로 패널이 그만큼 내려와야 겹치지 않는다 —
   * `sheetMaxTopInset` 이 모바일 시트에 대해 하는 일과 같은 축이다.
   */
  panelTopInset?: number | undefined
}) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  /*
    **지금 목록이 대응하는 지도 영역.** 첫 `idle` 에 한 번 놓이고, 그 뒤로 이 값을 옮기는
    것은 **"이 지역에서 재검색" 버튼뿐**이다 (#396 의 규칙을 이 화면에도 들였다).

    예전에는 `movedBounds` 였고 `idle` 마다 갱신되며 **스스로 재조회**했다. 그래서 한
    장소를 눌러 확대하거나 화면을 조금만 옮겨도 그 프레임 기준으로 목록을 다시 불러와,
    방금 보던 결과가 통째로 갈렸다 — 조회를 시킨 적이 없는데 목록이 흔들린다.

    **목록 필터의 기준도 이것이다** (`bounds` 가 아니다). 그래서 지도를 옮기거나 한 곳을
    골라 확대해도 목록·핀이 그대로 남는다 — `/emergency` 가 선택 순간에만 `frozenBounds`
    로 얼려 두는 일을, 이 화면은 이 하나로 항상 한다.
  */
  const [searchedBounds, setSearchedBounds] = useState<MapBounds | null>(null)
  /*
    재검색을 한 번이라도 눌렀는가 — **목록 캐시 ↔ 주변 조회를 가르는 유일한 스위치**다.

    처음에는 목록 캐시를 재사용한다 (architecture-guide.md §9 "지도 뷰: 별도 조회 금지").
    `searchedBounds` 만으로는 이 둘을 가를 수 없다 — 첫 `idle` 에도 값이 들어오기 때문에
    그것으로 조회를 켜면 들어오자마자 프리페치한 캐시를 버린다.
  */
  const [researched, setResearched] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetStop, setSheetStop] = useState<SheetStop>('mid')
  const [panelOpen, setPanelOpen] = useState(true)
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)
  /** 밖에서 지도 중심을 옮길 때만 값이 든다 (현재 위치 버튼) */
  const [center, setCenter] = useState<LatLng | null>(null)
  /** 현재 위치가 제주 안인가. 알기 전까지는 `false` 라 버튼이 나중에 나타난다 */
  const [inJeju, setInJeju] = useState(false)

  /*
    ── 현재 위치 ────────────────────────────────────────────────────────────

    **버튼을 그릴지 정하기 위해 먼저 묻는다.** 제주 밖에서는 눌러도 갈 곳이 없어
    (`lib/geo/jeju-bounds.ts`) 버튼 자체를 두지 않는데, 그 판정에 좌표가 필요하다.
    `getCurrentPosition()` 은 제주 밖 좌표를 `fallback` 으로 내려주므로 `granted` 하나로
    "제주 안" 을 판정할 수 있다 — 화면이 경계 상자를 다시 알 필요가 없다.

    홈(#180)·긴급 시설이 이미 같은 자리(마운트)에서 같은 함수를 부른다. 여기서 다른
    시점에 물으면 브라우저 권한 프롬프트가 화면마다 다른 순간에 뜬다.
  */
  useEffect(() => {
    void getCurrentPosition().then((result) => setInJeju(result.kind === 'granted'))
  }, [])

  /*
    **누를 때마다 다시 묻는다.** 마운트 때 받은 좌표를 재사용하면 사용자가 이동한 뒤
    누른 "내 위치" 가 옛 자리를 가리킨다. 매번 새 객체가 나오므로 같은 좌표를 두 번
    눌러도 `MapCanvas` 의 중심 effect 가 다시 돈다.
  */
  const locate = useCallback(() => {
    void getCurrentPosition().then((result) => {
      const granted = result.kind === 'granted'
      setInJeju(granted)
      if (granted) setCenter({ lat: result.lat, lng: result.lng })
    })
  }, [])

  const listQuery = usePlaceList(filters)
  const listPlaces = useMemo(
    () => (listQuery.data === undefined ? [] : mergeSlices(listQuery.data.pages)),
    [listQuery.data],
  )

  const searchCenter = searchedBounds === null ? null : boundsCenter(searchedBounds)
  const searchRadius = searchedBounds === null ? 0 : boundsRadiusMeters(searchedBounds)
  /*
    **조회 시점을 사용자가 쥔다** (#396 의 규칙을 이 화면에도 들였다). 예전에는 `idle`
    마다 자동으로 나갔고(#240 에서 체크박스를 걷으며 "지도를 옮기는 것이 곧 '여기를 보여
    줘' 다" 로 정리했다), 그 전제가 **한 곳을 골라 확대하는 조작**에서 깨졌다 — 확대는
    사용자가 "다른 지역을 보겠다" 고 한 것이 아니라 우리가 그 핀으로 옮겨 준 결과인데,
    그때마다 좁아진 프레임으로 목록이 다시 조회돼 방금 보던 결과가 사라졌다.

    이제 지도 조작은 **버튼을 띄울 뿐**이고, 조회는 누를 때만 나간다.
  */
  const nearbyQuery = useNearbyPlaces(searchCenter, searchRadius, filters, researched)

  const usingNearby = nearbyQuery.data !== undefined
  const places: PlaceSummary[] = useMemo(
    () => (usingNearby ? (nearbyQuery.data?.places.map((entry) => entry.place) ?? []) : listPlaces),
    [usingNearby, nearbyQuery.data, listPlaces],
  )

  /*
    **마지막으로 조회한 영역** 안에 든 것만 목록에 남긴다.

    **지금 보고 있는 `bounds` 가 아니다.** 그러면 지도를 옮기거나 한 곳을 골라 확대하는
    것만으로 목록이 줄어, 재조회를 막아도 "목록이 흔들린다" 는 문제가 그대로 남는다 —
    `/emergency` 가 선택 순간에 `frozenBounds` 로 얼려 막는 것과 같은 결함이다.
    이 화면은 조회 자리가 곧 목록의 자리라, 그 하나로 항상 얼려 둔다.

    영역이 옮겨 갔다는 사실은 캡션(`countLine`)과 재검색 버튼이 말한다.
  */
  const visible = useMemo(() => {
    if (searchedBounds === null) return places

    return places.filter((place) => {
      const coord = toLatLng(place)
      // 좌표가 없는 곳은 지도가 판단할 수 없다. 숨기지 않고 남긴다 —
      // 목록으로도 같은 정보에 도달할 수 있어야 한다 (이슈 #14 완료 조건)
      return coord === null || isWithinBounds(searchedBounds, coord)
    })
  }, [places, searchedBounds])

  /*
    **내용이 같으면 같은 Set 으로 취급한다.** `mutedPlaceIds` 는 참조 동등성으로만
    메모 판정에 들어가는데, 호출부가 매 렌더 새 `Set` 을 만들면(담기 화면이 그렇다 —
    `placeIdsOf` 를 조건부 return 뒤에서 부르므로 useMemo 로 감쌀 수 없다) `pins` 가
    매 렌더 새 배열이 되고 `MapCanvas` 가 오버레이를 전부 지웠다 다시 그린다. 무관한
    리렌더마다 지도 위 핀이 통째로 깜빡인다.

    "안정된 참조로 넘겨라" 를 호출부 계약으로 두지 않는 이유는 그 계약이 호출부에서
    보이지 않기 때문이다 — 다음 소비자가 또 밟는다. `placeId` 는 숫자 문자열이라
    쉼표로 이어 붙여도 안전하다.
  */
  const mutedKey = mutedPlaceIds === undefined ? '' : [...mutedPlaceIds].sort().join(',')
  const mutedIds = useMemo(() => new Set(mutedKey === '' ? [] : mutedKey.split(',')), [mutedKey])

  const pins: MapPin[] = useMemo(
    () =>
      visible.map((place) => ({
        id: place.placeId,
        title: place.title,
        lat: place.lat,
        lng: place.lng,
        /*
            **이미 담은 곳은 톤을 낮춘다** (#370). 훑어볼 때 항상 보이는 채널이 이것뿐이다 —
            `caption` 은 선택됐을 때만 라벨에 붙고, `MapCanvas` 는 마커에 판정 색을 쓰지
            않는다는 규약이 있다. 긴급 시설의 약국이 쓰던 표현을 그대로 재사용한다.
          */
        muted: mutedIds.has(place.placeId),
      })),
    [visible, mutedIds],
  )

  const handleBounds = useCallback((next: MapBounds, userMoved: boolean) => {
    setBounds(next)

    /*
      **첫 영역이 목록의 기준 자리가 된다 — 조회는 하지 않는다.** 들어오자마자 주변
      검색으로 갈아타면 프리페치한 목록 캐시를 버리게 되고, 첫 화면이 반경 밖이라
      비어 보인다 (실제로 그랬다). 그래서 `researched` 는 건드리지 않는다.

      그 뒤의 `idle` 은 **`bounds` 만** 옮긴다 — 재검색을 권할지 판단하고 캡션 문구를
      고르는 데만 쓰인다. `searchedBounds` 를 옮기는 것은 버튼뿐이다.
    */
    if (!userMoved) setSearchedBounds(next)
  }, [])

  /**
   * "이 지역에서 재검색" — 지금 보이는 영역을 조회 자리로 삼는다.
   *
   * **`bounds` 를 그대로 커밋한다.** 중심만 옮기고 반경을 두는 `/emergency` 와 다른데,
   * 그 화면의 반경은 URL 이 소유하는 칩 값이고 이 화면의 반경은 화면에서 역산하기
   * 때문이다 — 축소해 두고 누른 사람은 "더 넓게 찾아 줘" 라고 한 것이다.
   */
  const researchHere = useCallback(() => {
    if (bounds === null) return

    setSearchedBounds(bounds)
    setResearched(true)
  }, [bounds])

  // ── SDK 실패 → 목록으로 되돌리고 안내 한 줄 ──────────────────────────────
  if (failure !== null) {
    return (
      /*
        **바닥을 탭바만큼 비운다.** 폴백 목록은 부모의 고정 높이 껍데기(`map-canvas-height`)를
        넘쳐 흐르는데, 그 상태에서는 `main` 의 탭바 여백이 먹지 않는다(실측 `margin-block-end`
        0px). 375×812 담기 화면에서 마지막 행의 `담기` 버튼이 44px 중 **21px 만 남았다** —
        탭바에 반이 먹힌 것이라 하한 규칙과 무관하게 눌리지 않는다. **폴백 갈래에만 건다** — 지도가 정상으로 뜨는
        갈래는 시트가 `fixed` 라 이 문제가 없고, 거기 걸면 지도 높이만 줄어든다.
      */
      <div className="pb-tabbar">
        {/* 안내 한 줄 — 배너(링크형)가 아니다. 갈 곳이 없고 알릴 사실만 있다 */}
        <p
          role="status"
          className="text-caption text-fg-muted bg-bg-sunken border-border border-b px-4 py-3 font-medium md:px-10"
        >
          {failureMessage(failure)}
        </p>

        {/*
          **폴백에도 검색이 남는다** (#596). 이 갈래에는 필터 칩도 `초기화` 도 없어
          (`onResetFilters` 가 no-op 다), 검색을 빼면 `?keyword=` 를 달고 들어온 사용자가
          그것을 지울 길이 화면에서 사라진다. 카카오 키 도메인이 안 맞을 때 **항상** 오는
          경로라 예외가 아니다.

          카드 없는 페이지라 인셋은 위 안내 줄·아래 목록과 같은 `main` 이다.
        */}
        {searchable && (
          <PlaceSearchField
            filters={filters}
            id="place-keyword-fallback"
            className={cn('flex items-start gap-2 py-3', INSET_CLASS.main)}
          />
        )}

        <PlaceListSection
          /*
            폴백 목록은 카드가 아니라 페이지 위다 — 카드 인셋 20 을 쓰면 위 안내 줄(40)과
            어긋난다. 카드가 없으니 `headingLevel` 도 기본값 `2` 그대로 둔다 (#456①).
          */
          inset="main"
          places={listPlaces}
          loading={listQuery.isPending}
          errorStatus={toErrorStatus(listQuery.error)}
          errorMessage={
            listQuery.error instanceof ApiError ? listQuery.error.rawMessage : undefined
          }
          /* 0건이면 무엇으로 찾았는지 되돌려 준다 — 목록 갈래가 같은 prop 을 넘긴다 */
          keyword={filters.keyword}
          hasNext={listQuery.data?.pages.at(-1)?.hasNext ?? false}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onRetry={() => void listQuery.refetch()}
          onResetFilters={() => undefined}
          {...(renderListRow === undefined ? {} : { renderRow: renderListRow })}
        />
      </div>
    )
  }

  /*
    **지도가 조회 자리에서 벗어났으면 "지도에 보이는" 이라고 말하지 않는다.** 목록은
    `searchedBounds` 를 세는데 화면은 다른 곳을 보고 있어, 그대로 두면 캡션이 화면과
    다른 것을 주장한다. 개수 자체는 그대로 참이라 숫자는 두고 문구만 바꾼다 —
    `/emergency` 가 선택·stale 구간에서 쓰는 것과 같은 함수다 (`lib/map/visible-count.ts`).

    `isSameViewport` 는 둘 중 하나가 `null` 이면 `false` 다 — 첫 `idle` 전에는 영역
    필터가 아예 걸리지 않으므로 그때도 "목록 N곳" 이 맞다.
  */
  const countLine = visibleCountLabel(visible.length, !isSameViewport(searchedBounds, bounds))
  /*
    조회한 자리에서 충분히 벗어났을 때만 재검색을 권한다 (#396). 판정은
    `shouldOfferResearch` 순수 함수가 갖는다 — 임계값이 반경에 비례한다.

    **`originScreenRadius` 를 넘긴다.** 이 화면은 조회 반경을 화면에서 역산하므로
    축소가 곧 "더 넓게 찾아 줘" 다 — 중심이 한 픽셀도 안 움직여도 재조회할 이유가
    생긴다. 반경이 URL 소유인 `/emergency` 는 이 갈래를 켜지 않는다.

    **`suppressed` 가 늘 `false` 다.** 그 인자는 "우리가 카메라를 옮겨 놓고 그 결과를
    아직 재지 못한 구간" 을 막는 것인데, 이 화면은 목록이 `searchedBounds` 를 세므로
    선택-확대가 목록을 흔들지 못한다 — 막을 이유가 없다.
  */
  const offerResearch = shouldOfferResearch({
    bounds,
    origin: searchCenter,
    radius: searchRadius,
    suppressed: false,
    originScreenRadius: searchRadius,
  })
  /** 둘 다 있을 때만 그린다 — 헤더가 토글을 갖는 화면은 주지 않는다 */
  const showToggle = listHref !== undefined && mapHref !== undefined

  return (
    /*
        **높이를 여기서 잡는다.** `map-canvas-height` 는 뷰포트를 정확히 다 쓰므로
        (`calc(100dvh - --header-h - --tabbar-h)`), 캔버스에 걸어 둔 채 위에 헤더를 얹으면
        그 높이만큼 넘쳐 지도 화면에 세로 스크롤이 난다. `fill` 이면 부모가 정한 높이를
        채우고, 아니면 예전처럼 스스로 뷰포트를 채운다 — `/places` 는 픽셀이 같다.
      */
    <div className={cn('relative', fill ? 'h-full' : 'map-canvas-height')}>
      {/* 지도가 바탕이다. 데스크톱은 좌측 패널이 그 위에 얹힌다 (아트보드 05) */}
      <MapCanvas
        pins={pins}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onBoundsChange={handleBounds}
        center={center}
        /* 카드를 누르면 그 핀으로 옮기고 동네가 보이는 단계까지 확대한다 */
        selectedLevel={SELECTED_PLACE_MAP_LEVEL}
        onFailure={setFailure}
        className="h-full w-full"
      />

      {/*
        **"이 지역에서 재검색" — 지도 하단 중앙** (#396). `/emergency` 와 **같은 문구 ·
        같은 모양 · 같은 자리**다 (`messages.map.researchHere`) — 두 지도 화면에서 같은
        일을 하는 컨트롤이 다르게 생기면 안 된다. 근거와 실측은 `emergency-map-view.tsx`
        의 같은 자리에 있다.

        세로 자리는 `.map-research-offset`(globals.css)이 갖는다 — 모바일 시트 최소
        단계를 피해야 해서 그 계산이 CSS 에 있다.
      */}
      {offerResearch && (
        <div className="map-research-offset absolute inset-x-0 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={researchHere}
            className="text-body-2 bg-bg text-fg border-border hover:bg-band focus-visible:ring-brand-500 inline-flex h-11 max-w-full items-center gap-2 rounded-full border px-5 font-semibold whitespace-nowrap shadow-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <SearchIcon size={16} />
            {messages.map.researchHere}
          </button>
        </div>
      )}

      {/*
        ── 지도 우상단 컨트롤 ──────────────────────────────────────────────

        **여백이 목록 보기의 헤더와 정확히 같다.** 목록은 `px-4 pt-5 md:px-10 lg:pt-6`
        안에서 제목 오른쪽에 같은 토글을 두는데, 지도가 `top-3 right-3` 이던 탓에 두 보기를
        번갈아 누르면 버튼이 매번 자리를 옮겼다 — 같은 컨트롤이면 같은 자리에 있어야 한다.

        **그 정렬이 1440 위에서 다시 깨져 있었다** (#412). `--content-max`(#376) 가 들어온
        뒤 목록 헤더는 1440 컨테이너 안에 서는데 **지도는 전폭이라 뷰포트 끝을 잡았다**
        (DESIGN.md §7-1 — 지도만 `.rail-layout` 에 가입하지 않는다). 1920 실측으로
        목록 right 1637 · 지도 right 1880, **243px** 벌어졌다 — 정확히 `(1920−1440)/2` 다.
        그래서 뷰포트가 아니라 **콘텐츠 열의 오른쪽 끝**에 매단다. 1440 이하에서는
        `.content-container` 가 전폭이라 예전과 같은 자리(16 / 40)다.

        **`pointer-events-none` 이 필수다.** 바깥 줄이 지도 폭을 가로지르므로, 켜 두면
        상단 띠에서 지도 드래그가 먹지 않는다. 실제로 누르는 스택만 되살린다.

        현재 위치 버튼이 **토글 바로 아래**에 붙으므로 둘을 한 세로 스택으로 묶는다.
        따로 배치하면 토글 높이(44)를 두 곳에서 알아야 한다.

        **좌측 패널(`left-4`)은 건드리지 않는다.** 그쪽은 목록 레일(인셋 40)과 원래부터
        다른 값이고, 지도 가장자리에 붙는 것이 그 표면의 의도다.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-5 z-30 lg:top-6">
        <div className="content-container flex items-start justify-end gap-2 px-4 md:px-10">
          {/*
            **검색은 토글 왼쪽, 1024 미만에서만** (#596). 그 위는 좌측 패널 머리가 같은
            일을 하므로 둘 다 그리면 데스크톱 지도에 검색창이 둘이 된다.

            **`flex-1 min-w-0` 이라 남는 폭을 먹고 `max-w-md` 로 멈춘다** — 상한이 없으면
            768 에서 입력이 538 로 벌어져 짧은 문구 하나를 담고 지도를 가로로 길게 가린다.
            375 에서는 `flex-1` 이 준 245 가 상한보다 작아 그대로다.

            `items-start` 는 검색(44)과 토글 묶음(토글 44 + 내 위치 44)의 **윗변**을
            맞춘다 — `items-end` 면 검색이 내 위치 버튼 옆까지 내려간다.
          */}
          {searchable && (
            <PlaceSearchField
              filters={filters}
              compact
              id="place-keyword-map"
              className="pointer-events-auto max-w-md min-w-0 flex-1 lg:hidden"
            />
          )}

          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
            {/*
          **폭에 따라 두 벌을 두지 않는다** (#240). 아이콘형 하나로 통일했다 — 지도 위에
          글자 버튼이 얹히면 지도를 가리고, 이름은 `title` 호버 툴팁과 `aria-label` 이 맡는다.
        */}
            {showToggle && (
              <ViewToggle
                current="map"
                listHref={listHref}
                mapHref={mapHref}
                variant="icon"
                className="shadow-md"
              />
            )}

            {/* 제주 밖이면 렌더하지 않는다 — 눌러도 갈 곳이 없다 */}
            {inJeju && <MapLocateButton onLocate={locate} />}
          </div>
        </div>
      </div>

      {/* ── 데스크톱: 좌측 400 고정 패널 ─────────────────────────────────── */}
      {/*
        ── 여닫기는 **갈아끼우기가 아니라 슬라이드다** (#531)

        예전에는 `panelOpen ? <패널> : <펼치기 버튼>` 으로 **서로 다른 DOM 이 교체**돼
        트랜지션을 걸 대상이 아예 없었다 — 400px 패널이 한 프레임에 나타나고 사라졌다.
        이제 패널은 **항상 마운트된 채** 왼쪽으로 밀려나고, 펼치기 버튼만 그 위에서
        나타난다.

        **`prefers-reduced-motion` 은 전역이 잡는다** — `app/globals.css` 의 매체질의가
        모든 요소의 `transition-duration` 을 0.01ms 로 덮으므로 여기에 `motion-reduce:`
        변형을 따로 적지 않는다 (적으면 규칙이 두 군데가 된다).

        **닫힌 패널은 `inert` 다.** 화면 밖으로 밀려났을 뿐 DOM 에는 남아 있어, 그대로
        두면 Tab 이 보이지 않는 목록 수십 항목을 지나간다.
      */}
      <div
        className={cn(
          // 상단은 보기 전환 토글과 **같은 높이**다 (lg 헤더의 `pt-6`) — 8px 어긋나면
          // 지도 위에 뜬 두 표면이 서로 삐뚤어져 보인다
          //
          // 하단은 32 다. **카카오 축척·로고 막대가 지도 왼쪽 아래 20px 를 쓴다** —
          // 16 이었을 때는 패널이 그 위에 바로 얹혀 축척이 눌려 보였다 (실측: 막대가
          // 바닥에서 0~19px, 왼쪽 6px 부터 129px 폭). 32 면 13px 이 남는다.
          'absolute bottom-8 left-4 z-30 hidden lg:block',
          // 기본 24. 위에 떠 있는 것이 있는 화면은 `panelTopInset` 으로 밀어 내린다 (#556)
          panelTopInset === undefined && 'top-6',
        )}
        style={panelTopInset === undefined ? undefined : { top: panelTopInset }}
      >
        {/*
          **펼치기 버튼은 패널과 형제이고 자리가 고정이다.** 패널이 밀려나도 이 버튼은
          원래 자리(패널 좌상단)에 그대로 서서, 접기 전후로 손잡이가 같은 자리에 있다.
          열려 있는 동안에는 패널 아래 깔리므로 `opacity-0` 과 함께 클릭도 막는다.
        */}
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-expanded={false}
          aria-label={messages.map.expandPanel}
          tabIndex={panelOpen ? -1 : undefined}
          className={cn(
            'bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 absolute top-0 left-0 flex size-11 items-center justify-center rounded-xl border shadow-lg transition-opacity focus-visible:ring-2 focus-visible:outline-none',
            panelOpen && 'pointer-events-none opacity-0',
          )}
        >
          <ChevronRightIcon size={20} />
        </button>

        {/* 접기 탭이 패널 **밖으로** 튀어나오므로 여기서 자르지 않는다 */}
        <div
          inert={!panelOpen}
          className={cn(
            'map-panel-width relative h-full transition-transform',
            // 닫히면 패널 오른쪽 끝이 뷰포트 x=0 에 닿도록 자기 폭 + 왼쪽 여백(16)만큼 민다.
            // `-translate-x-full`(폭만큼)로는 `left-4` 때문에 16px 조각이 남는다.
            // 값이 `calc()` 라 globals.css 의 이름 있는 클래스다 (`.map-panel-collapsed`)
            !panelOpen && 'map-panel-collapsed',
          )}
        >
          {/*
              **오른쪽 위만 각지다** (`rounded-tr-none`). 둥근 모서리에 탭을 붙이면 그
              곡선만큼 지도가 초승달로 비쳐 탭이 떠 있는 것처럼 보인다. 그 자리는 탭이
              덮는 자리이므로 각지게 두는 것이 맞다.
            */}
          <div className="bg-bg border-border flex h-full w-full flex-col overflow-hidden rounded-xl rounded-tr-none border shadow-lg">
            {/*
                **패널 머리에는 필터가 온다.** 예전에는 "지도에 보이는 곳 20" 이 제목으로
                앉아 있었는데, 제목이 할 일이 없는 자리다 — 이 패널이 무엇인지는 안에 든
                목록이 이미 말한다. 개수는 아래 캡션으로 내렸다.
              */}
            {/*
              **검색이 패널 맨 위다** (#596) — 목록 갈래가 검색을 칩 위에 두는 것과 같은
              순서다. 검색어는 목록을 좁히는 **범위**이고 칩은 그 안의 축이다.

              **`compact` 가 아니다.** 이 패널 툴바 안쪽은 374px 로 목록 갈래의 모바일
              검색(343px)보다 넓다 — 글자 버튼이 들어가는 자리에서 아이콘으로 줄이면 같은
              컨트롤이 이유 없이 화면마다 갈린다. 오버레이만 자리가 없다.
            */}
            {searchable && (
              <div className="border-border border-b px-3 py-2">
                <PlaceSearchField
                  filters={filters}
                  id="place-keyword-panel"
                  className="flex items-start gap-2"
                />
              </div>
            )}

            <div className="border-border border-b px-3 py-2">
              <PlaceMapFilterBar filters={filters} authed={authed} />
            </div>

            <p className="text-caption text-fg-muted border-border bg-bg-sunken border-b px-4 py-2 font-medium">
              {countLine}
            </p>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <EmptyState
                  title={messages.map.emptyInView}
                  description={messages.map.emptyInViewDescription}
                />
              ) : (
                <PlaceMapPanel
                  places={visible}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  renderRowAction={renderRowAction}
                  renderRowNotice={renderRowNotice}
                />
              )}
            </div>
          </div>

          {/*
              ── 접기 탭 ──────────────────────────────────────────────────────

              **패널 안이 아니라 밖에 붙는다.** 안쪽 머리에 두면 목록의 컨트롤처럼 읽혀서
              "이 패널을 접는다" 로 보이지 않았고, 개수 줄과 자리를 다퉜다. 책갈피처럼
              오른쪽 모서리에 물려 두면 손잡이로 읽힌다.

              높이는 **닫혔을 때 펼치기 버튼이 서는 자리**와 같다(`top-0` · 44) — 접고
              펴는 동작에서 손잡이가 제자리에 남아 있어야 같은 것으로 보인다.
            */}
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-expanded
            aria-label={messages.map.collapsePanel}
            title={messages.map.collapsePanel}
            className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 absolute top-0 -right-6 flex h-11 w-6 items-center justify-center rounded-r-lg border border-l-0 shadow-md focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
          >
            <ChevronLeftIcon size={16} />
          </button>
        </div>
      </div>

      {/* ── 모바일: 하단 시트 3단 ────────────────────────────────────────── */}
      <MapSheet
        label="장소 목록"
        stop={sheetStop}
        onStopChange={setSheetStop}
        /*
          시트도 데스크톱 패널과 같은 순서다: **전폭 필터 줄 → 개수.**
          **모바일 지도에는 필터가 아예 없었다** — 목록 칩 줄은 목록 보기에만 붙어 있어서,
          지도에서 조건을 좁히려면 목록으로 되돌아가야 했다.
        */
        toolbar={<PlaceMapFilterBar filters={filters} authed={authed} />}
        header={<p className="text-caption text-fg-muted truncate font-medium">{countLine}</p>}
        maxTopInset={sheetMaxTopInset}
      >
        {visible.length === 0 ? (
          <EmptyState
            title={messages.map.emptyInView}
            description={messages.map.emptyInViewDescription}
          />
        ) : (
          <PlaceMapPanel
            places={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            renderRowAction={renderRowAction}
            renderRowNotice={renderRowNotice}
          />
        )}
      </MapSheet>
    </div>
  )
}

function failureMessage(reason: MapSdkFailure): string {
  if (reason === 'no-key') return messages.map.errorNoKey
  if (reason === 'unsupported') return messages.map.errorUnsupported
  return messages.map.errorScript
}

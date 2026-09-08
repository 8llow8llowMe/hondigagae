'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { EmptyState } from '@/components/empty-state'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'
import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { ViewToggle } from '@/components/view-toggle'
import type { MapPin } from '@/features/map/map-canvas'
import { MapLocateButton } from '@/features/map/map-locate-button'
import { PlaceListSection } from '@/features/place/place-list-section'
import { PlaceMapFilterBar } from '@/features/place/place-map-filter-bar'
import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { useNearbyPlaces } from '@/features/place/use-nearby-places'
import { usePlaceList } from '@/features/place/use-place-list'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { type LatLng, SELECTED_PLACE_MAP_LEVEL, toLatLng } from '@/lib/geo/coord'
import { getCurrentPosition } from '@/lib/geo/current-position'
import type { MapSdkFailure } from '@/lib/map/sdk'
import {
  boundsCenter,
  boundsRadiusMeters,
  isSameViewport,
  isWithinBounds,
  type MapBounds,
} from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
import { PLACES_DEFAULT_VIEW, viewModeHref } from '@/lib/url/view-mode'
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
 *  - 사용자가 **지도를 의미 있게 옮기면** `GET /places/nearby` 로 갈아탄다. 그 순간
 *    목록 캐시는 화면 밖을 말하고 있어 재사용이 오히려 틀리다.
 *
 * **지도가 유일한 전달 수단이 아니다** (이슈 #14 완료 조건). SDK 가 실패하면 목록을
 * 그대로 그리고 위에 안내 한 줄을 둔다.
 */
export function PlaceMapView({
  filters,
  filterQuery,
  authed,
}: {
  filters: PlaceFilters
  /** 현재 URL 의 필터 쿼리. 보기 전환 링크가 이것을 유지한다 */
  filterQuery: string
  /** 미로그인이면 반려견 목록을 조회하지 않는다 — 필터의 크기 축이 빠진다 (#200) */
  authed: boolean
}) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  /** 지도를 옮겼는지. 처음 `idle` 한 번은 이동이 아니다 */
  const [movedBounds, setMovedBounds] = useState<MapBounds | null>(null)
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

  const searchCenter = movedBounds === null ? null : boundsCenter(movedBounds)
  const searchRadius = movedBounds === null ? 0 : boundsRadiusMeters(movedBounds)
  /*
    **지도를 옮기면 항상 그 지역을 다시 찾는다.** 예전에는 이것을 체크박스로 열어 뒀는데
    (#240), 켜고 끄는 것이 바꾸는 것은 **데이터 출처**여서 화면만 보고는 무엇이 달라지는지
    알 수 없었다. 끈 상태에서도 영역 필터는 계속 돌아 화면 밖 장소가 빠지니, 사용자에게는
    "아무 일도 안 하는 체크박스" 로 보였다. 지도를 옮기는 것이 곧 "여기를 보여 줘" 다.
  */
  const nearbyQuery = useNearbyPlaces(searchCenter, searchRadius, filters, true)

  const usingNearby = nearbyQuery.data !== undefined
  const places: PlaceSummary[] = useMemo(
    () => (usingNearby ? (nearbyQuery.data?.places.map((entry) => entry.place) ?? []) : listPlaces),
    [usingNearby, nearbyQuery.data, listPlaces],
  )

  /** 지도 영역 안에 든 것만 목록에 남긴다 — "지도에 보이는 곳 8" 이 그 뜻이다 */
  const visible = useMemo(() => {
    if (bounds === null) return places

    return places.filter((place) => {
      const coord = toLatLng(place)
      // 좌표가 없는 곳은 지도가 판단할 수 없다. 숨기지 않고 남긴다 —
      // 목록으로도 같은 정보에 도달할 수 있어야 한다 (이슈 #14 완료 조건)
      return coord === null || isWithinBounds(bounds, coord)
    })
  }, [places, bounds])

  const pins: MapPin[] = useMemo(
    () =>
      visible.map((place) => ({
        id: place.placeId,
        title: place.title,
        lat: place.lat,
        lng: place.lng,
      })),
    [visible],
  )

  const handleBounds = useCallback((next: MapBounds, userMoved: boolean) => {
    setBounds(next)

    // **첫 영역은 이동이 아니다.** 들어오자마자 주변 검색으로 갈아타면 프리페치한
    // 목록 캐시를 버리게 되고, 첫 화면이 반경 밖이라 비어 보인다 (실제로 그랬다)
    if (!userMoved) return

    // 손가락이 스친 정도는 재조회하지 않는다 — 요청이 폭주하고 목록이 깜빡인다
    setMovedBounds((previous) => (isSameViewport(previous, next) ? previous : next))
  }, [])

  const listHref = viewModeHref('/places', filterQuery, 'list', PLACES_DEFAULT_VIEW)
  const mapHref = viewModeHref('/places', filterQuery, 'map', PLACES_DEFAULT_VIEW)

  // ── SDK 실패 → 목록으로 되돌리고 안내 한 줄 ──────────────────────────────
  if (failure !== null) {
    return (
      <div>
        {/* 안내 한 줄 — 배너(링크형)가 아니다. 갈 곳이 없고 알릴 사실만 있다 */}
        <p
          role="status"
          className="text-caption text-fg-muted bg-bg-sunken border-border border-b px-4 py-3 font-medium md:px-10"
        >
          {failureMessage(failure)}
        </p>
        <PlaceListSection
          places={listPlaces}
          loading={listQuery.isPending}
          errorStatus={toErrorStatus(listQuery.error)}
          errorMessage={
            listQuery.error instanceof ApiError ? listQuery.error.rawMessage : undefined
          }
          hasNext={listQuery.data?.pages.at(-1)?.hasNext ?? false}
          loadingMore={listQuery.isFetchingNextPage}
          onLoadMore={() => void listQuery.fetchNextPage()}
          onRetry={() => void listQuery.refetch()}
          onResetFilters={() => undefined}
        />
      </div>
    )
  }

  const countLine = messages.map.visibleCount.replace('{n}', String(visible.length))

  return (
    <div className="relative">
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
        className="map-canvas-height w-full"
      />

      {/*
        ── 지도 우상단 컨트롤 ──────────────────────────────────────────────

        **여백이 목록 보기의 헤더와 정확히 같다.** 목록은 `px-4 pt-5 md:px-10 lg:pt-6`
        안에서 제목 오른쪽에 같은 토글을 두는데, 지도가 `top-3 right-3` 이던 탓에 두 보기를
        번갈아 누르면 버튼이 매번 자리를 옮겼다 — 같은 컨트롤이면 같은 자리에 있어야 한다.

        현재 위치 버튼이 **토글 바로 아래**에 붙으므로 둘을 한 세로 스택으로 묶는다.
        따로 배치하면 토글 높이(44)를 두 곳에서 알아야 한다.
      */}
      <div className="absolute top-5 right-4 z-30 flex flex-col items-end gap-2 md:right-10 lg:top-6">
        {/*
          **폭에 따라 두 벌을 두지 않는다** (#240). 아이콘형 하나로 통일했다 — 지도 위에
          글자 버튼이 얹히면 지도를 가리고, 이름은 `title` 호버 툴팁과 `aria-label` 이 맡는다.
        */}
        <ViewToggle
          current="map"
          listHref={listHref}
          mapHref={mapHref}
          variant="icon"
          className="shadow-md"
        />

        {/* 제주 밖이면 렌더하지 않는다 — 눌러도 갈 곳이 없다 */}
        {inJeju && <MapLocateButton onLocate={locate} />}
      </div>

      {/* ── 데스크톱: 좌측 400 고정 패널 ─────────────────────────────────── */}
      <div
        className={cn(
          // 상단은 보기 전환 토글과 **같은 높이**다 (lg 헤더의 `pt-6`) — 8px 어긋나면
          // 지도 위에 뜬 두 표면이 서로 삐뚤어져 보인다
          //
          // 하단은 32 다. **카카오 축척·로고 막대가 지도 왼쪽 아래 20px 를 쓴다** —
          // 16 이었을 때는 패널이 그 위에 바로 얹혀 축척이 눌려 보였다 (실측: 막대가
          // 바닥에서 0~19px, 왼쪽 6px 부터 129px 폭). 32 면 13px 이 남는다.
          'absolute top-6 bottom-8 left-4 z-30 hidden lg:block',
          panelOpen ? 'map-panel-width' : 'w-auto',
        )}
      >
        {panelOpen ? (
          // 접기 탭이 패널 **밖으로** 튀어나오므로 여기서 자르지 않는다
          <div className="relative h-full">
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
        ) : (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            aria-expanded={false}
            aria-label={messages.map.expandPanel}
            className="bg-bg border-border text-fg-muted hover:text-fg focus-visible:ring-brand-500 flex size-11 items-center justify-center rounded-xl border shadow-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRightIcon size={20} />
          </button>
        )}
      </div>

      {/* ── 모바일: 하단 시트 3단 ────────────────────────────────────────── */}
      <MapSheet
        stop={sheetStop}
        onStopChange={setSheetStop}
        /*
          시트도 데스크톱 패널과 같은 순서다: **전폭 필터 줄 → 개수.**
          **모바일 지도에는 필터가 아예 없었다** — 목록 칩 줄은 목록 보기에만 붙어 있어서,
          지도에서 조건을 좁히려면 목록으로 되돌아가야 했다.
        */
        toolbar={<PlaceMapFilterBar filters={filters} authed={authed} />}
        header={<p className="text-caption text-fg-muted truncate font-medium">{countLine}</p>}
      >
        {visible.length === 0 ? (
          <EmptyState
            title={messages.map.emptyInView}
            description={messages.map.emptyInViewDescription}
          />
        ) : (
          <PlaceMapPanel places={visible} selectedId={selectedId} onSelect={setSelectedId} />
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

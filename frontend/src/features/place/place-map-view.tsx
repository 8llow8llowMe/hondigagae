'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { Checkbox } from '@/components/checkbox'
import { EmptyState } from '@/components/empty-state'
import { ChevronRightIcon } from '@/components/icons'
import { MapSheet, type SheetStop } from '@/components/map-sheet'
import { ViewToggle } from '@/components/view-toggle'
import type { MapPin } from '@/features/map/map-canvas'
import { PlaceListSection } from '@/features/place/place-list-section'
import { PlaceMapPanel } from '@/features/place/place-map-panel'
import { useNearbyPlaces } from '@/features/place/use-nearby-places'
import { usePlaceList } from '@/features/place/use-place-list'
import { ApiError, toErrorStatus } from '@/lib/api/error'
import { mergeSlices } from '@/lib/api/slice'
import { toLatLng } from '@/lib/geo/coord'
import type { MapSdkFailure } from '@/lib/map/sdk'
import {
  boundsCenter,
  boundsRadiusMeters,
  isSameViewport,
  isWithinBounds,
  type MapBounds,
} from '@/lib/map/viewport'
import { messages } from '@/lib/messages'
import { viewModeHref } from '@/lib/url/view-mode'
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
}: {
  filters: PlaceFilters
  /** 현재 URL 의 필터 쿼리. 보기 전환 링크가 이것을 유지한다 */
  filterQuery: string
}) {
  const [bounds, setBounds] = useState<MapBounds | null>(null)
  /** 지도를 옮겼는지. 처음 `idle` 한 번은 이동이 아니다 */
  const [movedBounds, setMovedBounds] = useState<MapBounds | null>(null)
  const [searchOnMove, setSearchOnMove] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetStop, setSheetStop] = useState<SheetStop>('mid')
  const [panelOpen, setPanelOpen] = useState(true)
  const [failure, setFailure] = useState<MapSdkFailure | null>(null)

  const listQuery = usePlaceList(filters)
  const listPlaces = useMemo(
    () => (listQuery.data === undefined ? [] : mergeSlices(listQuery.data.pages)),
    [listQuery.data],
  )

  const searchCenter = movedBounds === null ? null : boundsCenter(movedBounds)
  const searchRadius = movedBounds === null ? 0 : boundsRadiusMeters(movedBounds)
  const nearbyQuery = useNearbyPlaces(searchCenter, searchRadius, filters, searchOnMove)

  const usingNearby = searchOnMove && nearbyQuery.data !== undefined
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

  const listHref = viewModeHref('/places', filterQuery, 'list')
  const mapHref = viewModeHref('/places', filterQuery, 'map')

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
        onFailure={setFailure}
        className="map-canvas-height w-full"
      />

      {/* 지도 우상단 — 데스크톱은 글자, 모바일은 아이콘 (아트보드 05 마지막 단락) */}
      <div className="absolute top-3 right-3 z-30 lg:top-4 lg:right-4">
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
      </div>

      {/* ── 데스크톱: 좌측 400 고정 패널 ─────────────────────────────────── */}
      <div
        className={cn(
          'absolute top-4 bottom-4 left-4 z-30 hidden lg:flex',
          panelOpen ? 'map-panel-width' : 'w-auto',
        )}
      >
        {panelOpen ? (
          <div className="bg-bg border-border flex w-full flex-col overflow-hidden rounded-xl border shadow-lg">
            <div className="border-border flex items-center gap-2 border-b px-4 py-3">
              <p className="text-body-2 text-fg min-w-0 flex-1 font-semibold">{countLine}</p>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-expanded
                aria-label={messages.map.collapsePanel}
                className="text-fg-muted hover:text-fg focus-visible:ring-brand-500 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
              >
                <span aria-hidden>‹</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {visible.length === 0 ? (
                <EmptyState
                  title={messages.map.emptyInView}
                  description={messages.map.emptyInViewDescription}
                />
              ) : (
                <PlaceMapPanel places={visible} selectedId={selectedId} onSelect={setSelectedId} />
              )}
            </div>

            <div className="border-border border-t px-4 py-3">
              <Checkbox
                id="place-map-search-on-move"
                label={messages.map.searchOnMove}
                checked={searchOnMove}
                onCheckedChange={setSearchOnMove}
              />
              <p className="text-caption text-fg-subtle mt-2 font-medium">
                {searchOnMove ? messages.map.panelHint : messages.map.panelHintFixed}
              </p>
            </div>
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
        header={<p className="text-body-2 text-fg truncate font-semibold">{countLine}</p>}
      >
        {visible.length === 0 ? (
          <EmptyState
            title={messages.map.emptyInView}
            description={messages.map.emptyInViewDescription}
          />
        ) : (
          <>
            <PlaceMapPanel places={visible} selectedId={selectedId} onSelect={setSelectedId} />
            <p className="text-caption text-fg-subtle px-4 py-3 font-medium">
              {searchOnMove ? messages.map.panelHint : messages.map.panelHintFixed}
            </p>
          </>
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

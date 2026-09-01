'use client'

import { useCallback, useEffect, useState } from 'react'

import { EmergencyMap } from '@/features/emergency/emergency-map'
import { EmergencySection } from '@/features/emergency/emergency-section'
import { applyFilters } from '@/features/emergency/facility-filters'
import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { toErrorStatus } from '@/lib/api/error'
import {
  getCurrentPosition,
  type PositionFailure,
  type PositionResult,
} from '@/lib/geo/current-position'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { messages } from '@/lib/messages'
import { LG_QUERY, useMediaQuery } from '@/lib/ui/media-query'
import type { ViewMode } from '@/lib/url/view-mode'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

/** 넓히기 한 번에 두 배. 10km → 20km → 40km → 50km(상한) */
function widen(radius: number): number {
  return Math.min(MAX_RADIUS_METERS, radius * 2)
}

/**
 * 조회 상태를 presentational 컴포넌트가 쓰는 props 로 변환한다.
 *
 * **좌표를 먼저 구하고 그다음 조회한다.** `lat`/`lng` 가 필수라 순서가 뒤집히면 400 이다.
 * 좌표 요청은 **실패해도 좌표를 돌려준다**(제주 중심) — 이 화면은 급할 때 여는 화면이라
 * 위치 하나 때문에 비어 버리면 안 된다.
 *
 * **서버 프리페치를 하지 않는다.** 좌표가 브라우저에만 있어 서버가 무엇을 조회할지
 * 모른다 (`architecture-guide.md` §9 결정 트리 1번: 초기 화면 데이터지만 서버가
 * 만들 수 없는 값에 의존한다).
 */
export function EmergencyView({ view }: { view: ViewMode }) {
  const [position, setPosition] = useState<PositionResult | null>(null)
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS)
  const [filters, setFilters] = useState<FacilityFilters>(DEFAULT_FACILITY_FILTERS)
  /** SDK 를 못 쓰면 지도를 접는다. 목록과 전화는 그대로 남는다 (아트보드 02) */
  const [mapFailure, setMapFailure] = useState<MapSdkFailure | null>(null)

  const locate = useCallback(() => {
    void getCurrentPosition().then(setPosition)
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  const query = useNearbyFacilities(position, radius)

  const fallback: PositionFailure | null =
    position !== null && position.kind === 'fallback' ? position.reason : null

  const section = (
    <EmergencySection
      result={query.data ?? null}
      // 좌표를 기다리는 동안에도 로딩이다 — 조회는 아직 시작도 못 했다
      loading={position === null || query.isPending}
      errorStatus={toErrorStatus(query.error)}
      onRetry={() => void query.refetch()}
      filters={filters}
      onFiltersChange={setFilters}
      positionFallback={fallback}
      onRetryPosition={locate}
      onWidenRadius={() => setRadius(widen)}
      canWiden={radius < MAX_RADIUS_METERS}
    />
  )

  /*
    **필터를 두 뷰가 공유한다** (아트보드 02 주석). 목록과 지도가 각자 좁히면 목록에서
    병원만 보던 사람이 지도로 넘어왔을 때 약국 마커가 늘어난다. 좁히는 함수는 하나다.
  */
  const visible = applyFilters(query.data?.facilities ?? [], filters)
  const canShowMap = mapFailure === null && position !== null

  const map = canShowMap ? (
    <EmergencyMap
      facilities={visible}
      // 위치 폴백이면 거리를 감춘다 — 제주 중심 기준 거리를 내 위치로 읽는다
      showDistance={fallback === null}
      center={position === null ? null : { lat: position.lat, lng: position.lng }}
      onFailure={setMapFailure}
    />
  ) : null

  /*
    **각각 한 번씩만 mount 한다.**

    처음엔 데스크톱 2단과 모바일 토글을 각각의 블록으로 두고 CSS 로 감췄는데, 그러면
    `section` 과 `map` 이 **DOM 에 두 벌** 생긴다. 감춰진 쪽도 mount 되므로 카카오 지도가
    두 번 만들어지고, 크기 0 인 지도 하나가 조용히 SDK 를 쓴다 (실측으로 확인했다).

    그래서 브레이크포인트를 값으로 읽어 **무엇을 그릴지**를 정한다. CSS 로 감추는 것과
    아예 만들지 않는 것의 차이가 여기서는 실제 비용이다.
  */
  const desktop = useMediaQuery(LG_QUERY)
  const showList = desktop || view === 'list'
  const showMap = desktop || view === 'map'

  return (
    <>
      {mapFailure !== null && (
        <p
          role="status"
          className="text-caption text-fg-muted bg-bg-sunken border-border border-b px-4 py-3 font-medium md:px-10"
        >
          {mapFailure === 'no-key' ? messages.map.errorNoKey : messages.map.errorScript}
        </p>
      )}

      {/* 1024+ 는 좌 목록 480 / 우 지도 2단 (아트보드 04) — 그 아래는 토글이라 한 컬럼이다 */}
      <div className="lg:grid lg:grid-cols-[480px_1fr] lg:items-start lg:gap-6 lg:px-10 lg:pb-10">
        {showList && <div className="min-w-0">{section}</div>}
        {showMap && map !== null && <div className="lg:sticky lg:top-6">{map}</div>}
      </div>
    </>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'

import { EmergencySection } from '@/features/emergency/emergency-section'
import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS } from '@/lib/api/emergency'
import { toErrorStatus } from '@/lib/api/error'
import {
  getCurrentPosition,
  type PositionFailure,
  type PositionResult,
} from '@/lib/geo/current-position'
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
export function EmergencyView() {
  const [position, setPosition] = useState<PositionResult | null>(null)
  const [radius, setRadius] = useState(DEFAULT_RADIUS_METERS)
  const [filters, setFilters] = useState<FacilityFilters>(DEFAULT_FACILITY_FILTERS)

  const locate = useCallback(() => {
    void getCurrentPosition().then(setPosition)
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  const query = useNearbyFacilities(position, radius)

  const fallback: PositionFailure | null =
    position !== null && position.kind === 'fallback' ? position.reason : null

  return (
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
}

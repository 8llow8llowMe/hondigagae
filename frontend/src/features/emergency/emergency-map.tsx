'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { EmptyState } from '@/components/empty-state'
import { FacilitySelectedCard } from '@/features/emergency/facility-selected-card'
import type { MapPin } from '@/features/map/map-canvas'
import { formatDistance } from '@/lib/format/distance'
import type { LatLng } from '@/lib/geo/coord'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { messages } from '@/lib/messages'
import type { NearbyFacilityItem } from '@/types/emergency'

const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 긴급 시설 지도 — 아트보드 `혼디가개 긴급 시설` 02(모바일) · 04(데스크톱 2단).
 *
 * **목록이 기본이고 지도는 토글이다.** 응급 화면이라 지도가 실패해도 목록과 전화는
 * 살아 있어야 한다 — 그래서 이 컴포넌트는 목록을 대체하지 않고 **목록 옆/위에 얹힌다.**
 * 실패하면 스스로 사라지고(`onFailure`) 호출부가 목록만 남긴다.
 *
 * **필터는 두 뷰가 공유한다.** 목록에서 병원만 보던 사람이 지도로 넘어왔을 때 갑자기
 * 약국 마커가 늘어나면 안 된다 (아트보드 주석) — 그래서 이미 좁혀진 배열을 받는다.
 */
export function EmergencyMap({
  facilities,
  showDistance,
  center,
  onFailure,
}: {
  /** **이미 필터가 적용된 배열이다.** 여기서 다시 좁히지 않는다 */
  facilities: NearbyFacilityItem[]
  showDistance: boolean
  center: LatLng | null
  onFailure: (reason: MapSdkFailure) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const pins: MapPin[] = useMemo(
    () =>
      facilities.map((facility) => ({
        id: facility.facilityId,
        title: facility.name,
        lat: facility.lat,
        lng: facility.lng,
        caption: showDistance ? formatDistance(facility.distanceMeters) : null,
        // 약국은 글자 톤을 낮춘다 — 등급 색을 마커에 쓰지 않는다 (아트보드 02)
        muted: facility.facilityType.code === 'ANIMAL_PHARMACY',
      })),
    [facilities, showDistance],
  )

  const selected = facilities.find((facility) => facility.facilityId === selectedId) ?? null

  return (
    <div className="relative">
      <MapCanvas
        pins={pins}
        selectedId={selectedId}
        onSelect={setSelectedId}
        center={center}
        onFailure={onFailure}
        className="emergency-map-height w-full lg:rounded-xl"
      />

      {facilities.length === 0 && (
        <div className="bg-bg/90 absolute inset-x-4 top-4 rounded-xl">
          <EmptyState title={messages.map.emptyInView} />
        </div>
      )}

      {/* 선택 카드는 지도 위 하단에 얹는다. 시트 3단이 아니다 —
          시설이 4~12곳 규모라 목록을 단계로 나눌 만큼 길지 않다 (아트보드 02) */}
      {selected !== null && (
        <div className="absolute inset-x-3 bottom-3 z-30 lg:inset-x-4 lg:bottom-4">
          <FacilitySelectedCard
            facility={selected}
            showDistance={showDistance}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

import type { MapPin } from '@/features/map/map-canvas'
import { routeCamera, routeCameraKey, type RouteModel, toRouteSegments } from '@/lib/map/route'
import type { MapSdkFailure } from '@/lib/map/sdk'
import { cn } from '@/lib/utils/cn'

/**
 * **`ssr: false` 가 필수다.** SDK 가 `window` 를 읽어 서버 렌더에서 깨진다
 * (docs/external-api-guide.md §1).
 */
const MapCanvas = dynamic(
  () => import('@/features/map/map-canvas').then((module) => module.MapCanvas),
  { ssr: false },
)

/**
 * 하루 동선 지도 — 번호 핀 · 순서 선 · 전날 숙소 점선 (#1415 에서 `PlanRouteCard` 에서 뗐다).
 *
 * **URL 을 모른다.** 일자 · 선택은 호출부가 정한다 — 일정 상세 동선 카드는 `?day=` 로, 브리핑은
 * 그날 하나로. **실패 판단도 호출부 몫이다**(`onFailure`) — 동선 카드는 카드째 접고, 브리핑은
 * 지도만 접는다. 정류점이 없으면(카메라 `null`) 아무것도 그리지 않는다.
 */
export function PlanRouteMap({
  model,
  day,
  selectedId = null,
  onSelect,
  onFailure,
  className,
}: {
  model: RouteModel
  day: number
  selectedId?: string | null
  onSelect?: (id: string) => void
  onFailure: (failure: MapSdkFailure) => void
  className?: string
}) {
  /*
    **카메라 memo 는 배열이 아니라 값 서명에 건다** (#982 리뷰 H-1). `model.stops` 는 호출부가
    렌더마다 새로 만들 수 있어, 거기 걸면 날씨 · 위험도 쿼리가 늦게 도착하거나 일자 편집에
    들어갈 때마다 새 카메라가 된다. `MapCanvas` 는 새 카메라를 새 틀로 읽어 "사용자가
    옮겼다" 표시를 지우고 다시 맞추므로, **끌어 둔 지도가 그날 사각형으로 되돌아간다.**

    서명은 일자와 정류점의 `id` · 좌표뿐이다 (`routeCameraKey`) — 카메라가 읽는 값이 그것뿐이라
    서명이 같으면 `routeCamera` 결과도 같다. 그래서 의존성에서 `model.stops` 를 뺀다.
  */
  const cameraKey = routeCameraKey(day, model.stops)

  const camera = useMemo(() => {
    const frame = routeCamera(model.stops)
    /*
      주인공이 여럿인 지도라 정중앙이다 — 기본 0.35 는 제주 전체를 담는 화면의 값이다.

      **크기가 바뀌면 다시 맞춘다** (#982). 단계를 칸의 **폭**으로 정하므로(`SpanBox`) 창을
      줄이거나 기기를 돌리면 처음 맞춘 단계가 틀린다. 사용자가 지도를 만졌으면 되잡지
      않는다(`MapCanvas` 의 `refitOnResize`).
    */
    return frame === null ? null : { ...frame, anchorRatio: 0.5, refitOnResize: true }
    // 서명이 `model.stops` 의 카메라 입력을 전부 담는다 (위 주석)
  }, [cameraKey])

  const pins: MapPin[] = useMemo(
    () =>
      model.stops.map((stop) => ({
        id: stop.id,
        title: stop.title,
        lat: stop.coord.lat,
        lng: stop.coord.lng,
        order: stop.order,
      })),
    [model.stops],
  )

  const route = useMemo(() => toRouteSegments(model.legs), [model.legs])

  if (camera === null) return null

  return (
    <MapCanvas
      pins={pins}
      route={route}
      selectedId={selectedId}
      {...(onSelect === undefined ? {} : { onSelect })}
      camera={camera}
      onFailure={onFailure}
      className={cn('h-56 w-full overflow-hidden rounded-md md:h-64', className)}
    />
  )
}

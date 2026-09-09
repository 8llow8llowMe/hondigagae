'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useEmergencyNav } from '@/features/emergency/use-emergency-nav'
import { useNearbyFacilities } from '@/features/emergency/use-nearby-facilities'
import { MAX_RADIUS_METERS } from '@/lib/api/emergency'
import {
  getCurrentPosition,
  type PositionFailure,
  type PositionResult,
} from '@/lib/geo/current-position'

/**
 * 이 화면의 상태 묶음. **화면당 하나만 만든다** — 두 벌이 마운트되면
 * `getCurrentPosition()` 이 두 번 나가고 좌표가 갈린다. 보드를 만들지 않고
 * **받아서** 쓰는 컴포넌트는 이 타입을 prop 으로 받는다.
 */
export type EmergencyBoard = ReturnType<typeof useEmergencyBoard>

/**
 * 긴급 시설 화면의 상태 — 위치 · 반경 · 필터 · 조회.
 *
 * **두 갈래(목록 · 지도)가 같은 모델을 쓴다.** 각자 갖고 있으면 보기를 전환할 때
 * 조건이 풀리고, 위치 권한 프롬프트가 화면마다 다른 순간에 뜬다.
 *
 * **반경과 필터는 URL 이 소유한다** (`useEmergencyNav` · architecture-guide.md §10).
 * 이 화면은 급할 때 링크로 건네는 화면이라 "24시간 · 40km" 를 좁혀 놓고 보낸 링크가
 * 받는 사람에게 기본 화면으로 열리면 안 된다. 새로고침·뒤로가기도 같은 이유다.
 *
 * **좌표는 URL 에 없다.** 공유 대상이 아니고(받는 사람의 기준점은 자기 위치다) URL 에
 * 실을 값도 아니다.
 *
 * **좌표를 먼저 구하고 그다음 조회한다.** `lat`/`lng` 가 필수라 순서가 뒤집히면 400 이다.
 * 좌표 요청은 **실패해도 좌표를 돌려준다**(제주 중심) — 이 화면은 급할 때 여는 화면이라
 * 위치 하나 때문에 비어 버리면 안 된다.
 *
 * **서버 프리페치를 하지 않는다.** 좌표가 브라우저에만 있어 서버가 무엇을 조회할지
 * 모른다 (`architecture-guide.md` §9 결정 트리 1번).
 */
export function useEmergencyBoard() {
  const [position, setPosition] = useState<PositionResult | null>(null)
  const { filters, radius, setFilters, setRadius, widenRadius } = useEmergencyNav()

  /*
    **누를 때마다 다시 묻는다.** 마운트 때 받은 좌표를 재사용하면 사용자가 이동한 뒤
    누른 "내 위치" 가 옛 자리를 가리킨다.

    **`/places` 와 달리 조회도 다시 돈다** — `position` 이 query key 라서다. 이 화면은
    거리를 표시하고 정렬 근거로 쓰므로 기준점이 바뀌면 목록도 바뀌어야 한다.
  */
  const locate = useCallback(() => {
    void getCurrentPosition().then(setPosition)
  }, [])

  useEffect(() => {
    locate()
  }, [locate])

  const query = useNearbyFacilities(position, radius)

  const fallback: PositionFailure | null =
    position !== null && position.kind === 'fallback' ? position.reason : null

  /*
    지도 카메라. **`useMemo` 가 필수다** — 렌더 중에 새 객체를 만들면 `MapCanvas` 의
    카메라 effect 가 매 렌더 돌아 **필터 칩을 누를 때마다 지도가 되돌아간다.**
    이전 구현이 `center` 를 인라인 객체로 넘겨 실제로 그랬다.

    `spanMeters` 가 지름이다 — 반경 10km 를 담으려면 20km 폭이 필요하다.
  */
  const camera = useMemo(
    () =>
      position === null
        ? null
        : { anchor: { lat: position.lat, lng: position.lng }, spanMeters: radius * 2 },
    [position, radius],
  )

  return {
    position,
    camera,
    /** null 이면 내 위치를 쓰고 있다. 값이 있으면 제주 중심 폴백이다 */
    fallback,
    /** 폴백이면 거리를 감춘다 — 제주 중심에서 480m 인 것을 "480m" 로 쓸 수 없다 */
    showDistance: fallback === null,
    /** 제주 안에서만 "내 위치" 버튼을 그린다 — 밖에서는 눌러도 갈 곳이 없다 */
    inJeju: position !== null && position.kind === 'granted',
    radius,
    setRadius,
    widenRadius,
    canWiden: radius < MAX_RADIUS_METERS,
    filters,
    setFilters,
    query,
    locate,
  }
}

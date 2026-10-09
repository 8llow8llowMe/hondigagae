'use client'

import { useEffect, useRef } from 'react'

import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { useSelectedPet } from '@/features/nav/use-selected-pet'
import { usePlaceFilterNav } from '@/features/place/use-place-filter-nav'
import { changedPet, petSizeFiltersAfterPetChange } from '@/lib/place/pet-size-filter'
import type { PlaceFilters } from '@/types/place'

/**
 * 반려견이 바뀌면 체구 필터의 URL 값을 새 반려견으로 맞춘다 — 장소-반려견칩-세부명세 D1-2 ② (#1301).
 *
 * **그리는 것이 없다.** 체구 필터는 켜질 때 그 반려견의 크기 · 체중을 URL 에 적는데, 반려견을 바꿔도(지도 필터 줄
 * 칩 · 띠 헤더 스위처 · 반려견 삭제 폴백) URL 을 고치는 곳이 없어 결과가 옛 반려견 기준으로 남았다. 바꾸는 곳이
 * 여럿이라 바꾸는 쪽이 아니라 **값을 읽는 쪽 한 곳**에서 맞춘다.
 *
 * - **바뀜만 본다** — 확정 반려견이 A → B(둘 다 있음, 다름)일 때만 (`changedPet`). 첫 확정에서 URL 을 고치면
 *   공유 링크를 열자마자 받은 사람의 반려견으로 결과가 바뀐다
 * - **스토어 복원 전에는 직전값을 잡지 않는다** — 복원 전 확정값은 저장값이 아니라 첫 반려견이다
 * - 이동은 `usePlaceFilterNav().apply` — `replace` · `view` 보존 · `scroll: false` 를 다른 필터 컨트롤과 같이 한다.
 *   **열린 미리보기는 닫지 않는다**(`keepPreview`) — 다른 필터와 달리 사용자가 판정을 보려고 바꾼 것이다 (D1-2)
 *
 * **보기 하나에 한 번만 마운트한다** (`PlaceMapView` · `/places` 목록 보기 · 담기 목록 보기). 둘이면 같은
 * `replace` 가 두 번 나간다.
 */
export function PlaceFilterPetSync({
  filters,
  authed,
}: {
  filters: PlaceFilters
  authed: boolean
}) {
  const { pet } = useSelectedPet(authed)
  const restored = useSelectedPetStore((state) => state.selectedPetId !== undefined)
  const { apply } = usePlaceFilterNav()
  /** 직전에 확정된 반려견. 복원 뒤에만 기록한다 */
  const previousPetId = useRef<string | null>(null)

  useEffect(() => {
    if (!restored) return

    const next = changedPet(previousPetId.current, pet)
    previousPetId.current = pet?.petId ?? null
    if (next === null) return

    const nextFilters = petSizeFiltersAfterPetChange(filters, next)
    if (nextFilters !== null) apply(nextFilters, { keepPreview: true })
  }, [restored, pet, filters, apply])

  return null
}

'use client'

import { Skeleton } from '@/components/skeleton'
import { PetSwitcher, type PetSwitcherVariant } from '@/features/nav/pet-switcher'
import { usePetList } from '@/features/pet/use-pet-list'

/**
 * 스위처의 조회 껍데기 — 전역nav-세부명세 D5.
 *
 * `petKeys.list()` 를 **반려견 목록 화면과 공유한다.** `/pets` 에서 등록·수정·삭제하면
 * `petKeys.all` 무효화로 헤더 스위처도 함께 갱신된다 (D3).
 *
 * **조회가 실패하면 스위처를 숨기고 nav 는 유지한다.** 헤더에 `ErrorState` 를 넣지 않는다 —
 * nav 가 에러 화면이 되면 어디로도 갈 수 없다. 그 실패는 홈의 판정 섹션이 대신 알린다.
 *
 * **지도 필터 줄 칩(`variant="chip"`)도 이 껍데기를 쓴다** (장소-반려견칩-세부명세 D3-1). 골격 크기 · 실패 시
 * 숨김이 헤더와 같다 — 필터 줄에도 재시도 UI 를 두지 않는다.
 */
export function PetSwitcherSlot({ variant = 'header' }: { variant?: PetSwitcherVariant }) {
  const { data, isPending, isError } = usePetList(true)
  // 호출부가 `{authed && <PetSwitcherSlot />}` 로 이미 막는다 (#200 — `HeaderActions` · `PlaceMapFilterBar`)

  // 칩 갈래는 필터 줄 flex 안이라 줄어들지 않게 `shrink-0` — 칩이 서도 유형 줄이 밀리지 않는다 (D5).
  // 높이는 칩(`Chip` sm)과 같다 — 모바일 36 · 768 이상 44 (#1314). 헤더 갈래는 44 그대로다
  if (isPending) {
    return (
      <Skeleton
        className={
          variant === 'chip'
            ? 'h-9 w-24 shrink-0 rounded-md md:h-11'
            : 'h-11 w-24 shrink-0 rounded-md'
        }
      />
    )
  }

  // 5xx·네트워크 실패 → 숨긴다. 재시도 UI 를 헤더에 두지 않는다
  if (isError || data === undefined) return null

  return <PetSwitcher pets={data.pets} totalCount={data.totalCount} variant={variant} />
}

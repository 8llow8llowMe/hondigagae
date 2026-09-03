'use client'

import { Skeleton } from '@/components/skeleton'
import { PetSwitcher } from '@/features/nav/pet-switcher'
import { usePetList } from '@/features/pet/use-pet-list'

/**
 * 스위처의 조회 껍데기 — 전역nav-세부명세 D5.
 *
 * `petKeys.list()` 를 **반려견 목록 화면과 공유한다.** `/pets` 에서 등록·수정·삭제하면
 * `petKeys.all` 무효화로 헤더 스위처도 함께 갱신된다 (D3).
 *
 * **조회가 실패하면 스위처를 숨기고 nav 는 유지한다.** 헤더에 `ErrorState` 를 넣지 않는다 —
 * nav 가 에러 화면이 되면 어디로도 갈 수 없다. 그 실패는 홈의 판정 섹션이 대신 알린다.
 */
export function PetSwitcherSlot() {
  const { data, isPending, isError } = usePetList(true)
  // `GlobalHeader` 가 `{authed && <PetSwitcherSlot />}` 로 이미 막는다 (#200)

  if (isPending) return <Skeleton className="h-11 w-24 rounded-md" />

  // 5xx·네트워크 실패 → 숨긴다. 재시도 UI 를 헤더에 두지 않는다
  if (isError || data === undefined) return null

  return <PetSwitcher pets={data.pets} totalCount={data.totalCount} />
}

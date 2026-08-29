'use client'

import { useEffect } from 'react'

import { useSelectedPetStore } from '@/features/nav/selected-pet-store'
import { usePetList } from '@/features/pet/use-pet-list'
import { resolveSelectedPet } from '@/lib/nav/selected-pet'
import type { Pet } from '@/types/pet'

/**
 * 선택된 반려견 하나.
 *
 * 스토어 복원(마운트 후)과 목록 조회, 폴백 판정(`resolveSelectedPet`)을 한 번에 묶는다.
 * 이 셋이 항상 같이 다녀야 하는 이유는 `selected-pet-store.ts` 와 `selected-pet.ts` 주석에 있다.
 *
 * **조회 실패는 `null` 이다.** 반려견을 기준으로 하는 기능(장소 필터의 크기 제한 등)은
 * 그때 컨트롤 자체를 감춘다 — 헤더 스위처가 실패했을 때 숨기는 것과 같은 판단이다.
 */
export function useSelectedPet(): { pet: Pet | null; loading: boolean } {
  const storedPetId = useSelectedPetStore((state) => state.selectedPetId)
  const restore = useSelectedPetStore((state) => state.restore)

  // 서버 렌더에서는 localStorage 를 읽을 수 없다. 마운트 후 복원한다
  useEffect(() => {
    restore()
  }, [restore])

  const { data, isPending } = usePetList()
  const pets = data?.pets ?? []

  return { pet: resolveSelectedPet(pets, storedPetId ?? null), loading: isPending }
}

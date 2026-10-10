import type { Pet } from '@/types/pet'

/**
 * 선택된 반려견을 정한다 — 전역nav-세부명세 D3-1 · D7 #13·#14.
 *
 * 저장된 `petId` 가 **목록에 없으면 첫 번째로 떨어진다.** 반려견을 삭제했거나 다른 계정으로
 * 로그인하면 실제로 이 상황이 된다. 없는 반려견 기준으로 판정을 조회하면 404 가 난다.
 *
 * 목록이 비면 `null` — 호출부가 스위처 대신 "반려견 등록" 버튼을 그린다 (D4-3).
 */
export function resolveSelectedPet(pets: Pet[], storedPetId: string | null): Pet | null {
  if (pets.length === 0) return null

  const stored = pets.find((pet) => pet.petId === storedPetId)

  return stored ?? pets[0] ?? null
}

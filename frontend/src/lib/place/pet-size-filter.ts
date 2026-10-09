import { isPetSizeCode } from '@/lib/pet/form'
import { toPlaceFilterWeight } from '@/lib/pet/weight'
import type { Pet } from '@/types/pet'
import type { PlaceFilters } from '@/types/place'

/**
 * 고른 반려견이 바뀐 뒤의 체구 필터 — 장소-반려견칩-세부명세 D1-2 ②.
 *
 * 체구 필터(`몽실이(소형견)이 들어갈 수 있는 곳만`)는 켜질 때 그 반려견의 크기 · 체중을 URL 에 적는다.
 * 반려견을 바꿔도 URL 이 옛 값이면 결과가 그대로라 필터 문구(`filterPetSizeHint`)가 거짓이 된다 — 필터의
 * 뜻은 "**지금 반려견**이 들어갈 수 있는 곳" 이다.
 *
 * - 체구 필터가 꺼져 있으면 `null` — 할 일이 없다. 켜는 것은 사용자의 몫이다
 * - 켜져 있으면 새 반려견 값으로 갈아 끼운다. 체중을 모르면 크기만(`PetSizeField` 와 같다)
 * - 새 반려견 크기를 모르면 **두 값을 모두 비운다** — 모르는 코드를 보내면 400 이고, `PetSizeField` 도 그때
 *   컨트롤을 숨긴다. 켜진 채 안 보이는 필터를 남기지 않는다
 * - 이미 같은 값이면 `null` — `replace` 를 한 번 더 내지 않는다
 *
 * 다른 축(지역 · 유형 · 동반 · 실내 · 검색어)은 손대지 않는다.
 */
export function petSizeFiltersAfterPetChange(
  filters: PlaceFilters,
  nextPet: Pet,
): PlaceFilters | null {
  // `PetSizeField` 가 켜짐을 판정하는 축과 같다 — 체중은 크기와 함께만 켜진다
  if (filters.petSizeType === null) return null

  const size = isPetSizeCode(nextPet.sizeType.code) ? nextPet.sizeType.code : null
  const weight = size === null ? null : toPlaceFilterWeight(nextPet.weightKg)

  if (filters.petSizeType === size && filters.petWeightKg === weight) return null

  return { ...filters, petSizeType: size, petWeightKg: weight }
}

/**
 * 확정 반려견이 **A → B 로 바뀌었나** — 바뀌었으면 B, 아니면 `null` (장소-반려견칩-세부명세 D1-2 ②).
 *
 * 둘 다 있고 다를 때만 바뀜이다. 직전이 없으면(첫 확정 · 목록 조회 전 · 로그인 직후) **바꿈이 아니다** —
 * 공유 링크를 열자마자 URL 을 고치면 받은 사람이 링크와 다른 결과를 본다. 다음이 없으면(로그아웃 · 0마리)
 * 맞출 대상이 없다.
 *
 * 스토어 복원 전(`selectedPetId === undefined`)의 확정값은 "직전" 으로 잡지 않는다 — 그것은 저장값이 아니라
 * 첫 반려견이라, 복원 뒤 저장 반려견으로 넘어가는 것이 바뀜처럼 보인다. 그 문은 호출부(`PlaceFilterPetSync`)가
 * 닫는다.
 */
export function changedPet(previousPetId: string | null, next: Pet | null): Pet | null {
  if (previousPetId === null || next === null) return null

  return next.petId === previousPetId ? null : next
}

/**
 * 뒤로 · 앞으로 가기로 URL 이 바뀐 뒤 체구 필터를 다시 맞출 값 — 없으면 `null` (#1301 리뷰).
 *
 * 반려견을 바꾸면 맞춤이 지금 칸을 `replace` 로 고치지만 **이전 칸은 고칠 수 없다** — 뒤로 가면 옛 반려견의 체구
 * 값이 돌아와 칩(`지금 초코`)과 결과(소형견 기준)가 어긋난다. 그래서 기록 이동 뒤에 한 번 더 본다.
 *
 * **이번 마운트에서 반려견을 바꾼 적이 있을 때만이다.** 바꾼 적이 없는 세션의 기록 칸은 사용자가 고른 조건이거나
 * 공유 링크로 들어온 조건이라 고치지 않는다 — 첫 로드에 URL 을 고치지 않는 것(`changedPet`)과 같은 판단이다.
 */
export function petSizeFiltersAfterHistory({
  changedThisMount,
  popped,
  filters,
  pet,
}: {
  changedThisMount: boolean
  popped: boolean
  filters: PlaceFilters
  pet: Pet | null
}): PlaceFilters | null {
  if (!changedThisMount || !popped || pet === null) return null

  return petSizeFiltersAfterPetChange(filters, pet)
}

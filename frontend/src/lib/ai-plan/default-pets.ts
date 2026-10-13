import type { Pet } from '@/types/pet'

/**
 * AI 조건 폼이 처음 미리 고르는 반려견 — 이슈 #1381.
 *
 * 예전에는 **한 마리일 때만** 미리 골랐다. 2마리 이상이면 아무도 체크되지 않아, 헤더 스위처에서
 * `몽` 을 골라 둔 사람도 폼에서 다시 골라야 했다(2026-10-11 dev 실측, `ux-review-2026-10-11.md` §3-3).
 *
 * 순서: **헤더에서 고른 아이 → 대표견 → 첫 아이.** 마지막 단계는 아무것도 저장되지 않았을 때 헤더
 * 스위처가 보여 주는 아이와 같다(`resolveSelectedPet`). 한 마리만 고른다 — 여럿을 데려가는지는 화면이
 * 알 수 없다.
 *
 * **링크가 아이를 지목하면(`?pet=<id>`, #1431) 그 아이가 맨 앞이다.** 방금 등록한 아이나 반려견
 * 상세에서 넘어온 사람에게 헤더 선택값 · 대표견을 체크해 두면 다른 아이로 일정이 나간다. 목록에 없는
 * id(지운 아이 · 잘못 붙은 값)는 무시하고 지금 순서로 떨어진다.
 *
 * @param selectedPetId 헤더 스위처의 저장값(`hdg_selected_pet`). 없거나 지운 아이면 무시한다
 * @param requestedPetId 진입 URL 의 `?pet=`. 없으면 생략한다
 */
export function defaultAiPlanPetIds(
  pets: Pet[],
  selectedPetId: string | null,
  requestedPetId: string | null = null,
): string[] {
  const chosen =
    pets.find((pet) => pet.petId === requestedPetId) ??
    pets.find((pet) => pet.petId === selectedPetId) ??
    pets.find((pet) => pet.representative) ??
    pets[0]

  return chosen === undefined ? [] : [chosen.petId]
}

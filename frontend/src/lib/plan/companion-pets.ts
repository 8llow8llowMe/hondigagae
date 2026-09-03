import { messages } from '@/lib/messages'
import type { Pet } from '@/types/pet'

/**
 * 일정의 동행 반려견 (#218).
 *
 * **`petId` 가 아니라 `petIds` 가 기준이다.** 서버는 `plan_pet` 조인 행이 없는 옛 일정도
 * `Plan.resolvePetIds()` 로 `[petId]` 를 채워 주므로 빈 배열이나 누락이 오지 않는다
 * (`types/plan.ts:20`). 대표 한 마리만 읽으면 두 마리 일정이 한 마리로 보이는데,
 * 같은 화면의 일자 판정은 `basisPetNameOf` 로 "함께 가는 아이 중" 을 말한다 — 화면이
 * 두 사실을 동시에 말하게 된다.
 */

/**
 * `petIds` 순서대로 반려견을 찾는다. **순서가 대표를 앞에 둔다** (`petIds[0]` = 대표).
 *
 * 찾지 못한 id 는 조용히 뺀다 — 삭제됐거나 그 아이만 조회에 실패한 경우이고
 * (`types/plan.ts:122`), id 를 노출하거나 "알 수 없음" 을 세우면 화면이 더 나빠진다.
 * `basisPetNameOf` 가 이름을 못 찾을 때와 같은 판단이다.
 */
export function companionPetsOf(petIds: readonly string[], pets: readonly Pet[]): Pet[] {
  const byId = new Map(pets.map((pet) => [pet.petId, pet]))
  return petIds.flatMap((petId) => {
    const pet = byId.get(petId)
    return pet === undefined ? [] : [pet]
  })
}

/** 같은 규칙의 이름 판. 목록 화면은 `Pet` 전체가 아니라 이름 맵만 들고 있다 */
export function companionNamesOf(
  petIds: readonly string[],
  petNames: ReadonlyMap<string, string>,
): string[] {
  return petIds.flatMap((petId) => {
    const name = petNames.get(petId)
    return name === undefined ? [] : [name]
  })
}

/**
 * 목록 행에 쓰는 한 줄. 한 마리면 이름, 두 마리부터는 `{대표} 외 {n-1}마리`.
 *
 * **이름을 나열하지 않는다.** 최대 5마리까지 등록되므로(`pet.ts` limitReached) 나열하면
 * 목록 행의 폭이 터진다. 목록은 신원 요약이고 **전체 명단은 상세가 세운다** — 그래서
 * 상세의 반려견 카드는 동행 전원을 한 줄씩 보여 준다.
 *
 * @returns 반려견을 하나도 못 찾았으면 `null` — 행에서 이 자리만 빠지고 행 자체는 남는다
 *   (공통명세 S8)
 */
export function companionLabel(names: readonly string[]): string | null {
  const first = names[0]
  if (first === undefined) return null
  if (names.length === 1) return first

  return messages.plan.companionMore
    .replace('{name}', first)
    .replace('{count}', String(names.length - 1))
}

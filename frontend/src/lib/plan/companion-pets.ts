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
 *
 * **편집 폼의 초기 체크가 이것을 쓴다** (`planEditPetIds`). 화면에 무엇을 **보여 줄지**는
 * 아래 `planCompanionsOf` 가 정한다 — 폼은 "고를 수 있는 아이" 만 알면 되고, 표시는 "동행
 * 반려견 없음" · "삭제된 반려견" 까지 말해야 해서 둘을 나눴다 (#1042).
 */
export function companionPetsOf(petIds: readonly string[], pets: readonly Pet[]): Pet[] {
  const byId = new Map(pets.map((pet) => [pet.petId, pet]))
  return petIds.flatMap((petId) => {
    const pet = byId.get(petId)
    return pet === undefined ? [] : [pet]
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

/**
 * 화면에 세우는 동행 (#1042).
 *
 * - `unknown` — 반려견 목록을 아직 못 받았거나 조회가 실패했다. **아무것도 단정하지 않는다** —
 *   여기서 "동행 반려견 없음" 을 말하면 반려견 서비스의 일시 장애가 사실처럼 읽힌다
 * - `none` — 미완료 일정인데 `petIds ∩ 내 반려견` 이 비었다. 그 아이만 동행하던 일정은
 *   반려견을 지워도 남고, 서버가 지운 petId 를 자리 표시자로 둔다 (`PLAN_010` 불변식)
 * - `listed` — 찾은 아이(`petIds` 순서) + 완료 일정에서 목록에 없는 아이 수
 */
export type PlanCompanions =
  { kind: 'unknown' } | { kind: 'none' } | { kind: 'listed'; pets: Pet[]; deletedCount: number }

/**
 * 일정의 동행을 표시용으로 읽는다 (#1042). 규칙 정본은 plan-service `반려견이 삭제되면`
 * 절(R1 · R3)이고 화면 규칙은 plan 공통명세 S8 이다.
 *
 * **완료 일정만 지운 아이를 센다.** 서버가 완료 일정의 동행 목록을 불가침으로 두므로(R1) 그
 * 목록에 있는데 내 반려견에 없으면 지워진 아이다. **미완료 일정의 못 찾은 id 는 세지 않는다** —
 * 다견 일정이면 삭제 트리거가 이미 뗐어야 하고(남아 있다면 새벽 배치가 곧 뗀다), 한 마리
 * 일정이면 위 `none` 이 말한다.
 *
 * @param pets 내 반려견 전체. **`null` 은 "모른다"** 이고 빈 배열은 "하나도 없다" 다
 * @param statusCode 일정 상태 code — 서버가 모르는 코드를 내려도 미완료처럼 읽는다 (공통명세 S7)
 */
export function planCompanionsOf(
  petIds: readonly string[],
  pets: readonly Pet[] | null,
  statusCode: string,
): PlanCompanions {
  if (pets === null) return { kind: 'unknown' }

  const found = companionPetsOf(petIds, pets)
  const deletedCount = statusCode === 'COMPLETED' ? petIds.length - found.length : 0

  if (found.length === 0 && deletedCount === 0) return { kind: 'none' }
  return { kind: 'listed', pets: found, deletedCount }
}

/**
 * 지운 아이를 한 줄로 — 한 마리면 "삭제된 반려견", 여럿이면 수를 붙인다. 0 이면 `null`.
 * 목록 행과 상세 카드가 같은 문구를 쓴다 (#1042).
 */
export function deletedCompanionLabel(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return messages.plan.companionDeleted
  return messages.plan.companionDeletedMany.replace('{count}', String(count))
}

/**
 * 목록 행의 한 줄 (#1042) — `companionLabel` 에 지운 아이 · 동행 없음을 더한다.
 *
 * **남은 아이가 있으면 지운 아이도 수에 넣는다.** 함께 다녀온 수가 반려견을 지웠다고 줄면
 * 기록이 바뀐 것처럼 읽힌다. 이름을 부를 아이가 없을 때만 "삭제된 반려견" 이 선다.
 *
 * @returns 모르면 `null` — 행에서 이 자리만 빠진다 (공통명세 S8)
 */
export function planCompanionLabel(companions: PlanCompanions): string | null {
  if (companions.kind === 'unknown') return null
  if (companions.kind === 'none') return messages.plan.companionNone

  const { pets, deletedCount } = companions
  if (pets.length === 0) return deletedCompanionLabel(deletedCount)

  return companionLabel([
    ...pets.map((pet) => pet.name),
    ...Array.from({ length: deletedCount }, () => messages.plan.companionDeleted),
  ])
}

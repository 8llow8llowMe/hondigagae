import { toWeightPayload } from '@/lib/pet/weight'
import type { PetSizeCode } from '@/types/pet'

/**
 * 체중 → 크기 구분. **백엔드 `PetSizeType.fromWeight` 의 복제본이다** (#369).
 *
 * 백엔드가 체중과 크기의 모순 조합을 `PET_004`(400) 로 **거부한다**(#364 · PR #366).
 * 30kg 소형견이 저장되면 적합도 판정이 "소형견만 가능" 장소를 동반 가능으로 읽기 때문이다.
 * FE 가 같은 경계를 들고 선제로 맞춰 주면 사용자가 그 400 을 만나지 않는다.
 *
 * **경계는 10 / 25 이고 위쪽이 열려 있다** — `10.0` 은 중형, `25.0` 은 대형이다.
 * 라디오 안내문(`messages.pet.options.sizeType[].description`)이 화면에서 말하는 값과
 * 같아야 한다: `체중 10kg 미만` · `10kg 이상 25kg 미만` · `25kg 이상`.
 *
 * **체중을 모르면 크기를 지어내지 않는다.** 체중은 선택 입력이라 빈 값이 정당한 답이고,
 * 그때는 크기를 사용자가 직접 고른다 — 백엔드도 `null` 이면 어긋남을 판정하지 않는다.
 */
const MEDIUM_MIN_KG = 10
const LARGE_MIN_KG = 25

export function sizeFromWeight(weightKg: number | null): PetSizeCode | null {
  if (weightKg === null || !Number.isFinite(weightKg)) return null
  if (weightKg < MEDIUM_MIN_KG) return 'SMALL'

  return weightKg < LARGE_MIN_KG ? 'MEDIUM' : 'LARGE'
}

/**
 * 폼 문자열에서 바로 크기를 낸다. 읽을 수 없는 값(입력 중인 `1.`, 빈 값)은 `null` 이다 —
 * **타이핑 도중에 라디오가 튀지 않게 하는 것이 이 갈래의 값어치다.**
 *
 * 단위 표기(`3.5kg`)를 걷는 것까지 `toWeightPayload` 한 곳이 맡는다.
 */
export function sizeFromWeightInput(raw: string): PetSizeCode | null {
  return sizeFromWeight(toWeightPayload(raw))
}

/**
 * 이 크기가 그 체중과 어긋나지 않는가. **체중이 없으면 판정하지 않아 참이다** —
 * 백엔드 `PetSizeType.matchesWeight` 와 같은 규칙이다.
 */
export function sizeMatchesWeightInput(size: PetSizeCode, raw: string): boolean {
  const derived = sizeFromWeightInput(raw)

  return derived === null || derived === size
}

/**
 * 체중이 바뀌었을 때 **크기를 함께 바꿔야 하는가**. 바꿀 필요가 없으면 `null` 이다 — #369.
 *
 * **체중이 크기를 이긴다.** 둘 중 체중이 더 구체적인 사실이고 크기는 그것에서 파생되는
 * 구분이다. 백엔드가 모순 조합을 `PET_004` 로 거부하므로 어긋난 조합은 애초에 만들어질
 * 수 없는 값이고, 사용자가 그 400 을 만나기 전에 폼이 닫는다.
 *
 * **반대 방향은 덮지 않는다.** 사용자가 크기 라디오를 직접 어긋나게 고르면 그 선택을
 * 되돌리지 않고 스키마가 오류로 말한다 — 방금 만진 필드를 화면이 되돌리면 폼과 씨름하는
 * 느낌이 된다. **방금 만진 쪽이 서고, 반대쪽이 따라오거나 오류를 낸다.**
 *
 * 이미 맞는 크기면 `null` 을 돌려준다. 같은 값을 다시 쓰면 `isDirty` 가 켜져
 * 아무것도 고치지 않고 나가는 사용자에게 이탈 경고가 뜬다.
 */
export function sizeChangeForWeight(
  weightInput: string,
  currentSize: PetSizeCode,
): PetSizeCode | null {
  const derived = sizeFromWeightInput(weightInput)

  return derived === null || derived === currentSize ? null : derived
}

import { paths } from '@/lib/api/paths'
import type { PetCondition } from '@/types/insight'
import type { Pet } from '@/types/pet'

/**
 * 장소 인사이트 경로 조립. 전송은 client.ts / server.ts 가 나눠 담당한다
 * (docs/architecture-guide.md §8).
 *
 * **`petId` 를 보내지 않는다.** 백엔드가 반려견 속성을 개별 쿼리 파라미터로 받는다
 * (`PlaceInsightWebController` 실측). 인사이트는 공개 API 라 서버가 반려견을 조회할 수 없다.
 */

/** 반려견이 없으면 `null` — 조건 없이 조회하면 일반(사람 기준) 판정이 온다 */
export function toPetCondition(pet: Pet | null): PetCondition | null {
  if (pet === null) return null

  return {
    petSizeType: pet.sizeType.code,
    heatSensitive: pet.heatSensitive,
    coldSensitive: pet.coldSensitive,
    noiseSensitive: pet.noiseSensitive,
    activityLevel: pet.activityLevel.code,
    breed: pet.breed,
  }
}

/**
 * 조건을 쿼리 문자열로. **값이 없는 파라미터는 넣지 않는다** — 빈 문자열을 보내면
 * 백엔드의 enum 바인딩이 400 을 던진다.
 *
 * boolean 3종은 백엔드 기본값이 `false` 라 참일 때만 보내도 되지만, **명시적으로 보낸다** —
 * 기본값이 바뀌면 조용히 다른 판정이 나온다.
 */
export function toInsightQuery(
  condition: PetCondition | null,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(extra)) {
    if (value !== '') params.set(key, value)
  }

  if (condition !== null) {
    if (condition.petSizeType !== null) params.set('petSizeType', condition.petSizeType)
    if (condition.activityLevel !== null) params.set('activityLevel', condition.activityLevel)
    if (condition.breed !== null && condition.breed !== '') params.set('breed', condition.breed)
    params.set('heatSensitive', String(condition.heatSensitive))
    params.set('coldSensitive', String(condition.coldSensitive))
    params.set('noiseSensitive', String(condition.noiseSensitive))
  }

  return params.toString()
}

export function suitabilityPath(placeId: string, condition: PetCondition | null): string {
  return paths.places.suitability(placeId, toInsightQuery(condition))
}

export function walkSafetyPath(placeId: string, condition: PetCondition | null): string {
  return paths.places.walkSafety(placeId, toInsightQuery(condition))
}

export function planWeatherPath(planId: string): string {
  return paths.plans.weather(planId)
}

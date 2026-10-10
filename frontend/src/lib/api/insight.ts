import { paths } from '@/lib/api/paths'
import type { CongestionDays } from '@/lib/insight/congestion'
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
    petSociality: pet.sociality.code,
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
    if (condition.petSociality !== null) params.set('petSociality', condition.petSociality)
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

/**
 * 기간 혼잡도 (#430).
 *
 * **반려견 조건을 싣지 않는다.** 붐빔은 장소와 날짜의 속성이라 반려견이 바뀌어도 같은
 * 값이고, dev Swagger 실측(2026-09-14)에서도 이 경로는 조건 파라미터를 선언하지 않는다.
 * 조건을 함께 보내면 조회 key 가 반려견마다 갈려 같은 답을 여러 벌 캐시하게 된다.
 *
 * **`fromDate` 를 보내지 않는다.** 생략하면 서버가 오늘로 잡는다 — 권역 비교(`date`)와
 * 같은 판단이다. FE 가 날짜를 만들면 브라우저 타임존이 KST 가 아닌 사용자에게 어제부터의
 * 기간이 나간다.
 *
 * **`days` 는 기본값(7)이어도 명시한다.** 백엔드 기본값이 바뀌면 조용히 다른 기간이 오고,
 * 그때 카드 머리의 기간 표기만 서버 응답을 따라가 화면이 스스로 어긋난다.
 */
export function congestionsPath(placeId: string, days: CongestionDays): string {
  return paths.places.congestions(placeId, new URLSearchParams({ days: String(days) }).toString())
}

/**
 * 오늘의 산책 골든타임 (#158).
 *
 * **좌표가 필수다.** FE 에 아직 현재 위치 축이 없어 호출부가 제주 대표 좌표를 넘긴다 —
 * 그 사실을 화면이 "제주시 기준" 으로 밝힌다. 이 함수는 좌표의 출처를 판단하지 않는다.
 *
 * 반려견 조건 파라미터는 적합도·산책 위험도와 같은 조립을 쓴다. 서버가 받지 않는
 * `noiseSensitive` · `petSociality` 가 섞여 가지만 Spring 이 모르는 쿼리 파라미터를
 * 무시하므로 안전하고, 축마다 다른 조립을 두면 조건이 갈릴 때 어느 쪽이 맞는지 알 수 없어진다.
 *
 * **dev Swagger 실측(2026-09-13)으로 확인했다** — `petSociality` 를 선언하는 경로는
 * `/places/{placeId}/suitability` 하나뿐이고, 골든타임은 `noiseSensitive` 도 받지 않는다.
 */
export function walkTimesPath(lat: number, lng: number, condition: PetCondition | null): string {
  return paths.insights.walkTimes(toInsightQuery(condition, { lat: String(lat), lng: String(lng) }))
}

/**
 * 제주 권역 날씨 비교 (#158).
 *
 * **`date` 를 보내지 않는다.** 생략하면 서버가 오늘로 잡고, FE 가 날짜를 만들면 서버 시각과
 * 어긋날 수 있다 — 브라우저 타임존이 KST 가 아닌 사용자에게 어제 비교표가 나간다.
 */
export function regionalWeatherPath(condition: PetCondition | null): string {
  return paths.insights.regionalWeather(toInsightQuery(condition))
}

export function planWeatherPath(planId: string): string {
  return paths.plans.weather(planId)
}

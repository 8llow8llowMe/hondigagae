import { formatDistance } from '@/lib/format/distance'
import { messages } from '@/lib/messages'
import type { NearbyFacilityItem, NearbyFacilityResult } from '@/types/emergency'

/**
 * 홈 배너가 가리킬 병원 하나.
 *
 * **왜 하나만 고르나** — 배너는 목록이 아니라 진입점이다. 여기서 할 일은 "지금 어디가
 * 열려 있나" 를 다 세는 것이 아니라, 눌러 볼 이유를 주는 것이다. 정확한 개수는 다음
 * 화면이 센다 ([#206](https://github.com/8llow8llowMe/hondigagae/issues/206) 의 판단을
 * 그대로 따른다 — 홈이 수를 적어 두면 목록과 어긋난다).
 *
 * **약국을 섞지 않는다.** 응답은 병원과 약국이 섞여 오는데(`NearbyFacilityResult` 주석)
 * 배너 제목이 "주변 동물병원 찾기" 라 약국을 골라 놓으면 제목과 다른 것을 말하게 된다.
 *
 * 고르는 순서에 뜻이 있다.
 *
 * | kind      | 무엇을 골랐나                | 왜 이 순서인가                                    |
 * | --------- | ---------------------------- | ------------------------------------------------- |
 * | `open24`  | 가장 가까운 24시간 병원      | 위급은 시각을 가리지 않는다. 밤에 유일한 답이다   |
 * | `openNow` | 가장 가까운 지금 진료중 병원 | 24시간이 없으면 지금 갈 수 있는 곳이 다음이다     |
 * | `nearest` | 그냥 가장 가까운 병원        | 닫혀 있어도 위치는 미리 알아 둘 값이 있다        |
 *
 * **`openNow === null` 을 `openNow` 로 치지 않는다.** null 은 "닫힘" 이 아니라 "영업시간
 * 정보가 없어 판정할 수 없음" 이고(`NearbyFacilityItem` 주석), 그것을 "지금 진료중" 이라고
 * 부르면 급할 때 헛걸음시킨다. 그런 곳은 `nearest` 로만 뽑힌다.
 */
export type NearestHospital = {
  facility: NearbyFacilityItem
  kind: 'open24' | 'openNow' | 'nearest'
}

export function pickNearestHospital(
  result: NearbyFacilityResult | null | undefined,
): NearestHospital | null {
  const hospitals = (result?.facilities ?? []).filter(
    (facility) => facility.facilityType.code === 'ANIMAL_HOSPITAL',
  )

  if (hospitals.length === 0) return null

  /*
    응답이 "가까운 순" 이라고 계약에 적혀 있지만 여기서 다시 최솟값을 고른다 — 정렬을
    믿고 `[0]` 을 집으면, 서버가 정렬을 바꾸는 날 화면은 조용히 틀린 답을 말한다.
  */
  const open24 = nearestOf(hospitals, (facility) => facility.open24)
  if (open24 !== null) return { facility: open24, kind: 'open24' }

  const openNow = nearestOf(hospitals, (facility) => facility.openNow === true)
  if (openNow !== null) return { facility: openNow, kind: 'openNow' }

  const nearest = nearestOf(hospitals, () => true)
  return nearest === null ? null : { facility: nearest, kind: 'nearest' }
}

/**
 * 홈 병원 배너의 설명줄.
 *
 * **찾지 못했으면 지금까지의 고정 문구로 남는다.** 좌표 미허용 · 조회 전 · 실패 · 반경 안에
 * 병원이 없음이 모두 `null` 로 들어온다 — 배너는 어떤 상태에서도 사라지지 않아야 하고
 * (`components/banner.tsx`), 그 고정 문구는 수를 세지 않으므로 어긋날 것이 없다.
 *
 * **개수를 말하지 않는다** ([#206](https://github.com/8llow8llowMe/hondigagae/issues/206)).
 * 시설 하나를 가리킬 뿐이고 그 값은 눌러 들어갈 화면과 **같은 API** 에서 왔다 — 예전에
 * 홈이 "3곳" 을 박아 두고 목록은 "반경 안에 없어요" 라고 말했던 어긋남이 여기서는
 * 구조적으로 생기지 않는다.
 */
export function hospitalBannerDescription(nearest: NearestHospital | null): string {
  if (nearest === null) return messages.home.emergencyDesc

  const template =
    nearest.kind === 'open24'
      ? messages.home.emergencyNearest24h
      : nearest.kind === 'openNow'
        ? messages.home.emergencyNearestOpen
        : messages.home.emergencyNearest

  return template
    .replace('{name}', nearest.facility.name)
    .replace('{distance}', formatDistance(nearest.facility.distanceMeters))
}

function nearestOf(
  facilities: NearbyFacilityItem[],
  matches: (facility: NearbyFacilityItem) => boolean,
): NearbyFacilityItem | null {
  return facilities.reduce<NearbyFacilityItem | null>((closest, facility) => {
    if (!matches(facility)) return closest
    if (closest === null) return facility
    return facility.distanceMeters < closest.distanceMeters ? facility : closest
  }, null)
}

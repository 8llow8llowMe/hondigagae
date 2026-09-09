import type {
  FacilityFilters,
  FacilityTypeCode,
  NearbyFacilityItem,
  NearbyFacilityResult,
} from '@/types/emergency'

/**
 * 목록을 화면에서 좁힌다. **서버로 보내지 않는 이유는 `lib/api/emergency.ts` 에 있다.**
 *
 * **서버가 준 순서를 유지한다.** 병원과 약국이 거리순으로 섞여 오는데 24시간을 위로
 * 올려 재정렬하면 "가까운 순" 이라는 말과 어긋난다 (아트보드 주석). 이 파일은 거르기만
 * 하고 정렬을 건드리지 않는다.
 */
export function applyFilters(
  facilities: readonly NearbyFacilityItem[],
  filters: FacilityFilters,
): NearbyFacilityItem[] {
  return facilities.filter((facility) => {
    if (filters.type !== null && facility.facilityType.code !== filters.type) return false
    if (filters.open24Only && !facility.open24) return false
    // **`openNow === null` 은 걸러낸다.** "지금 진료중" 은 확인된 곳만 보겠다는 뜻이고,
    // 판정할 수 없는 곳을 여기 넣으면 그 토글이 약속을 지키지 못한다
    if (filters.openNowOnly && facility.openNow !== true) return false

    return true
  })
}

/**
 * 칩에 붙는 개수.
 *
 * **각 칩은 "그 칩만 눌렀을 때" 의 개수다.** 지금 켜진 다른 조건을 함께 곱하면
 * 화면에 보이는 목록과 같은 수가 되어 칩이 아무것도 알려주지 못한다 — 사용자가
 * 칩을 누르는 이유는 "저기로 가면 몇 개인가" 를 알기 위해서다.
 */
export function facilityCounts(facilities: readonly NearbyFacilityItem[]): {
  all: number
  byType: Record<FacilityTypeCode, number>
  open24: number
  openNow: number
} {
  return {
    all: facilities.length,
    byType: {
      ANIMAL_HOSPITAL: facilities.filter((f) => f.facilityType.code === 'ANIMAL_HOSPITAL').length,
      ANIMAL_PHARMACY: facilities.filter((f) => f.facilityType.code === 'ANIMAL_PHARMACY').length,
    },
    open24: facilities.filter((f) => f.open24).length,
    openNow: facilities.filter((f) => f.openNow === true).length,
  }
}

/**
 * 개수를 화면에 써도 되는가.
 *
 * 칩 개수는 **받아 온 목록에서 센 것**이다. 반경 안에 더 있는데 `size` 로 잘렸다면 그
 * 수는 전체가 아니다 — **틀린 개수는 없는 개수보다 나쁘다.** 잘렸으면 칩에서 숫자를 뺀다.
 *
 * **`totalCount` 가 자르기 전 총계다** (#297 · BE #285 / PR #296). dev 실측
 * 2026-09-08: 제주시청 · `radius=10000` 에서 `size` 를 3 / 50 / 250 으로 바꿔 불러도
 * `totalCount` 는 **136 으로 고정**이고 `facilities.length` 만 3 / 50 / 136 으로 따라온다.
 * 그래서 받은 개수와 총계를 비교하면 잘림을 정직하게 알 수 있다.
 *
 * **상한 도달(`length >= MAX_SIZE`) 우회는 걷었다.** `totalCount` 가 `size` 를 그대로
 * 따라오던 시절의 대체 판정이었는데(#281 / PR #283), 그 전제가 사라졌다. 우회는 "잘렸다"
 * 만 알려주고 "얼마나 더 있는지" 는 말하지 못했고, 상한만큼 정확히 온 정상 응답을
 * 잘린 것으로 오판했다.
 */
export function countsAreComplete(result: NearbyFacilityResult): boolean {
  return result.facilities.length >= result.totalCount
}

/**
 * 결과가 0건일 때 **무엇을 지우면 몇 개가 되는지** — 아트보드 03 "결과 없음".
 *
 * "조건을 바꿔 보세요" 로 끝내지 않는다. 켜져 있는 조건을 하나씩 꺼 보고 **실제로
 * 몇 개가 나오는지** 세어 제안으로 만든다. 셀 수 있으므로 센다.
 */
export type FilterRelief = {
  /** 이 조건을 끈 결과 */
  next: FacilityFilters
  /** 껐을 때 나오는 개수. **0 이면 제안하지 않는다** */
  count: number
  kind: 'type' | 'open24Only' | 'openNowOnly'
}

export function reliefs(
  facilities: readonly NearbyFacilityItem[],
  filters: FacilityFilters,
): FilterRelief[] {
  const candidates: { kind: FilterRelief['kind']; next: FacilityFilters }[] = []

  if (filters.openNowOnly) {
    candidates.push({ kind: 'openNowOnly', next: { ...filters, openNowOnly: false } })
  }
  if (filters.open24Only) {
    candidates.push({ kind: 'open24Only', next: { ...filters, open24Only: false } })
  }
  if (filters.type !== null) {
    candidates.push({ kind: 'type', next: { ...filters, type: null } })
  }

  return (
    candidates
      .map((candidate) => ({
        ...candidate,
        count: applyFilters(facilities, candidate.next).length,
      }))
      // 눌러도 여전히 0 이면 제안이 아니다
      .filter((candidate) => candidate.count > 0)
  )
}

/**
 * 칩 라벨에 개수를 붙인다. **붙일 수 있을 때만 붙인다** — 잘린 목록에서 센 수는
 * 전체가 아니고, 틀린 개수는 없는 개수보다 나쁘다 (`countsAreComplete`).
 *
 * 목록 갈래(`EmergencySection`)와 지도 갈래(`EmergencyFilterBar`)가 함께 쓴다.
 * 각자 갖고 있으면 한쪽만 고쳐져 같은 칩이 화면마다 다르게 보인다.
 */
export function labelWithCount(label: string, count: number, show: boolean): string {
  return show ? `${label} ${String(count)}` : label
}

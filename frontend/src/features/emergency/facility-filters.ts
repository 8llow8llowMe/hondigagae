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
 * 칩 개수는 **받아 온 목록에서 센 것**이다. `size` 상한(50)에 걸려 잘렸다면 그 수는
 * 전체가 아니다 — **틀린 개수는 없는 개수보다 나쁘다.** 잘렸으면 칩에서 숫자를 뺀다.
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

import { messages } from '@/lib/messages'
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
    if (!matchesKeyword(facility, filters.keyword)) return false

    return true
  })
}

/**
 * 시설명 · 주소 검색 (#584). **서버로 보내지 않고 화면에서 좁힌다.**
 *
 * `/emergencies/facilities` 에는 `keyword` 파라미터가 없다 (dev Swagger 실측). 그런데 이
 * 화면은 이미 **반경 안 전량을 받아** 유형·영업 조건을 화면에서 거르고 있고(이 파일 머리
 * 주석), 기본 반경 10km 의 136곳은 그 범위 안이다 — 받아 둔 것을 한 번 더 거르는 일이라
 * 새 요청이 필요 없다. **전국으로 넓어지면 이 판단이 깨진다**: 목록이 `size` 로 잘리는
 * 순간 검색은 "받아 온 것 중에서" 가 되어 **있는 곳을 없다고** 말하게 된다. 그때는 서버
 * `keyword` 계약을 먼저 연다 (이슈 #584 본문).
 *
 * ### 공백으로 끊어 전부 만족(AND)
 *
 * `"제주 병원"` 은 `"제주동물병원 · 제주시 …"` 를 찾아야 한다. 통짜 부분문자열로 보면
 * 이름과 주소 사이를 걸친 말이 아무것도 못 찾고, 사용자는 자기가 아는 두 단어를 붙여
 * 쓸 이유가 없다. **순서는 보지 않는다** — `"병원 제주"` 도 같은 곳을 찾는다.
 *
 * 이름과 주소를 **한 건초더미로 합쳐** 본다. 따로 보면 `"제주 병원"` 처럼 한 단어는
 * 주소에, 한 단어는 이름에 있는 검색이 실패한다.
 *
 * 대소문자는 무시한다 — 주소에 로마자가 섞인 곳이 있다. **자모 분해나 초성 검색은
 * 하지 않는다**: `Intl` 없이 직접 구현하면 틀리는 자리가 많고, 틀린 검색 결과는 급할 때
 * 여는 이 화면에서 **있는 병원을 없다고** 말하는 것과 같다.
 */
export function matchesKeyword(facility: NearbyFacilityItem, keyword: string | null): boolean {
  if (keyword === null) return true

  const haystack = `${facility.name} ${facility.addr}`.toLowerCase()

  return keyword
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '')
    .every((token) => haystack.includes(token))
}

/**
 * 검색어까지만 좁힌 배열 — **개수를 세기 전에 통과시킨다.**
 *
 * 칩 개수는 "그 칩만 눌렀을 때" 의 수인데(`facilityCounts`), 검색어는 칩이 아니라
 * **범위**다 (`FacilityFilters.keyword` 주석). 검색 중에 칩이 반경 전량의 수를 말하면
 * 눌러서 나오는 결과와 어긋나므로, 개수를 세는 쪽은 이 함수를 먼저 태운다.
 *
 * `applyFilters` 와 따로 두는 이유: 세는 배열은 다른 축이 **걸리기 전**이어야 한다.
 */
export function narrowByKeyword(
  facilities: readonly NearbyFacilityItem[],
  keyword: string | null,
): readonly NearbyFacilityItem[] {
  /*
    **검색어가 없으면 받은 배열을 그대로 돌려준다** — `.filter()` 는 언제나 새 배열이라,
    검색하지 않는 절대다수의 경우에 `useMemo` 로 안정화해 둔 `inBounds` 참조가 여기서
    매 렌더 깨진다 (`emergency-map-view.tsx` · `use-emergency-nav.ts` 가 같은 이유로
    참조를 지킨다). 반환 타입이 `readonly` 인 것은 그 되돌려준 배열을 부르는 쪽이 고치면
    안 되기 때문이다.
  */
  if (keyword === null) return facilities

  return facilities.filter((facility) => matchesKeyword(facility, keyword))
}

/**
 * 칩에 붙는 개수.
 *
 * **각 칩은 "그 칩만 눌렀을 때" 의 개수다.** 지금 켜진 다른 조건을 함께 곱하면
 * 화면에 보이는 목록과 같은 수가 되어 칩이 아무것도 알려주지 못한다 — 사용자가
 * 칩을 누르는 이유는 "저기로 가면 몇 개인가" 를 알기 위해서다.
 *
 * **검색어는 예외다 — 부르는 쪽이 `narrowByKeyword` 로 먼저 좁혀 넘긴다** (#584).
 * 검색어는 축이 아니라 범위라, 검색 중인데 칩이 반경 전량의 수를 말하면 눌러서 나오는
 * 결과와 어긋난다. 이 함수가 스스로 좁히지 않는 것은 `filters` 를 받지 않기 때문이고,
 * 받지 않는 것은 위의 "다른 조건을 곱하지 않는다" 를 타입으로 지키기 위해서다.
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
  kind: 'type' | 'open24Only' | 'openNowOnly' | 'keyword'
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
  /*
    **검색어는 맨 뒤다** (#584). 사용자가 직접 친 말이라 가장 버리기 아까운 조건이고,
    켜 둔 칩을 끄는 쪽이 먼저 시도할 값이다. 버튼 순서가 곧 제안 순서다.
  */
  if (filters.keyword !== null) {
    candidates.push({ kind: 'keyword', next: { ...filters, keyword: null } })
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

/**
 * `24시간` 칩 옆 안내 — **데이터 한계를 개수와 함께 정직하게 말한다** (#654 E-3).
 *
 * `24시간 1` 이라는 칩은 *"제주에 24시간 병원이 한 곳"* 으로 읽히지만 실제로는
 * *"원본 데이터에 24시간이라고 적힌 곳이 한 곳"* 이다. 그 차이를 칩이 스스로 말할 수
 * 없어(라벨은 `labelWithCount` 가 숫자만 붙인다) 옆줄이 맡는다.
 *
 * **`labelWithCount` 와 같은 `showCounts` 를 받는다.** 잘린 목록에서 센 수는 전체가
 * 아니므로, 칩이 숫자를 빼는 순간 이 줄도 숫자를 뺀다 — 한쪽만 숫자를 말하면
 * 화면 안에서 두 문장이 서로를 부정한다.
 *
 * 목록 갈래(칩·레일)와 지도 툴바가 함께 쓴다. `labelWithCount` 와 같은 이유로 여기 하나만 둔다.
 */
export function open24Note(count: number, showCounts: boolean): string {
  if (!showCounts) return messages.emergency.open24NoteUnknown
  if (count === 0) return messages.emergency.open24NoteNone

  return messages.emergency.open24Note.replace('{n}', String(count))
}

/**
 * `reliefs()` 결과 한 항목을 화면 문구로 바꾼다.
 *
 * 목록 갈래(`EmergencySection`)와 지도 갈래(`EmergencyMapView`)가 함께 쓴다.
 * `labelWithCount` 와 같은 이유로 여기 하나만 둔다 — 각자 갖고 있으면 한쪽만
 * 고쳐져 같은 relief 버튼이 화면마다 다르게 보인다.
 */
export function reliefLabel(option: FilterRelief): string {
  const template =
    option.kind === 'openNowOnly'
      ? messages.emergency.reliefOpenNow
      : option.kind === 'open24Only'
        ? messages.emergency.reliefOpen24
        : option.kind === 'keyword'
          ? messages.emergency.reliefKeyword
          : messages.emergency.reliefType

  return template.replace('{n}', String(option.count))
}

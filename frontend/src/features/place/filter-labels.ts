import { CAFE_SOURCE_CATEGORY, isCafePlace } from '@/lib/place/cafe'
import type { ContentTypeCode, PetAllowanceCode, PlaceFilters } from '@/types/place'

/**
 * 필터 UI 전용 라벨.
 *
 * 목록 응답의 metadata 는 "결과에 등장한 값"만 담고 있어 **필터 선택지를 채울 수 없다.**
 * 그래서 이 표만 FE 가 갖는다. 카드 등 **데이터를 표시하는 곳에서는 여전히 서버가 준
 * `name` 을 그대로 쓴다** (docs/api-integration-guide.md §6).
 *
 * TODO(BE): enum 목록 조회 API 가 생기면 이 표를 제거한다.
 */
export const CONTENT_TYPE_LABEL: Record<ContentTypeCode, string> = {
  TOURIST_SPOT: '관광지',
  CULTURE: '문화시설',
  FESTIVAL: '축제·공연',
  COURSE: '여행코스',
  LEPORTS: '레포츠',
  LODGING: '숙박',
  SHOPPING: '쇼핑',
  RESTAURANT: '음식점',
}

/**
 * 필터에 **보여 주는 순서.** `CONTENT_TYPE_CODES`(`types/place.ts`)는 백엔드 enum 의
 * 선언 순서라 화면 순서로 쓰면 반려견 여행과 무관한 축이 앞에 온다.
 *
 * 순서의 근거: 이 서비스에서 먼저 찾는 것은 **갈 곳 → 먹을 곳 → 잘 곳**이다.
 * 지도 필터 줄(`place-map-filter-bar.tsx`)은 한 줄이라(#1314) 유형 앞에 `필터` · 반려견 칩 · `동반 가능만` 이
 * 선다 — **390 로그인에서 스크롤 없이 보이는 유형은 `전체` 뒤 한 개 남짓이다**(실측 `관광지` 가 fade 속에 걸린다).
 * 무엇을 앞에 두는지가 실제로 도달률을 바꾼다. 여행코스는 개별 장소가 아니라 장소 묶음이라 맨 뒤다.
 *
 * **레일·시트도 이 순서를 쓴다.** 같은 축의 두 컨트롤이 다른 순서로 보이면 사용자가
 * 목록에서 익힌 위치가 지도에서 통하지 않는다.
 */
export const CONTENT_TYPE_FILTER_ORDER = [
  'TOURIST_SPOT',
  'RESTAURANT',
  'LODGING',
  'CULTURE',
  'LEPORTS',
  'FESTIVAL',
  'SHOPPING',
  'COURSE',
] as const satisfies readonly ContentTypeCode[]

/**
 * **장소 종류** — 유형 축에 **카페**를 더한 화면의 선택지 (#1156).
 *
 * 백엔드 `contentType` 에는 카페가 없다 — 음식점(`RESTAURANT`)에 섞여 있다. 그래서 "강아지랑
 * 갈 카페" 를 찾는 사용자가 좁힐 방법이 없었다 (2026-10-06 사용성 점검). 원천 분류
 * `sourceCategory=카페` 를 음식점과 **함께** 걸어 한 칩으로 낸다 — 백엔드가 이미 받는 조건이다
 * (Swagger: *"카페만 볼 때는 sourceCategory=카페 를 함께 씁니다"*).
 *
 * **카페 분류만 쓴다 (사용자 결정 2026-10-06).** dev 실측(음식점 815곳): `카페` 24곳은 **전부
 * 동반 가능**이다. 이름이 카페 같은 곳 93곳 중 72곳은 TourAPI 출처라 원천 분류가 비어 있고
 * 동반 정보도 "모름" 이라, 이 과제의 답이 아니다. 휴게음식점 · 제과점에 등록된 카페는 놓친다.
 *
 * 유형 축은 라디오라(`contentType` 단일 값) 카페도 **같은 줄의 한 선택지**다 — 음식점과 카페가
 * 함께 켜져 보이지 않게 `withPlaceKind` 가 한쪽을 고르면 다른 쪽을 푼다.
 */
export type PlaceKind = ContentTypeCode | 'CAFE'

/** 화면 순서 — 유형 순서 그대로에 카페를 **음식점 바로 뒤**에 끼운다 (먹을 곳 묶음) */
export const PLACE_KIND_FILTER_ORDER: readonly PlaceKind[] = CONTENT_TYPE_FILTER_ORDER.flatMap(
  (code): PlaceKind[] => (code === 'RESTAURANT' ? [code, 'CAFE'] : [code]),
)

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  ...CONTENT_TYPE_LABEL,
  CAFE: '카페',
}

/**
 * 장소 행의 유형 배지 글자 (#1181).
 *
 * **카페 분류인 음식점은 `카페` 라고 쓴다.** `카페` 칩(위 `withPlaceKind`)으로 찾은 결과가 전부
 * `음식점` 배지라, 고른 것과 다른 이름으로 말했다(2026-10-06 사용성 점검 2회차). 칩과 같은 판정
 * (`RESTAURANT` + 원천 분류 `카페`)이라 칩을 고르지 않은 전체 목록에서도 같은 곳은 같은 이름이다.
 *
 * **매핑표가 아니다** — 쓰는 글자는 서버가 준 원천 분류 문자열 그대로다(서버 enum 렌더 규칙,
 * styling-guide.md §7). 다른 원천 분류(`펜션` · `미술관` …)로 넓히지 않는다: 그 값들은 유형
 * 배지와 갈리는 이유가 없거나 화면에서 고를 수 없는 축이라, 넓히면 배지 체계가 원천마다 달라진다.
 */
export function placeTypeLabel(place: {
  contentType: { code: string; name: string }
  sourceCategory: string | null
}): string {
  // 판정은 `isCafePlace` 하나 — 지도 핀 아이콘(#1280)과 갈리지 않게
  if (isCafePlace(place) && place.sourceCategory !== null) return place.sourceCategory
  return place.contentType.name
}

/** 지금 걸린 종류. 없으면 `null`(전체). 주소로 카페 분류만 걸려 와도 카페로 읽는다 */
export function placeKindOf(filters: PlaceFilters): PlaceKind | null {
  if (filters.sourceCategory === CAFE_SOURCE_CATEGORY) return 'CAFE'
  return filters.contentType
}

/** 종류를 고른다. **유형 · 원천 분류 두 칸만** 바꾸고 다른 축은 그대로 둔다 */
export function withPlaceKind(filters: PlaceFilters, kind: PlaceKind | null): PlaceFilters {
  if (kind === 'CAFE') {
    return { ...filters, contentType: 'RESTAURANT', sourceCategory: CAFE_SOURCE_CATEGORY }
  }
  return { ...filters, contentType: kind, sourceCategory: null }
}

export const PET_ALLOWANCE_LABEL: Record<PetAllowanceCode, string> = {
  ALLOWED: '동반 가능',
  PARTIALLY_ALLOWED: '부분 동반 가능',
  NOT_ALLOWED: '동반 불가',
  UNKNOWN: '정보 없음',
}

/**
 * 시군구 라벨 — 관광 시군구코드.
 *
 * 근거: backend `MidTermRegion`(tour-service insight) 의 상수 — 서귀포시 `"3"` / 제주시 `"4"`.
 * 원천 데이터에는 폐지된 남·북제주군 코드(`"1"`/`"2"`)도 남아 있다. **선택지로 두지 않는다** —
 * 아트보드가 세 갈래(전체/제주시/서귀포시)이고, 폐지된 행정구역을 사용자에게 물을 이유가 없다.
 * 그 장소들은 "제주 전체" 에서 보인다.
 */
export const SIGUNGU_LABEL: Record<string, string> = {
  '3': '서귀포시',
  '4': '제주시',
}

/** 선택 순서. `null` 은 "제주 전체" 다 */
export const SIGUNGU_CODES = ['4', '3'] as const

/** 실내/야외 축. `null` 은 전체다 */
export const INDOOR_LABEL = {
  indoor: '실내만',
  outdoor: '야외만',
} as const

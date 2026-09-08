import type { ContentTypeCode, PetAllowanceCode } from '@/types/place'

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
 * 지도 필터 줄(`place-map-filter-bar.tsx`)은 폭이 400 이라 **앞 두세 개만 스크롤 없이
 * 보인다** — 무엇을 앞에 두는지가 실제로 도달률을 바꾼다. 여행코스는 개별 장소가 아니라
 * 장소 묶음이라 맨 뒤다.
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

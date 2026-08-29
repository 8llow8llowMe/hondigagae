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

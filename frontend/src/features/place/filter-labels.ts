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

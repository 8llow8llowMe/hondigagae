/** 장소 탐색 화면 문구. 확정 근거: docs/features/place/공통명세.md S4 */
export const placeMessages = {
  pageTitle: '장소 찾기',
  pageDescription: '반려견과 함께 갈 수 있는 제주 장소를 찾아보세요.',

  /** 결과 0건 또는 404 — 재시도가 아니라 다음 행동을 안내한다 */
  emptyTitle: '조건에 맞는 장소가 없습니다',
  emptyDescription: '필터를 바꿔 다시 찾아보세요.',
  resetFilters: '필터 초기화',

  /** 5xx */
  errorTitle: '장소를 불러오지 못했습니다',

  filterAll: '전체',
  filterContentTypeLabel: '장소 종류',
  filterPetAllowanceLabel: '반려견 동반',

  noImage: '이미지 없음',
  petAllowanceUnknown: '동반 정보 없음',
} as const

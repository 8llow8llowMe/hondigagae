/**
 * 장소 탐색 화면 문구.
 * 확정 근거: docs/features/place/공통명세.md S4, docs/features/place/장소상세-세부명세.md D5·D5-1
 */
export const placeMessages = {
  pageTitle: '장소 찾기',
  pageDescription: '반려견과 함께 갈 수 있는 제주 장소를 찾아보세요.',

  /** 결과 0건 또는 404 — 재시도가 아니라 다음 행동을 안내한다 */
  emptyTitle: '조건에 맞는 장소가 없습니다',
  emptyDescription: '필터를 바꿔 다시 찾아보세요.',
  resetFilters: '필터 초기화',

  /** 5xx */
  errorTitle: '장소를 불러오지 못했습니다',

  /** 필터가 걸렸을 때만 노출되는 요약 줄. 결과 건수는 백엔드가 주지 않는다(SliceResponse) */
  activeFilterLabel: '적용된 필터',

  filterAll: '전체',
  filterContentTypeLabel: '장소 종류',
  filterPetAllowanceLabel: '반려견 동반',

  noImage: '이미지 없음',
  petAllowanceUnknown: '동반 정보 없음',

  // ── 장소 상세 ──────────────────────────────────────────────

  backToList: '장소 목록으로',

  /** 경로가 가리키는 장소가 없다 — not-found.tsx */
  detailNotFoundTitle: '장소를 찾을 수 없습니다',
  detailNotFoundDescription: '주소가 잘못되었거나 삭제된 장소입니다.',

  /** 5xx·무응답 */
  detailErrorTitle: '장소 정보를 불러오지 못했습니다',

  detailSectionOverview: '장소 소개',
  detailSectionIntro: '이용 안내',
  detailSectionPet: '반려견 동반 정보',
  detailSectionImages: '사진',

  detailAddress: '주소',
  detailTel: '전화',
  detailHomepage: '홈페이지',

  detailInfoCenter: '문의처',
  detailUseTime: '운영시간',
  detailRestDate: '휴무일',
  detailParking: '주차',
  detailBabyCarriage: '유모차 대여',
  detailCreditCard: '신용카드',

  detailPetScope: '동반 가능 구역',
  detailPetSize: '동반 가능 크기',
  detailLeashRequired: '목줄 필요',
  detailPetType: '동반 유형',
  detailPetAnimal: '동반 가능 동물',
  detailPetNeed: '동반 시 필요사항',
  detailPetEtc: '기타 안내',
  detailPetRisk: '사고 대비사항',
  detailPetFacility: '부대시설',
  detailPetFurnished: '비치 품목',
  detailPetPurchase: '구매 가능 품목',
  detailPetRental: '대여 가능 품목',
  /** intro.chkPet — DTO 주석이 "판단은 petInfo 우선" 이라 참고 값으로만 둔다 */
  detailPetSourceText: '원천 표기',

  /**
   * 저작권 출처 표기. cpyrhtDivCd 는 TourAPI 원천에서만 채워지므로
   * 값이 있으면 제공처가 한국관광공사다 (세부명세 D5-2).
   */
  detailCopyrightPrefix: '사진·정보 출처: 한국관광공사',
  detailCopyrightType1: '공공누리 제1유형 (출처 표시)',
  detailCopyrightType3: '공공누리 제3유형 (출처 표시·변경 금지)',
  detailCopyrightUnknown: '출처 표시 대상',
} as const

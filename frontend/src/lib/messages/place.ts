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

  /**
   * 필터 영역.
   *
   * **"적용된 필터" 칩 줄을 두지 않는다** — 디자인 가이드 §5: "같은 필터 상태를 세 곳에
   * 두지 않는다. 컨트롤이 이미 보여주면 요약 줄은 없앤다."
   *
   * 결과 건수(`34곳`)와 선택지별 건수(`제주시 34`)는 **문구를 만들지 않는다.**
   * `SliceResponse` 는 `{contents, hasNext}` 뿐이고 facet 집계 API 도 없다.
   */
  filterTitle: '필터',
  filterAll: '전체',
  filterMore: '더보기',
  filterApply: '이 조건으로 보기',
  filterCancel: '취소',

  filterContentTypeLabel: '유형',
  filterPetAllowanceLabel: '반려견 동반',
  filterAllowedOnly: '반려견 동반 가능만',

  filterRegionLabel: '지역',
  filterRegionAll: '제주 전체',

  filterIndoorLabel: '실내 / 야외',
  /** `indoor === null` 인 장소가 어느 쪽에도 안 잡히는 것을 설명한다. 건수는 구할 수 없다 */
  filterIndoorUnknownNote:
    '실내 여부가 확인되지 않은 곳은 실내만·야외만에 나오지 않아요. 전체에서만 볼 수 있어요.',

  filterPetSizeLabel: '견종 크기 제한',
  /** `{name}` · `{size}` 를 치환한다 — 화자를 반려견으로 유지한다 (아트보드 02) */
  filterPetSizeLabelFor: '{name}({size})가 들어갈 수 있는 곳만',
  filterPetSizeHint: '선택한 반려견 기준으로 걸러요. 반려견을 바꾸면 결과도 바뀝니다.',

  /** 행 메타 줄 — `제주시 한림읍 · 야외` */
  rowIndoor: '실내',
  rowOutdoor: '야외',
  /** `indoor === null`. 점선 배지로 "모름" 을 드러낸다 (styling-guide.md §3 unknown) */
  rowIndoorUnknown: '실내 여부 미확인',

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
  /** 갤러리 바로 아래. 정보 출처와 분리한다 — 각각 자기 자료 옆에서 읽힌다 (가이드 §5) */
  photoSource: '사진 출처: 한국관광공사',
  detailCopyrightPrefix: '정보 출처: 한국관광공사',
  detailCopyrightType1: '공공누리 제1유형 (출처 표시)',
  detailCopyrightType3: '공공누리 제3유형 (출처 표시·변경 금지)',
  detailCopyrightUnknown: '출처 표시 대상',
} as const

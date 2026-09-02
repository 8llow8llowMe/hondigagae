/**
 * 장소 탐색 화면 문구.
 * 확정 근거: docs/features/place/공통명세.md S4, docs/features/place/장소상세-세부명세.md D5·D5-1
 */
export const placeMessages = {
  pageTitle: '장소 찾기',
  pageDescription: '반려견과 함께 갈 수 있는 제주 장소를 찾아보세요.',

  /** 결과 0건 또는 404 — 재시도가 아니라 다음 행동을 안내한다 */
  emptyTitle: '조건에 맞는 장소가 없어요',
  emptyDescription: '필터를 바꿔 다시 찾아보세요.',
  resetFilters: '필터 초기화',

  /** 5xx */
  errorTitle: '장소를 불러오지 못했어요',

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
  /**
   * 체중을 아는 아이면 그 기준까지 쓴다는 것을 밝힌다 — `{weight}` 치환.
   * **판정 근거를 감추지 않는다.** 왜 어떤 곳이 사라졌는지 말할 수 있어야 한다.
   */
  filterPetSizeWeightHint: '크기와 체중({weight}kg)을 함께 봐요. 정보가 없는 곳은 남겨 둬요.',

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
  detailNotFoundTitle: '장소를 찾을 수 없어요',
  detailNotFoundDescription: '주소가 잘못되었거나 삭제된 장소예요.',

  /** 5xx·무응답 */
  detailErrorTitle: '장소 정보를 불러오지 못했어요',

  detailSectionOverview: '장소 소개',
  detailSectionIntro: '이용 안내',
  detailSectionPet: '반려견 동반 정보',
  detailSectionImages: '사진',

  detailAddress: '주소',
  detailTel: '전화',
  detailHomepage: '홈페이지',
  /** 원본 분류(`카페`·`펜션`) — `contentType` 으로 갈리지 않는 구분이다 (#112) */
  detailSourceCategory: '분류',

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

  // ── 장소 상세 · 적합도 패널 (아트보드 `혼디가개 장소 상세` 01·03·04) ──────────

  detailSectionSuitability: '적합도',

  /**
   * 화자를 반려견으로 고정한다 — `{name}` 을 반려견 이름으로 치환한다.
   *
   * **등급 문구는 여기에 없다.** 아트보드의 "적합해요" 자리에는 서버 `suitabilityLevel.name`
   * 을 그대로 넣는다. FE 가 서버 문구를 다시 쓰지 않는다 (api-integration-guide.md §6).
   */
  detailSuitabilitySpeaker: '{name}에게',
  detailScoreUnit: '/100',

  /** `{date}` · `{name}` 치환. 예보 시각과 반려견이 바뀌면 값이 달라지기 때문에 붙인다 */
  detailSuitabilityBasis: '{date} 예보 기준 · {name} 기준',
  detailSuitabilityBasisNoPet: '{date} 예보 기준',

  /** 판정 조회만 실패한 경우. 화면 전체를 에러로 덮지 않는다 */
  detailSuitabilityErrorTitle: '적합도를 불러오지 못했어요',

  /**
   * 미로그인·반려견 미등록 (아트보드 04-③). **점수·근거·"몽실이에게" 를 쓰지 않는다** —
   * 기준이 되는 반려견이 없다. 지역 날씨만 보여주고 등록으로 안내한다.
   */
  detailGuestHeading: '오늘 이 지역',
  detailGuestCta: '반려견을 등록하면 크기·민감도까지 반영한 적합도를 볼 수 있어요.',
  detailGuestCtaSignup: '가입하고 등록하기 ›',
  detailGuestCtaPet: '반려견 등록 ›',
  /** 예보 범위 밖이라 날씨조차 없을 때 */
  detailGuestNoWeather: '오늘 이 지역의 예보를 가져오지 못했어요.',

  detailMaxTemperature: '최고기온',
  detailTemperatureUnit: '℃',
  detailPrecipitationProbability: '강수확률',
  detailPercentUnit: '%',

  /** 비 예보일 때만 채워진다. 빈 배열이면 섹션을 숨긴다 */
  detailIndoorAlternatives: '비 예보 · 가까운 실내 장소',

  // ── 장소 상세 · 반려견 동반 정보 ─────────────────────────────────────────

  /** 아트보드 04-① — `petInfo` 가 비어도 섹션을 숨기지 않는다 */
  detailPetInfoEmptyBadge: '정보 없음',
  detailPetInfoEmptyText: '동반 가능 여부가 등록되지 않았어요. 방문 전 전화로 확인해 주세요.',
  /** `{tel}` 치환 */
  detailPetInfoEmptyTel: '{tel} 전화',

  /**
   * 동반 조건은 관광 API 값이라 최신이 아닐 수 있다.
   * **이 한 줄이 없으면 우리가 보증한 것으로 읽힌다** (아트보드 주석).
   */
  detailPetInfoDisclaimer:
    '동반 조건은 현장 사정에 따라 달라질 수 있어요. 방문 전 전화로 확인하는 것을 권해요.',

  /**
   * 규정을 옮기는 것과 판단을 돕는 것의 차이 — 아트보드가 "몽실이는 소형견이라 해당하지
   * 않아요" 까지 쓴다. `{name}` · `{size}` 치환.
   */
  detailPetSizeAllowed: '{name}({size})는 들어갈 수 있어요.',
  detailPetSizeBlocked: '{name}({size})는 들어가기 어려울 수 있어요.',
  /** **`UNKNOWN` 은 "불가" 가 아니라 "모름" 이다** (backend `AllowedPetSize#allows`) */
  detailPetSizeUnknown: '동반 가능 크기가 등록되지 않아 {name} 기준으로 판단할 수 없어요.',

  // ── 장소 상세 · 본문 ────────────────────────────────────────────────────

  detailSectionBasic: '기본 정보',
  /** 모바일은 소개를 접는다 — 세로 공간이 없다 */
  detailOverviewMore: '더 보기',
  detailOverviewLess: '접기',

  /** 브레드크럼 — `장소 찾기 › {장소명}` */
  detailBreadcrumbLabel: '현재 위치',

  /**
   * 저작권 출처 표기. cpyrhtDivCd 는 TourAPI 원천에서만 채워지므로
   * 값이 있으면 제공처가 한국관광공사다 (세부명세 D5-2).
   */
  /** 갤러리 바로 아래. 정보 출처와 분리한다 — 각각 자기 자료 옆에서 읽힌다 (가이드 §5) */
  photoSource: '사진 출처: 한국관광공사',
  detailCopyrightPrefix: '정보 출처: 한국관광공사',
  /**
   * `cpyrhtDivCd` 가 없는 원천(문화정보원·식약처)의 출처 줄. `{source}` 는 서버가 준
   * `sourceName` 표시명이다 — **위 줄과 겹치지 않는다**: 공공누리 표기 의무가 있는 쪽은
   * 기관명(한국관광공사)을 써야 하고, 여기는 그 의무가 없는 원천이다 (#112).
   */
  detailSourcePrefix: '정보 출처: {source}',
  detailCopyrightType1: '공공누리 제1유형 (출처 표시)',
  detailCopyrightType3: '공공누리 제3유형 (출처 표시·변경 금지)',
  detailCopyrightUnknown: '출처 표시 대상',

  // ── 장소 상세 · 원천에서 사라진 장소 (#146) ─────────────────────────────

  /**
   * `delisted: true` 안내. **"없어졌어요" 라고 단정하지 않는다** — 원천 데이터에서
   * 내려간 것이지 폐업을 확인한 것이 아니다. 백엔드도 "더 이상 확인되지 않는" 이라고 적었다.
   */
  detailDelistedTitle: '더 이상 확인되지 않는 장소예요',
  /**
   * 화면이 왜 남아 있는지까지 말한다 — 백엔드가 이 장소의 상세를 계속 응답하는 이유가
   * 기존 일정이 참조하고 있어서다. 안내 없이 정보만 보이면 "멀쩡한 장소" 로 읽힌다.
   */
  detailDelistedDescription:
    '정보 출처에서 내려간 곳이라 지금 운영 중인지 알 수 없어요. 이미 담아 둔 일정에서는 그대로 볼 수 있어요.',
  /** 하단 바가 왜 잠겼는지. **두 동작을 한 줄로 함께 설명한다** — 각각 눌러 보게 두지 않는다 */
  detailDelistedActionsBlocked: '이 장소는 새로 담거나 저장할 수 없어요.',
} as const

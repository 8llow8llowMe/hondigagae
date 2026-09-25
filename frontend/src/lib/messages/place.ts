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

  // ── 이름·주소 검색 (#431 · 계약은 #421) ─────────────────────────────────
  /** `role="search"` 랜드마크의 이름이자 입력의 `sr-only` 라벨 */
  searchLabel: '장소 이름·주소로 찾기',
  searchPlaceholder: '이름이나 주소로 찾기',
  /**
   * 지도 위에 뜨는 검색창용 짧은 placeholder (#596).
   *
   * **375 에서 자리가 없다.** 보기 토글(90) 왼쪽에 남는 폭이 245 이고, 거기서 아이콘
   * 제출 버튼(44)과 간격을 빼면 입력이 193 이다 — 긴 문구는 잘린다. 잘린 placeholder 는
   * 짧은 문구보다 나쁘다. `messages.emergency.searchPlaceholderShort` 와 같은 값이고
   * 같은 이유다 — 두 화면이 같은 자리에 같은 컨트롤을 둔다.
   */
  searchPlaceholderShort: '이름·주소 검색',
  searchAction: '검색',
  /**
   * 검색어가 걸린 0건. **무엇으로 찾았는지 되돌려 준다** — 입력은 화면 위에 남아 있지만,
   * 결과가 비었을 때 사용자가 확인하는 것은 "내가 뭘로 찾았지" 다. `{keyword}` 치환.
   *
   * **검색어만의 문제로 단정하지 않는다** — 필터가 함께 걸려 있을 수 있어 설명이 둘 다 짚는다.
   */
  searchEmptyTitle: '‘{keyword}’ 로 찾은 장소가 없어요',
  searchEmptyDescription: '다른 말로 찾거나 필터를 바꿔 보세요.',
  /**
   * **`필터` 를 떼고 `초기화` 만 남긴다** (#393). 두 사용처가 전부 필터 묶음 안이라
   * 무엇을 초기화하는지는 자리가 이미 말한다 — 레일에서는 바로 옆이 `필터` 제목이고,
   * 지도 칩 줄에서는 다른 필터 칩들과 한 줄에 선다. 좁은 칩 줄에서 두 낱말은 폭만 먹는다.
   */
  resetFilters: '초기화',

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
  /** 지도 필터의 유형 줄을 좌우로 미는 화살표 (`ScrollRailArrows`) */
  filterTypePrev: '이전 유형 보기',
  filterTypeNext: '다음 유형 보기',
  filterPetAllowanceLabel: '반려견 동반',
  filterAllowedOnly: '반려견 동반 가능만',

  filterRegionLabel: '지역',
  filterRegionAll: '제주 전체',

  filterIndoorLabel: '실내 / 야외',
  /** `indoor === null` 인 장소가 어느 쪽에도 안 잡히는 것을 설명한다. 건수는 구할 수 없다 */
  filterIndoorUnknownNote:
    '실내 여부가 확인되지 않은 곳은 실내만·야외만에 나오지 않아요. 전체에서만 볼 수 있어요.',

  filterPetSizeLabel: '견종 크기 제한',
  /**
   * 화자를 반려견으로 유지한다 (아트보드 02).
   *
   * **`{nameWithSize}` 한 자리에 `이름(크기)+조사` 를 통째로 넣는다 —
   * `withParenthesizedParticle(name, size, withSubjectParticle)`.** 예전에는
   * `{name}({size})가` 로 조사를 박아 두었는데, `{size}` 는 서버 metadata 의 이름이라
   * **소형견·중형견·대형견 셋 다 받침으로 끝난다** — 즉 `가` 는 모든 경우에 비문이었다
   * ("갱얼쥐(소형견)**가**"). 조사 자리를 치환값 안으로 들여야 헬퍼가 닿는다.
   *
   * **받침 판정 기준은 괄호 안이다** — 근거는 `withParenthesizedParticle` 주석.
   */
  filterPetSizeLabelFor: '{nameWithSize} 들어갈 수 있는 곳만',
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
  /**
   * 영업 상태 — `운영시간` 원문 **위**에 선다 (#294 · 세부명세 D5).
   *
   * **`openNow === null` 문구는 만들지 않는다.** 그 갈래는 아무것도 그리지 않으므로
   * 문구가 필요 없다. 긴급 시설의 `statusUnknown`("영업 여부 확인 필요")에 해당하는
   * 것이 여기 없는 이유다 — 이유는 `types/place.ts` 의 `openNow` 주석에 있다.
   */
  detailOpen24: '24시간',
  detailOpenNow: '영업 중',
  detailOpenClosed: '영업 종료',
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
  /** 판정 카드(적합도 + 산책 위험도 + 담기)의 접근성 이름 — 두 패널이 제목 줄을 스스로 그려 `title` 슬롯이 없다 (#443) */
  detailVerdictCardLabel: '적합도와 산책 위험도',

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
  /**
   * **하루 최대** 체감온도 (#253 · [#259](https://github.com/8llow8llowMe/hondigagae/issues/259)).
   * **기온과 습도를 합친 기상청 여름철 체감온도다** (#292 — 예전에는 NOAA 열지수였다).
   * 반려견은 헐떡임으로 체온을 내려 습도에 사람보다 민감해서 이 값이 판정의 핵심 지표다.
   * 아트보드가 이 자리에 그린 큰 숫자도 최고기온이 아니라 이것이다.
   *
   * **`최고` 가 기준을 말한다.** 같은 레일의 산책 위험도가 같은 값을 **시각 기준**으로
   * 내는데(`detailFeelsLike`), 둘 다 `체감온도` 이면 어느 쪽이 하루치인지 알 수 없다.
   * **이름을 나누지 않고 기준을 나눈 이유**는 두 값이 같은 물리량이기 때문이다 — 이름이
   * 갈리면 사용자는 서로 다른 값으로 읽는다. 폴백인 `최고기온` 과도 짝이 맞는다.
   */
  detailFeelsLikeTemperature: '최고 체감온도',
  detailTemperatureUnit: '℃',
  /**
   * 큰 숫자를 받치는 최고·최저기온 줄 (#352).
   *
   * **큰 숫자가 `최고 체감온도` 이므로 이 줄의 `최고` 는 기온이라고 말해야 한다** — 같은
   * 자리에 `최고` 가 두 번 서는데 하나는 체감온도, 하나는 기온이다. 그래서 여기서만
   * 낱말을 줄이지 않고 `최고기온` · `최저기온` 을 그대로 쓴다 (권역 행은 옆에 체감온도가
   * 없어 `최고`/`최저` 로 줄인다 — `home.regionTempPrefix`).
   *
   * `detailMaxTemperature` 를 재사용하지 않는다 — 그쪽은 체감온도를 못 받은 날 **큰 숫자
   * 자리의 라벨**이고, 이 줄은 그때 최고기온을 빼므로 두 자리가 동시에 서지 않는다.
   * 같은 문구를 공유하면 한쪽을 고칠 때 다른 자리가 조용히 따라 바뀐다.
   */
  detailSupportingMaxTemperature: '최고기온',
  detailSupportingMinTemperature: '최저기온',
  detailPrecipitationProbability: '강수확률',
  detailPercentUnit: '%',

  /** 비 예보일 때만 채워진다. 빈 배열이면 섹션을 숨긴다 */
  detailIndoorAlternatives: '비 예보 · 가까운 실내 장소',

  // ── 장소 상세 · 산책 위험도 (#197) ───────────────────────────────────────

  /**
   * **적합도와 답하는 질문이 다르다.** 적합도는 "오늘 여기 갈 만한가"(일자), 이쪽은
   * "지금 나가도 되나"(시각)다. 라벨이 그 차이를 먼저 말해야 두 판정이 나란히 서도
   * 사용자가 기준을 섞지 않는다.
   *
   * 홈의 `walkTodayLabel`('오늘 산책')과 다른 문구인 이유가 같다 — 홈은 대표 장소 하나의
   * 오늘을 말하고, 여기는 **보고 있는 이 장소의 지금**이다.
   */
  detailWalkSafetyLabel: '지금 산책',

  /** 등급 문구는 없다 — 서버 `walkSafetyLevel.name` 을 그대로 넣는다 */
  detailWalkSafetyErrorTitle: '산책 위험도를 불러오지 못했어요',

  /**
   * 산책 위험도 hero 의 라벨 ([#259](https://github.com/8llow8llowMe/hondigagae/issues/259)).
   * **`feelsLikeCelsius` 는 `targetDateTime` 그 시각의 값이다** — 하루 최대인
   * `detailFeelsLikeTemperature`(`최고 체감온도`)와 같은 물리량이고 기준만 다르다.
   *
   * **예전에는 hero 에 라벨이 없었다.** 적합도의 점수 hero(`82 /100`)를 따라 뺐던 것인데,
   * 점수는 단위가 스스로 말하고 온도는 그렇지 않다 — 맨 `35.0℃` 는 기온으로 읽힌다.
   * '지금' 은 위의 `지금 산책` 제목과 아래 `{time} 기준` 각주가 이미 말한다.
   *
   * **근거 필드가 `heatIndexCelsius` → `feelsLikeCelsius` 로 바뀌었다** (#292). 문구는
   * 그대로다 — 자세한 사정은 `home.feelsLikeLabel` 에 적어 두었다.
   */
  detailFeelsLike: '체감온도',

  /**
   * 체감온도 계산 근거 문단의 **정적 라벨** (#840). 예전에는 펼침 버튼의 라벨이었다 —
   * 접기를 걷으면서 버튼은 사라졌지만, 130자 문장이 무엇의 근거인지 말하는 일은 남았다.
   *
   * **참고 열지수가 이 문단 안에 함께 산다** (#292). 서버는 `heatIndexCelsius` 를 계속
   * 내려주지만 판정에 쓰지 않으므로 평면에 세 번째 온도로 세우지 않는다 — 그러면 판정값과
   * 참고값이 같은 위계가 된다. 값과 "판정에는 쓰지 않는다" 는 문장(`heatIndexBasis`)을
   * **한자리에 두어** 숫자만 떼어 읽히는 일을 막는다.
   */
  detailFeelsLikeBasisLabel: '체감온도 계산 근거',

  /**
   * 계산 근거 문단 안의 참고 열지수 라벨 (#292).
   *
   * **`참고` 를 라벨에 넣는다.** `열지수` 만으로는 판정 기준이 하나 더 있는 것으로 읽히고,
   * 실제로 예전에는 이 값이 판정 기준이었다 — 그 흔적을 화면이 지워야 한다.
   */
  detailHeatIndexReference: '참고 열지수',
  /**
   * **추정치다.** 실측 노면 온도가 아니라는 것을 라벨이 말한다.
   *
   * **`(아스팔트)` 를 넣는다** ([#269](https://github.com/8llow8llowMe/hondigagae/issues/269)).
   * "노면" 만으로는 흙길·잔디도 떠올리게 되는데 추정식은 아스팔트 기준이다. 홈 곡선과
   * 같은 값이므로 두 화면이 같은 낱말로 부른다 (`home.pavementLabel`).
   */
  detailPavement: '추정 노면(아스팔트) 온도',

  /**
   * `{time}` 치환. **적합도의 `detailSuitabilityBasis` 와 문구가 다르다** — 저쪽은
   * `{date} 예보 기준`, 이쪽은 시각이다. 같은 화면에 두 줄이 나란히 서므로 둘이 같은
   * 문구면 기준이 다른 것이 지워진다.
   */
  detailWalkSafetyBasis: '{time} 기준',
  detailWalkSafetyBasisWithPet: '{time} 기준 · {name} 기준',

  /** `{start}` · `{end}` 치환. **없으면 줄 자체를 렌더하지 않는다** — 지어내지 않는다 */
  detailSaferWindow: '더 안전한 시간대는 {start} – {end}',

  // ── 장소 상세 · 반려견 동반 정보 ─────────────────────────────────────────

  /** 아트보드 04-① — `petInfo` 가 비어도 섹션을 숨기지 않는다 */
  detailPetInfoEmptyBadge: '정보 없음',
  detailPetInfoEmptyText: '동반 가능 여부가 등록되지 않았어요. 방문 전 전화로 확인해 주세요.',
  /**
   * 동반 여부는 **등록돼 있고** 세부 조건만 없을 때. 이 갈래를 위 문구로 덮으면
   * 제목 옆 배지(`동반 불가` 등)와 다른 말을 하게 된다 — 실데이터에서 흔한 조합이다
   * (dev 실측: `petAllowanceType=NOT_ALLOWED` + `petInfo=null`).
   */
  detailPetInfoDetailsMissingText:
    '세부 동반 조건은 등록되지 않았어요. 방문 전 전화로 확인해 주세요.',
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
   * 않아요" 까지 쓴다.
   *
   * **`{nameWithSize}` 한 자리에 `이름(크기)+조사` 를 통째로 넣는다 —
   * `withParenthesizedParticle(name, size, withTopicParticle)`.** `filterPetSizeLabelFor` 와
   * 같은 이유다: `{size}` 가 늘 받침으로 끝나 박아 둔 `는` 이 모든 경우에 비문이었다
   * ("갱얼쥐(소형견)**는**"). **주격(이/가)이 아니라 주제격(은/는)이다** — 판정 대상을
   * 화제로 올리는 문장이다 (`withTopicParticle` 주석).
   */
  detailPetSizeAllowed: '{nameWithSize} 들어갈 수 있어요.',
  detailPetSizeBlocked: '{nameWithSize} 들어가기 어려울 수 있어요.',
  /** **`UNKNOWN` 은 "불가" 가 아니라 "모름" 이다** (backend `AllowedPetSize#allows`) */
  detailPetSizeUnknown: '동반 가능 크기가 등록되지 않아 {name} 기준으로 판단할 수 없어요.',

  // ── 장소 상세 · 본문 ────────────────────────────────────────────────────

  /** 기본 정보 + 이용 안내 + 지도를 한 카드로 묶은 절 (#935) */
  detailSectionVisit: '방문 정보',
  /** 소개가 길면 접는다 — 모바일 네 줄, 데스크톱 세 줄 */
  detailOverviewMore: '더 보기',
  detailOverviewLess: '접기',

  /** 브레드크럼 — `장소 찾기 › {장소명}` */
  detailBreadcrumbLabel: '현재 위치',

  /**
   * 저작권 출처 표기. cpyrhtDivCd 는 TourAPI 원천에서만 채워지므로
   * 값이 있으면 제공처가 한국관광공사다 (세부명세 D5-2).
   */
  /**
   * 갤러리 바로 아래. 정보 출처와 분리한다 — 각각 자기 자료 옆에서 읽힌다 (가이드 §5)
   *
   * **일러스트만 있을 때는 붙이지 않는다.** 그 그림은 한국관광공사가 준 사진이 아니라
   * 우리가 그린 카테고리 도형이라, 여기에 출처를 달면 없는 사진의 출처를 표기하게 된다.
   */
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

  // ── 장소 상세 · 판정 요약 3줄 (#650 · 진단 D-1) ─────────────────────────

  /*
    **제목 아래 세 줄은 화면의 답이지 섹션 이름이 아니다.** 390 실측에서 동반(1797)·
    산책(1519)이 1.8~2.1 화면 아래라, 이름을 읽은 사람이 스크롤 없이 답을 보게 한다.
    정본: `docs/features/place/장소상세-판정요약-세부명세.md` D4.
  */
  detailSummaryLabel: '이 장소 한눈에 보기',
  detailSummaryPetLabel: '동반',
  /**
   * `petAllowanceType.code === 'UNKNOWN'`.
   *
   * **'불가' 로 단정하지 않는다** (#530). 태그 줄은 이 배지를 감추지만(옆 태그에 걸려
   * 읽힌다) 여기서는 그것이 답 자체라 말한다 — 원천에 없는 것이지 안 된다는 것이 아니다.
   */
  detailSummaryPetUnknown: '정보 없음 · 방문 전 확인해요',
  detailSummaryWalkLabel: '지금 산책',
  /** `{feelsLike}` 가 `null` 이면 등급만 쓴다 — `0.0℃` 는 영하로 읽힌다 */
  detailSummaryWalkValue: '{grade} · 체감 {feelsLike}℃',
  detailSummaryCongestionLabel: '덜 붐비는 날',
  /**
   * **등급을 빼지 않는다.** 기간이 전부 붐비는 주라면 가장 덜 붐비는 날도 `혼잡` 이고,
   * 그때 날짜만 내면 이 줄이 추천처럼 읽힌다 — 혼잡도 패널이 같은 이유로 초록 면을
   * 거절하고 등급 배지를 반드시 붙인다 (`place-congestion-panel.tsx` `LeastCrowded`).
   */
  detailSummaryCongestionValue: '{day} · {grade}',

  // ── 장소 상세 · 기간 혼잡도 (#430) ──────────────────────────────────────

  /**
   * 카드 제목. **"기간 혼잡도" 라는 계약 용어를 쓰지 않는다** — 사용자가 이 카드에서 하는
   * 일은 등급을 확인하는 것이 아니라 **갈 날을 고르는 것**이다.
   */
  detailCongestionTitle: '언제 가면 덜 붐빌까',
  /**
   * 서버가 고른 날(`leastCrowded`). **`null` 이면 이 줄을 그리지 않는다** — 아는 날이
   * 하나도 없다는 뜻이라, 빈 자리는 "한산한 날이 없다" 로 읽힌다.
   */
  detailCongestionLeastLabel: '가장 덜 붐비는 날',
  detailCongestionLeastDay: '{month}월 {day}일 ({weekday})',
  /** 집중률은 단위가 없는 지표(0~100)다. **숫자는 이 줄에만 적는다.** `%` 를 붙이지 않는다 */
  detailCongestionRateLabel: '집중률',
  /**
   * 같은 기간 평균과의 차이 (#651 · 진단 D-3).
   *
   * **`57.77` 만으로는 높은지 낮은지 알 수 없었다** — 화면 어디에도 비교 기준이 없었다.
   * 비교할 것이 없으면(아는 날 1일, 전부 같은 값) 이 줄을 붙이지 않는다.
   *
   * **`30일 중 가장 한산` 이라 쓰지 않는다.** 기간은 7일일 수도 있고, 전부 붐비는 주라면
   * 가장 덜 붐비는 날도 `혼잡` 이다 — 등급은 옆 배지가 말한다.
   */
  detailCongestionRateCompare: '· 이 기간 평균 {average}보다 {below} 낮아요',
  /** 막대 하나를 보조기기에 읽어 주는 줄. 색·높이는 스크린리더에 아무 말도 하지 못한다 */
  detailCongestionBar: '{month}월 {day}일 {weekday}요일',
  /**
   * 점선 트랙의 뜻. **이 줄이 없으면 빈 칸이 "한산한 날" 로 읽힌다** — 서버가 데이터 없는
   * 날짜를 목록에서 빼지 않는 이유와 같다.
   */
  detailCongestionUnknownNote: '점선은 아직 모르는 날이에요. 한산하다는 뜻이 아니에요.',
  /**
   * 30일 보기의 각주. **기본 상태에서 보인다** (#603) — 30일이 기본이 되면서, 이 카드가
   * 적합도보다 멀리 본다는 것이 첫 화면에서 바로 읽힌다.
   */
  detailCongestionExtendedNote: '혼잡도 예측은 30일까지 있어요. 날씨 판정은 11일까지예요.',
  /**
   * 기간 토글. **이름은 전환 방향이고 기본값이 아니다** — 기본이 30일이라 첫 화면에 서는
   * 것은 `Collapse`(`7일만 보기`) 쪽이다.
   */
  detailCongestionExpand: '30일까지 보기',
  detailCongestionCollapse: '7일만 보기',
  /**
   * 30일 레일의 좌우 화살표 (#603). **"이전 / 다음" 만으로는 무엇의 이전인지 알 수 없다** —
   * 홈 곡선의 라벨과 같은 규칙으로 대상을 밝힌다.
   */
  detailCongestionPrevDays: '이전 날짜 보기',
  detailCongestionNextDays: '다음 날짜 보기',
  /**
   * 전부 `UNKNOWN` — `leastCrowded` 가 `null` 인 갈래다. **404 가 아니라 빈 상태다**:
   * 장소는 있고 연결된 관광지 통계가 없는 것이라 재시도 버튼을 달지 않는다.
   */
  detailCongestionEmptyTitle: '이 장소는 혼잡도 자료가 아직 없어요',
  detailCongestionEmptyDescription: '한산하다는 뜻은 아니에요. 자료가 쌓이면 보여 드려요.',
  /**
   * 빈 상태의 다음 행동 (#731). **재시도가 아니라 다른 장소로 가는 길이다** — 이 장소의
   * 자료는 사용자가 어떻게 해도 생기지 않는다.
   *
   * **"같은 지역" 이라 쓰지 않는다.** 장소 상세 응답에 `sigunguCode` 가 없어 같은 시군구로
   * 좁힐 근거가 화면에 없다(`types/place.ts` 의 `PlaceDetail` 주석). 문구가 약속하는 것과
   * 링크가 실제로 여는 화면이 갈리면 안 된다.
   */
  detailCongestionEmptyAction: '다른 장소 둘러보기',
  /** 조회 실패. 이 카드만 덮는다 — 판정·기본 정보는 그대로 쓸모가 있다 */
  detailCongestionErrorTitle: '혼잡도를 불러오지 못했어요',

  // ── 장소 상세 · 사진 뷰어 ───────────────────────────────────────────────

  /**
   * 사진 뷰어 (확대해 보기).
   *
   * 데스크톱 모자이크는 **대표 1 + 썸네일 2 만 그리고 나머지는 `+N` 뒤에 있다.** `+N` 이
   * 장수만 말하고 열리지 않으면 그 사진들은 화면에 도달할 길이 아예 없다 — 그래서 타일과
   * `+N` 이 전부 뷰어를 여는 버튼이다.
   *
   * 아이콘 버튼이라 이름이 `aria-label` 에만 있다. `{index}` 는 1부터 센 사람 기준 번호다.
   */
  galleryViewerTitle: '사진 크게 보기',
  galleryOpenAction: '{index}번째 사진 크게 보기',
  /** `+N` 오버레이의 이름. "사진이 N장 더 있다" 가 아니라 **그것을 여는 동작**을 말한다 */
  galleryOpenMoreAction: '나머지 사진 {count}장 보기',
  galleryPrevAction: '이전 사진',
  galleryNextAction: '다음 사진',
  /** 뷰어 안 위치 표시. 모바일 캐러셀 카운터와 같은 형식이다 */
  galleryPosition: '{index}/{total}',

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

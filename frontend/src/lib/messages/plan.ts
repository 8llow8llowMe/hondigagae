/**
 * 여행 일정 목록 · 직접 만들기 화면 문구.
 *
 * 정본은 아트보드 `혼디가개 여행 일정.dc.html` 04 · 05 · 06 절이다.
 * 어미는 해요체로 통일한다 (DESIGN.md §1). 예외는 `// PLAN_NNN` 주석이 달린 줄 —
 * 백엔드 `PlanValidationMessage` 복제본이라 톤을 바꾸면 같은 폼에서 클라이언트 검증과
 * 서버 검증의 말투가 갈린다.
 */
export const planMessages = {
  // ── 반려견 여행 준비물 (#155) ──────────────────────────────────────────────
  /**
   * 일자 판정의 기준 반려견 (#176). **두 마리 이상일 때만 나온다.**
   *
   * 왜 대표가 아닌지를 함께 말한다 — 서버가 그날 점수가 가장 낮은 아이를 기준으로 삼아
   * (`pickBasisPet`) 기준 아이가 날마다 다를 수 있다. 이유 없이 이름만 붙이면 사용자는
   * "왜 이 아이지" 를 알 수 없다.
   */
  verdictBasisPet: '{name} 기준이에요. 함께 가는 아이 중 이 날이 가장 힘든 아이예요.',

  /**
   * 목록 행의 동행 요약 (#218). `{name}` 은 대표(`petIds[0]`), `{count}` 는 나머지 수다.
   *
   * **이름을 나열하지 않는다.** 최대 5마리까지 등록되므로 나열하면 행의 폭이 터진다.
   * 목록은 신원 요약이고 전체 명단은 상세의 반려견 카드가 세운다.
   */
  companionMore: '{name} 외 {count}마리',

  // ── 일정 응급 브리핑 (#125) ────────────────────────────────────────────────
  emergencyHeading: '가는 곳 주변 병원·약국',
  emergencyPageTitle: '일정 주변 병원·약국',
  /** 배너 설명 — 이 기능의 취지를 그대로 적는다 */
  emergencyBannerDescription: '급할 때 찾으면 늦어요. 출발 전에 훑어보세요',
  emergencyBack: '일정으로 돌아가기',
  /** `{km}` 을 반경(km)으로 치환한다. **화면이 조절할 수 없는 값이라 사실로만 적는다** */
  emergencyRadiusNote: '방문 장소에서 {km}km 안, 가까운 순 3곳이에요',
  /** `{day}` 를 일차로 치환한다 */
  emergencyDayLabel: '{day}일차',
  /**
   * 운영시간 정보가 없는 시설. **"휴무" 가 아니라 "확인 필요" 다** — 백엔드 스키마가
   * 명시한 규칙이고, 닫혔다고 쓰면 실제로 여는 병원을 사용자가 건너뛴다.
   */
  emergencyHoursUnknown: '진료시간이 등록돼 있지 않아요 — 전화로 확인해 주세요',
  emergencyOpen24: '24시간',
  /** `{name}` 을 시설명으로 치환한다 */
  emergencyCallLabel: '{name} 전화하기',
  emergencyCallShort: '전화',
  /**
   * 길찾기를 못 다는 이유를 화면이 말하지 않는다 — 대신 주소를 준다. 계약에 좌표가 없어
   * 링크를 만들 수 없고(`directionsUrl` 이 null), 눌러도 못 가는 버튼은 달지 않는다.
   */
  emergencyEmptyTitle: '주변 시설을 찾지 못했어요',
  emergencyEmptyDescription: '이 일정에 장소가 담기면 그 주변을 다시 찾아봐요.',
  emergencySpotEmpty: '반경 안에 등록된 시설이 없어요',
  emergencyErrorTitle: '주변 시설을 불러오지 못했어요',

  packingHeading: '여행 준비물',
  /**
   * 준비물 절의 AI 표시 (#397). 헤더 nav 의 `AI 일정 생성` 배지와 **같은 낱말**이어야
   * 한다 — 같은 성질의 것(AI 산출물)을 화면마다 다르게 부르면 사용자는 다른 기능으로 읽는다.
   */
  packingAiBadge: 'AI',
  /**
   * **CTA 가 무엇이 만들어지는지 말한다** (#397). `준비물 목록 만들기` 였을 때는 이 절이
   * 접었다 펴는 토글처럼 읽혔다 — 이 서비스의 AI 기능 하나가 부가 기능으로 보였다.
   */
  packingCta: 'AI로 준비물 챙기기',
  packingRetryCta: '다시 만들기',
  /**
   * **대기 문구가 시간을 먼저 말한다.** 동기 API 라 수십 초가 걸릴 수 있고(컨트롤러 설명),
   * 아무 안내 없이 기다리게 하면 사용자는 고장으로 읽는다.
   *
   * **저장이 생긴 뒤에도 문구를 줄이지 않는다** (#586). 기다리는 것은 **첫 1회뿐**이지만,
   * 그 1회 동안 사용자가 겪는 일은 전과 똑같다.
   */
  packingPending: 'AI가 이 일정을 읽고 있어요',
  packingPendingNote: '수십 초 걸릴 수 있어요. 화면을 닫지 마세요.',
  /*
    `packingNotSaved`('저장되지 않는 제안이에요. 화면을 벗어나면 사라져요.')를 여기 뒀었다.
    **#586 이 저장을 붙이면서 거짓말이 됐다** — plan-service 가 결과를 보관한다.

    반대말(`packingSavedNote`)로 갈아탔다. "사라진다" 를 지우기만 하면 사용자는 저장 여부를
    화면 어디서도 알 수 없는데, 이 절은 **다시 눌러도 되는지**(LLM 이 또 도는지)가 곧
    비용이라 저장된다는 사실이 그대로 행동을 바꾼다.
  */
  /** 결과가 이 일정에 남는다 (#586). 다시 열 때 LLM 을 또 돌리지 않는 근거이기도 하다 */
  packingSavedNote: '이 일정에 저장돼요. 다시 열어도 그대로예요.',
  /** `{checked}` · `{total}` 치환. **0/N 도 보여 준다** — 아직 아무것도 안 챙겼다는 사실이다 */
  packingCheckedSummary: '{checked} / {total} 챙김',
  /**
   * 재생성이 무엇을 건드리지 **않는지** 말한다 (#586). 서버 규칙이 그렇다 — AI 항목만
   * 교체하고, 사용자 항목은 남고, 같은 이름의 챙김 체크는 승계된다. 이것을 말하지 않으면
   * 반쯤 싸 둔 사람이 `다시 만들기` 를 누르지 못한다.
   */
  packingRegenerateNote: '다시 만들어도 직접 추가한 것과 챙김 표시는 그대로예요.',
  /** 직접 추가 항목의 출처 배지. `source.name` 대신 쓰지 않는다 — 이것은 자리 이름이다 */
  packingUserBadge: '직접 추가',
  /** 직접 추가한 항목에는 이유가 없다. **"AI 가 이유를 못 냈다" 와 다르다** */
  packingUserNoReason: '직접 적어 둔 항목이에요.',
  packingAddAction: '직접 추가',
  packingAddTitle: '빠진 준비물 추가',
  /** 서버가 `reason` 을 받지 않는 이유를 그대로 옮긴다 — 화면이 이유 칸을 왜 안 주는지의 답이다 */
  packingAddHint: '이유는 AI만 붙일 수 있어요. 이름과 분류만 적어요.',
  packingAddCategoryLabel: '분류',
  packingAddCategoryPlaceholder: '예: 반려견 케어',
  /** `{categories}` 치환. 이미 쓰이는 분류를 알려 준다 — 같은 이름이면 같은 묶음에 붙는다 */
  packingAddCategoryHint: '이미 쓰는 분류: {categories}',
  packingAddNameLabel: '준비물 이름',
  packingAddNamePlaceholder: '예: 배변봉투',
  packingAddSubmit: '추가',
  packingAddCancel: '취소',
  /** `{name}` 치환. icon-only 버튼의 접근 가능한 이름 */
  packingRemoveLabel: '{name} 삭제',

  errorPackingCategoryRequired: '분류를 적어 주세요.',
  errorPackingNameRequired: '준비물 이름을 적어 주세요.',
  // PLAN_012
  errorPackingNameDuplicated: '이미 같은 이름의 준비물이 있습니다.',
  // PLAN_013
  errorPackingLimitExceeded: '준비물은 일정당 최대 50개까지 저장할 수 있습니다.',
  packingAddError: '준비물을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.',
  packingRemoveError: '준비물을 지우지 못했어요. 잠시 후 다시 시도해 주세요.',
  /** 체크는 낙관적으로 먼저 그린다 — 실패하면 되돌리고 **되돌렸다는 사실**을 말한다 */
  packingCheckError: '챙김 표시를 저장하지 못했어요. 표시를 되돌렸어요.',
  packingLoadErrorTitle: '준비물을 불러오지 못했어요',
  /*
    `packingClearedTitle`('준비물을 모두 지웠어요')를 잠깐 뒀었다. **서버가 그 상태를
    구분해 주지 않는다** — `generatedAt` 은 AI 항목이 하나도 없으면 null 이라, 만든 뒤
    전부 지우면 "아직 안 만들었다" 와 같은 응답이 된다. 구분하는 척하는 문구를 두지 않는다.
  */
  /*
    `packingSinglePetNote`('대표 반려견 기준이에요')를 여기 뒀었다. #179 로 `AiPackingProcessor`
    가 동행 반려견 전체를 벌크 조회하게 되면서 거짓이 됐다.

    **"모든 아이 기준이에요" 로 바꾸지 않았다.** 특성 조회가 일부만 성공하면 백엔드는 그
    아이를 빼고 WARN 만 남기는데, `PackingListResponse` 에는 그 사실을 알려 주는 필드가
    없다 — 화면은 몇 마리가 근거에 들어갔는지 모른다. 이 저장소는 근거를 모를 때 아는
    척하지 않는 쪽으로 결정해 왔다(`weatherApplied`·`score: null`·`basisPetId`). 대신
    어느 아이 때문에 필요한 물건인지는 서버가 이유 문장에 `[반려견 2]` 꼴로 밝힌다.
  */
  /**
   * **무엇을 읽고 만드는지 세어서 말한다** (#397). 예전 문구(`일정과 여행 기간 예보,
   * 반려견 특성을 근거로 만들어요.`)도 같은 사실을 담고 있었지만 **주어가 없어** 누가
   * 만드는지 읽히지 않았다. 이 절이 AI 기능이라는 것이 CTA 를 누르기 전에 서야 한다.
   *
   * **일반 체크리스트와 무엇이 다른지가 이 문장의 일이다.** 어디서든 구할 수 있는
   * 목록이면 이 기능은 필요 없다.
   */
  packingIntro: '이 일정의 날짜와 장소, 여행 기간 예보, 반려견 특성을 AI가 읽고 챙길 것을 골라요.',
  /** 결과 머리에 서서 **무엇에 근거한 목록인지** 다시 못박는다 (#397) */
  packingResultBasis: 'AI가 이 일정을 읽고 골랐어요',
  /** 실패 코드가 AIPLAN_016 하나다 — 없는 일정과 남의 일정을 구분해 말하지 않는다 */
  packingErrorTitle: '준비물을 만들지 못했어요',

  pageTitle: '여행 일정',
  pageDescription: '반려견과 함께한 여행과 앞으로의 여행을 한곳에서 봐요.',

  // ── 좁히기 ─────────────────────────────────────────────────────────────

  filterTitle: '필터',
  filterReset: '필터 초기화',
  statusGroupLabel: '상태',
  statusAll: '전체',
  petGroupLabel: '반려견',

  /**
   * 개수를 말할 수 있을 때만 붙는 줄. `{total}` 치환.
   * `hasNext` 인 동안에는 아예 렌더하지 않는다 (공통명세 S3).
   */
  countSummary: '일정 {total}개',
  /** `{total}` · `{upcoming}` 치환 */
  countSummaryWithUpcoming: '일정 {total}개 · 다가오는 일정 {upcoming}개',

  // ── 목록 ───────────────────────────────────────────────────────────────

  /**
   * **맨 위 묶음이다** (#561). 오늘이 여행 기간 안인 일정 — `다가오는 일정` 과 갈라 둔다.
   * 진행 중인 여행을 "다가오는" 이라고 부르면 제목이 사실과 어긋나고, 그 자리에 D-day 를
   * 적을 수도 없어 배지 자리가 빈 채로 남는다.
   */
  sectionOngoing: '여행 중',
  sectionUpcoming: '다가오는 일정',
  sectionPast: '지난 일정',
  loadMore: '더 보기',

  /** `{days}` 치환. 0 이면 `ddayToday` 를 쓴다 */
  dday: 'D-{days}',
  ddayToday: 'D-DAY',
  /**
   * D-day 자리에 대신 서는 말. **출발 당일은 여기가 아니라 `ddayToday` 다** —
   * 그날은 `D-DAY` 가 더 강하다 (`lib/plan/date.ts` `planPhaseOf`).
   */
  ongoing: '여행 중',
  /** 날짜 줄에 덧붙는 진행도. `{day}` 치환 — 2일차부터 나온다 */
  ongoingDay: '오늘 {day}일차',

  // ── 만들기 ─────────────────────────────────────────────────────────────

  createAction: '새 일정 만들기',
  /** 모바일 헤더의 아이콘 버튼 — 라벨이 보이지 않아 `aria-label` 로 준다 */
  createActionLabel: '새 일정 만들기',
  createTitle: '일정 만들기',
  createDescription: '빈 일정을 만들고 장소는 나중에 담아요.',
  createSubmit: '만들기',

  /**
   * 만들기 방식 시트 — 아트보드 04. **AI 화면(#84)이 생겨 항목이 둘이 됐다.**
   * 그 전에는 선택지가 하나뿐이라 시트를 두지 않았다 (공통명세 S2).
   */
  createSheetTitle: '어떻게 만들까요?',
  createSheetAi: 'AI로 만들기',
  /** 소요는 `aiPlan.createSubmitHint` 와 같은 말을 해야 한다 — 두 화면이 연달아 나온다 (#495) */
  createSheetAiDescription: '조건만 알려 주면 일자별 일정을 짜 드려요. 1~2분쯤 걸려요.',
  createSheetManual: '직접 만들기',
  createSheetManualDescription: '빈 일정을 만들고 장소를 직접 담아요.',
  createCancel: '취소',

  fieldPet: '누구와 가나요',
  fieldTitle: '일정 이름',
  fieldTitlePlaceholder: '예: 몽실이와 제주 2박 3일',
  /** 달력을 눌러 고르는 자리라 서식이 아니라 **행동**을 적는다 */
  datePlaceholder: '날짜 선택',
  fieldStartDate: '시작일',
  fieldEndDate: '종료일',
  fieldBudget: '예산 (선택)',
  fieldBudgetHint: '원 단위로 적어요. 나중에 바꿀 수 있어요.',

  // 아래 다섯은 백엔드 PlanValidationMessage / PlanErrorCode 복제본이다.
  // 대응 코드 주석은 **바로 윗줄**에 둔다 — message-tone.test.ts 가 그 위치를 본다
  // PLAN_103
  errorTitleRequired: '일정 제목은 필수입니다.',
  // PLAN_104
  errorTitleTooLong: '일정 제목은 60자 이하만 가능합니다.',
  // PLAN_107
  errorBudgetNegative: '예산은 0 이상이어야 합니다.',
  // PLAN_003
  errorDateRange: '여행 시작일은 종료일보다 늦을 수 없습니다.',
  // PLAN_009
  errorPeriodTooLong: '여행 기간은 최대 30일까지 만들 수 있습니다.',

  errorPetRequired: '반려견을 골라 주세요.',
  errorStartDateRequired: '시작일을 골라 주세요.',
  errorEndDateRequired: '종료일을 골라 주세요.',
  /**
   * **백엔드 복제본이 아니다** — 서버에 `@Max` 가 없고, 상한을 넘긴 값은 검증이 아니라
   * 역직렬화에서 깨져 필드를 짚지 못한 채 "본문을 읽을 수 없습니다" 로 돌아온다 (#566).
   * 그래서 해요체다.
   *
   * 상한값(21억)을 문구에 적지 않는다. 이 오류가 실제로 나는 상황은 자릿수를 잘못 넣거나
   * 붙여넣은 경우라, 고칠 방법을 말해 주는 편이 숫자를 외게 하는 것보다 낫다.
   */
  errorBudgetTooLarge: '예산이 너무 커요. 자릿수를 확인해 주세요.',

  // ── 반려견이 없을 때 ───────────────────────────────────────────────────

  noPetTitle: '먼저 반려견을 등록해 주세요',
  noPetDescription: '일정은 반려견 한 마리를 기준으로 만들어요.',
  noPetAction: '반려견 등록하기',

  // ── 상태 화면 ──────────────────────────────────────────────────────────

  emptyTitle: '아직 일정이 없어요',
  /** 반려견이 있을 때. `{pet}` 치환 */
  emptyDescriptionWithPet: '{pet}에게 맞는 일정을 만들어 보세요.',
  emptyDescription: '첫 일정을 만들어 보세요.',

  filteredEmptyTitle: '조건에 맞는 일정이 없어요',
  /**
   * 필터를 지웠을 때 몇 개가 있는지 말한다 (아트보드 05).
   * `{total}` 치환. **전량을 받았을 때만 쓴다** — `hasNext` 면 아래 문구로 갈아탄다.
   */
  filteredEmptyDescription: '필터를 지우면 일정 {total}개를 볼 수 있어요.',
  filteredEmptyDescriptionUnknown: '필터를 지우면 다른 일정을 볼 수 있어요.',

  errorTitle: '일정을 불러오지 못했어요',
  errorDescription: '잠시 후 다시 시도해 주세요.',

  // ── 상세 (#80) ─────────────────────────────────────────────────────────
  // 정본은 아트보드 01(모바일 · DRAFT) · 02(데스크톱 · CONFIRMED) · 06 ③.

  detailNotFoundTitle: '찾을 수 없는 일정이에요',
  detailNotFoundDescription: '삭제됐거나 주소가 잘못됐어요.',
  detailErrorTitle: '일정을 불러오지 못했어요',
  /**
   * 숫자가 아닌 `planId` → 400 `PLAN_114`. **재시도를 주지 않는다** — 같은 주소를
   * 다시 불러도 같은 400 이다 (일정상세-세부명세 D5).
   */
  detailBadRequestTitle: '잘못된 주소예요',
  detailBadRequestDescription: '일정 주소를 다시 확인해 주세요.',
  backToList: '일정 목록으로',

  /** `{days}` 치환 */
  totalDays: '총 {days}일',
  budgetLabel: '예산',
  /** `{amount}` 치환. 원 단위 */
  budgetAmount: '{amount}원',
  budgetEmpty: '예산 미정',

  /** `{day}` 치환 */
  dayLabel: '{day}일차',
  dayEmpty: '이 날은 아직 담은 곳이 없어요.',

  verdictTocTitle: '일자별 판정',
  /** 목차에서 판정을 못 낸 날. 낮은 등급으로 칠하지 않고 점선 unknown 으로 둔다 */
  verdictTocUnavailable: '판정 없음',
  verdictErrorTitle: '이 날 판정을 불러오지 못했어요.',
  /**
   * 지난 날짜라 판정이 없는 날 (#497 · 서버 사유 `PAST_DATE`).
   *
   * **서버 문장을 쓰지 않고 화면이 직접 말한다.** 코드가 사실을 다 말해 주는데 서버 문장은
   * 합쇼체라 한 화면 안에서 말투가 갈린다 (`DESIGN.md` 문구 톤). **재시도를 권하지 않는
   * 문장이어야 한다** — 예보는 소급되지 않아 다시 물어도 생기지 않는다.
   */
  verdictPastDate: '지난 날이라 날씨 판정을 확인할 수 없어요.',
  /** 반려견 특성 조회에 실패해 일반 조건으로 판정한 경우 */
  verdictPetConditionMissing: '반려견 특성을 반영하지 못해 일반 조건으로 판정했어요.',
  /** `{source}` 치환 — 서버가 준 `forecastSourceName` */
  verdictMidTermSource: '{source} 기준이라 대략적인 값이에요.',
  /**
   * 체감온도를 못 받은 날(중기예보 구간)에 대신 세우는 값의 라벨 (#253).
   * **체감온도를 이 이름으로 부르지 않는다** — 판정의 근거를 잘못 알려 주는 것이다.
   */
  verdictTemperatureLabel: '최고기온',
  /**
   * 판정 옆 큰 숫자의 기본 라벨 (#253 · [#259](https://github.com/8llow8llowMe/hondigagae/issues/259)).
   * **기온과 습도를 합친 기상청 여름철 체감온도다** (#292 — 예전에는 NOAA 열지수였다).
   * 반려견은 헐떡임으로 체온을 내려 습도에 사람보다 민감해서 이 값이 판정의 핵심 지표다.
   *
   * **`최고` 가 붙는 이유는 이 값이 하루 최대이기 때문이다** (`maxFeelsLikeTemperature`).
   * 산책 위험도가 같은 체감온도를 시각 기준으로 내므로(`place.detailFeelsLike`), 저장소
   * 전체에서 **이름은 `체감온도` 하나이고 기준은 `최고` 유무가 가른다.** 이 화면에는 시각
   * 기준 값이 나란히 서지 않지만, 화면마다 이름이 갈리면 그 구분 자체가 무너진다.
   */
  verdictFeelsLikeLabel: '최고 체감온도',
  walkAction: '이 날 산책',

  indoorAlternativesTitle: '비가 오면 갈 만한 실내',

  outOfRangeTitle: '여행 기간 밖 항목',
  outOfRangeDescription: '기간이 줄어들면서 남은 항목이에요.',
  /** `{day}` 치환 */
  outOfRangeDayLabel: '{day}일차에 있던 항목',

  /**
   * 거리는 **직선거리다.** 제주는 산간·해안도로가 많아 주행거리와 크게 다르다 —
   * `4.1km` 만 쓰면 주행거리로 읽힌다. `{distance}` 치환.
   */
  distanceFromLodging: '숙소에서 직선 {distance}',
  distanceFromPrevious: '직선 {distance} 이동',
  /**
   * `{distance}` 치환. 실내 대안 행 — **그날 기준 장소로부터**의 거리다.
   * 서버가 하버사인으로 재 주므로 화면이 계산하지 않지만, `직선` 은 똑같이 붙인다.
   */
  distanceStraight: '직선 {distance}',
  /** 30km 이상 구간에 덧붙는다 */
  longTripSuffix: ' — 하루 이동이 깁니다.',

  statusConfirmAction: '일정 확정하기',
  statusConfirmError: '확정하지 못했어요. 잠시 후 다시 시도해 주세요.',
  /**
   * 확정을 되돌린다 (#565). **확인 대화상자를 붙이지 않는 근거가 이 문구 자체다** —
   * 되돌릴 수 있는 동작에 확인을 붙이면 되돌릴 수 없다는 거짓말이 된다. 삭제만
   * `되돌릴 수 없어요` 로 확인을 받는다.
   */
  statusRevertAction: '초안으로 되돌리기',
  statusRevertError: '되돌리지 못했어요. 잠시 후 다시 시도해 주세요.',

  manageLabel: '일정 관리',
  /**
   * **`기간` 이 들어간다** (#585). 메뉴 항목은 안에서 무엇을 고칠 수 있는지로 읽히므로,
   * 기간 편집을 열면서 문구를 그대로 두면 메뉴만 보고는 날짜를 고칠 수 있다는 것을 모른다.
   */
  editAction: '이름·기간·예산 수정',
  editTitle: '일정 수정',
  editSubmit: '저장',
  editCancel: '취소',
  /**
   * 기간을 **줄일 때만** 실패할 수 있다는 사실을 미리 말한다 (#585).
   *
   * 서버는 줄어든 기간 밖에 항목이 남으면 `PLAN_008` 로 거부한다 — 고아 항목을 만들지
   * 않으려는 규칙이라 FE 가 미리 막을 수 없다(어느 일차에 항목이 있는지는 상세 응답에
   * 있지만, 그 판정을 화면이 복제하면 서버 규칙이 바뀔 때 두 곳이 갈린다). 대신 **막힐 수
   * 있다는 것과 막혔을 때 할 일**을 먼저 알려 둔다. 실제 거부 문구는 서버 것을 그대로 쓴다.
   */
  editPeriodHint: '기간을 줄이면 새 기간 밖에 남는 항목을 먼저 정리해야 저장돼요.',
  /** 예산을 비우는 방법이 서버에 없다 — 0 을 보낸다 (D4). 그 사실을 문구로 알린다 */
  editBudgetHint: '예산을 지우면 0원으로 저장돼요.',
  editError: '수정하지 못했어요. 잠시 후 다시 시도해 주세요.',

  deleteAction: '일정 삭제',
  /** `{title}` 치환 */
  deleteConfirmTitle: '{title} 일정을 삭제할까요?',
  deleteConfirmDescription: '담은 장소와 일자별 판정이 함께 사라져요. 되돌릴 수 없어요.',
  deleteError: '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',

  // ── 일자 편집모드 (#81) ────────────────────────────────────────────────
  // 정본은 아트보드 `여행 일정` 03 A(모바일) · B(데스크톱) · C(저장 실패).

  editDayAction: '순서 편집',

  // ── 하루 재생성 (#128 · 하루재생성-세부명세 R7) ─────────────────────────────
  /** 일자 헤더 버튼. `장소 추가`·`순서 편집` 과 같은 줄이라 짧게 둔다 */
  regenerateDayAction: '다시 만들기',
  /** `{day}` 치환. 재생성 화면의 제목 */
  regenerateDayPageTitle: '{day}일차 다시 만들기',
  regenerateDayNoteLabel: '이 날에 바라는 것 (선택)',
  regenerateDayNotePlaceholder: '실내 위주로 부탁해요',
  regenerateDaySubmit: '이 날 다시 만들기',
  regenerateDayCurrent: '지금',
  regenerateDayNext: '이렇게 바뀌어요',
  regenerateDayEmpty: '아직 담은 곳이 없어요',
  regenerateDayApply: '이 날 바꾸기',
  /**
   * 되돌리기를 만들 수 없다 — 계약에 일자 이력이 없다. **확정 전에 사실을 말하는 것**이
   * 유일한 방어다 (R5).
   */
  regenerateDayIrreversible: '지금 이 날의 항목은 사라지고 되돌릴 수 없어요.',
  /** 초안에 목표 일자가 없을 때 (R4-2). 빈 항목으로 저장하지 않는다 */
  regenerateDayMissing: '이 날을 다시 만들지 못했어요. 다시 시도해 주세요.',
  /**
   * '다녀옴' 초기화 (R5). **`visitResetNotice` 를 재사용하지 않는다** — 그 문구는
   * *"순서를 바꾸거나 장소를 담으면"* 이라고 계기 둘을 못박아 두었고 재생성은 거기
   * 없다. 그대로 쓰면 화면이 사실과 다른 말을 한다. 초기화되는 **이유는 같다**:
   * 일괄 교체가 새 `planItemId` 를 발급한다.
   */
  regenerateDayVisitReset: '이 날 항목이 바뀌면 ‘다녀옴’ 표시가 초기화돼요.',
  /**
   * 작업 실패 화면의 제목 (R6). **`aiPlan.failedTitle`(`일정을 만들지 못했어요`)을 쓰지
   * 않는다** — 하루가 실패했을 뿐 일정은 그대로 있다. 없어지지 않은 것을 없어졌다고
   * 말하면, 확정 전에 사실을 말하는 이 화면의 원칙(R5)이 실패 경로에서 뒤집힌다.
   */
  regenerateDayFailedTitle: '이 날을 다시 만들지 못했어요',
  /**
   * `PLAN_004` 로 막힌 뒤 **화면이 그 항목을 이미 뺐을 때** (R6).
   *
   * **`editMissingPlaceError` 를 쓰지 않는다** — 그 문구는 *"목록에서 빼면 저장할 수
   * 있어요"* 인데 여기 `이렇게 바뀌어요` 열은 읽기 전용이고 **빼는 것은 코드가 한다**.
   * 할 수 없는 일을 지시하지 않는다 (`save-error.ts` 의 분담 설명).
   */
  regenerateDayExcludedPlace: '조회되지 않는 장소를 뺐어요. 다시 눌러 주세요.',
  /**
   * `AIPLAN_017` 을 화면이 미리 말한다 (R6). 제출은 저장된 일정의 기간을 그대로 싣기
   * 때문에 이미 시작한 여행은 언제 눌러도 400 이다 — 버튼을 아예 내지 않는다.
   */
  regenerateDayPastPlan: '이미 시작한 여행은 다시 만들 수 없어요.',
  /** `AIPLAN_018`. AI 생성 상한은 10일이고 일정 저장 상한은 30일이라 벌어지는 틈이다 */
  regenerateDayTooLong: '10일이 넘는 일정은 AI 로 다시 만들 수 없어요.',

  /** 편집 중 상단 안내. 낙관적 업데이트를 하지 않는다는 것을 화면이 말한다 */
  editHint: '번호를 끌어 순서를 바꿀 수 있어요. 저장하기 전까지는 아무것도 바뀌지 않아요.',
  /** 거리 자리를 대신한다 — 순서를 옮길 때마다 숫자가 흔들리면 신뢰가 깨진다 */
  editDistanceNote: '이동 거리는 저장 후 다시 계산돼요',

  /** 손잡이 `title` — 마우스·터치에서 끌 수 있다는 것을 알린다 */
  editDragHandle: '끌어서 순서 바꾸기',
  editMoveUp: '위로 이동',
  editMoveDown: '아래로 이동',
  editRemove: '삭제',
  editRestore: '복구',
  /** 취소선(시각)과 함께 간다 — 색·선만으로 알리지 않는다 */
  editRemoveMark: '저장하면 삭제돼요',

  editSave: '저장',
  // 취소 문구는 `editCancel`(이름·예산 수정에서 쓰는 것)을 그대로 쓴다
  /** 저장 버튼이 잠긴 이유. `aria-describedby` 로 준다 */
  editNoChanges: '순서를 바꾸거나 삭제 표시를 해야 저장할 수 있어요.',

  /**
   * 재시도로 풀리지 않는 4xx 일반. `PLAN_001`(지워졌거나 남의 일정) · `PLAN_114` ·
   * Bean Validation 이 여기 온다 — 전부 "들고 있는 화면이 낡았다" 로 귀결된다.
   */
  saveStaleError: '화면이 최신이 아니에요. 새로고침한 뒤 다시 시도해 주세요.',

  editSaveErrorTitle: '순서를 저장하지 못했어요',
  editSaveErrorDescription: '편집한 내용은 그대로 있어요. 다시 시도해 주세요.',
  /**
   * `PLAN_004`. **재시도를 주지 않는다** — 같은 본문을 다시 보내면 같은 400 이다.
   * 서버가 어느 항목인지 알려주지 않아 화면이 조회 404 항목으로 짚는다 (E1).
   */
  editMissingPlaceError:
    '이 곳은 더 이상 조회되지 않아 함께 저장할 수 없어요. 목록에서 빼면 저장할 수 있어요.',
  /** `PLAN_002`. 상세가 낡았다는 뜻이라 재시도가 아니라 새로고침이다 */
  editDayOutOfRangeError: '여행 기간을 벗어난 일자예요. 새로고침한 뒤 다시 시도해 주세요.',
  /** 편집 진입 시 조회되지 않는 항목에 미리 붙인다 */
  editMissingPlaceMark: '이 곳은 더 이상 조회되지 않아요.',

  editDiscardTitle: '편집한 내용을 버릴까요?',
  editDiscardDescription: '바꾼 순서와 삭제 표시가 사라져요. 저장한 것은 그대로예요.',
  editDiscardConfirm: '버리기',

  /** `{position}` 치환. `aria-live` 로 읽힌다 */
  editAnnounceMoved: '{position}번째로 이동했어요',
  editAnnounceRemoved: '삭제 예정이에요',
  editAnnounceRestored: '삭제 표시를 해제했어요',

  // ── 장소 담기 (#82) ────────────────────────────────────────────────────
  // 두 진입점(장소 추가 화면 · 실내 대안)이 같은 일괄 교체 저장을 쓰므로 **둘끼리는**
  // 문구가 한 벌이다. 편집모드와는 나눈다 — `addPlaceMissingPlaceError` 참고 (F절).

  /** 일자 섹션의 진입 버튼 */
  addPlaceAction: '장소 추가',
  /** 실내 대안 행·목록 행의 담기 버튼 */
  addPlaceShort: '담기',
  /**
   * `{title}` 치환. 버튼의 `aria-label`.
   *
   * 한 화면에 `담기` 버튼이 여러 개라 보이는 글자만으로는 **스크린리더에 전부 "담기" 로
   * 읽혀 어느 장소인지 알 수 없다.**
   */
  addPlaceLabel: '{title} 담기',
  /**
   * 같은 일자에 같은 장소가 이미 있을 때. **서버는 중복을 막지 않는다** —
   * 화면이 먼저 막지 않으면 같은 곳이 두 번 담긴다 (F5-4).
   */
  addPlaceAlready: '이미 담았어요',

  /** `{title}`(조사 포함) · `{day}` 치환. 성공만 토스트로 말한다 */
  addPlaceToast: '{title} {day}일차에 담았어요',

  addPlaceErrorTitle: '담지 못했어요',
  /**
   * 5xx·무응답. **`editSaveErrorDescription` 을 쓰지 않는다** — 담기에는 "편집한 내용" 이
   * 없다. 분류는 `toPlanDaySaveError` 가 공유하고 문구만 화면이 준다.
   */
  addPlaceErrorDescription: '잠시 후 다시 시도해 주세요.',
  /**
   * `PLAN_004`. **편집모드 문구를 재사용하지 않는다** — 그쪽은 "목록에서 빼면" 인데
   * 담기 화면에는 뺄 목록이 없다. 원인은 **그 일자에 이미 있던** 조회되지 않는 항목이라
   * (일괄 교체가 그것까지 되싣는다) 일정으로 돌아가 그 항목을 빼야 풀린다.
   */
  addPlaceMissingPlaceError:
    '이 일자에 더 이상 조회되지 않는 장소가 있어 담을 수 없어요. 일정에서 그 항목을 먼저 빼 주세요.',

  /** 탭 제목. 일자를 넣으려면 라우트 파라미터가 필요해 정적 문구다 */
  addPlacePageTitle: '일정에 장소 담기',
  /** `{day}` 치환. 장소 추가 화면의 제목 */
  addPlaceTitle: '{day}일차에 담을 장소',
  /** 어느 일정인지 밝힌다 — 목록만 보면 어디에 담는지 알 수 없다 */
  addPlaceSubtitle: '고른 장소가 {day}일차 맨 뒤에 담겨요.',
  addPlaceBack: '일정으로 돌아가기',

  /**
   * `{day}` 치환. 주소를 손으로 고쳐 기간 밖 일자로 들어왔을 때.
   *
   * **저장 실패 문구(`editDayOutOfRangeError`)를 재사용하지 않는다** — 그쪽은
   * "새로고침한 뒤 다시 시도" 인데 여기서는 새로고침해도 없는 일자다.
   */
  addPlaceDayMissingTitle: '{day}일차는 이 여행에 없어요',
  /** `{totalDays}` 치환 */
  addPlaceDayMissingDescription: '이 여행은 총 {totalDays}일이에요. 일정에서 일자를 골라 주세요.',

  // ── 장소 상세에서 담기 (#118) ──────────────────────────────────────────
  // 아트보드 `혼디가개 장소 상세` 02. **위의 담기 문구와 한 벌이 아니다** — 그쪽은
  // "일정 안에서 장소를 고르는" 방향이고 여기는 "장소를 보다가 일정을 고르는" 반대
  // 방향이라, 고르는 대상도 실패 문구가 가리키는 곳도 다르다.

  /** 하단 바의 주요 액션 */
  addToPlanAction: '일정에 담기',
  /**
   * 담은 뒤 같은 자리의 라벨. **문구가 바뀌는 것이 중복 방지 장치다** — 같은 버튼이
   * 그대로면 두 번 눌러 같은 일정에 두 번 담는다 (아트보드 02-C).
   */
  addToPlanAgainAction: '다른 일정에도 담기',

  /** 시트 1단계 제목 */
  addToPlanSheetTitle: '어디에 담을까요?',
  /** `{count}` 치환. 일정 행의 부제 뒤에 붙는 항목 수 */
  addToPlanPlanItemCount: '항목 {count}개',
  /** 일정 목록 아래의 두 번째 갈래 */
  addToPlanCreateAction: '새 일정 만들어서 담기',

  /** 일정을 고른 뒤 나타나는 일자 선택의 제목 */
  addToPlanDayTitle: '며칠에 담을까요?',
  /** `{day}` 치환. 일자 버튼의 큰 글자 */
  addToPlanDayLabel: '{day}일차',
  /** `{date}` · `{count}` 치환. 일자 버튼의 작은 글자 — 몰림을 알린다 */
  addToPlanDayMeta: '{date} · {count}곳',
  /** `{day}` 치환. 일자를 고른 뒤의 안내 */
  addToPlanDayHint: '{day}일차 마지막에 추가돼요. 순서는 일정에서 바꿀 수 있어요.',
  /** `{day}` 치환. 시트 하단의 주요 액션 — **결과를 라벨에 쓴다** (디자인 가이드 §5-2) */
  addToPlanSubmit: '{day}일차에 담기',

  /** 시트 2단계(새 일정) 제목 */
  addToPlanCreateTitle: '새 일정 만들기',
  /**
   * `{title}` 에는 조사를 붙인 이름이 들어간다 — **`withTopicParticle()` (은/는) 이다.**
   * 피동문이라 목적격을 쓰면 "가세오름을 담겨요" 라는 비문이 된다.
   */
  addToPlanCreateHint: '{title} 1일차에 담겨요.',
  /** 2단계의 제출 버튼. `createSubmit`(직접 만들기 화면)과 하는 일이 다르다 */
  addToPlanCreateSubmit: '일정 만들고 담기',

  /** 일정이 하나도 없을 때. 1단계에서 곧바로 만들기로 안내한다 */
  addToPlanEmptyTitle: '아직 만든 일정이 없어요',
  addToPlanEmptyDescription: '새 일정을 만들면 이 장소를 1일차에 담아 드려요.',

  /** 토스트의 되돌아보기 링크 */
  addToPlanToastAction: '일정 보기',

  // ── 항목 방문 체크 (#124) ──────────────────────────────────────────────

  /**
   * icon-only 토글의 접근 가능한 이름. **상태가 아니라 누르면 일어날 일을 쓴다** —
   * `aria-pressed` 가 이미 현재 상태를 말하므로 이름까지 상태를 말하면 중복이다.
   */
  visitAction: '다녀옴으로 표시',
  visitedAction: '다녀옴 표시 해제',

  /**
   * 체크된 항목에 붙는 텍스트 표시. **색만으로 전달하지 않기 위한 낱말이다**
   * (DESIGN.md §7) — 아이콘 채움과 톤 약화만으로는 색각 이상에서 구분되지 않는다.
   */
  visitedLabel: '다녀옴',

  /** 일시 장애(5xx·무응답·PLAN_900). 재시도를 함께 준다 */
  visitErrorDescription: '체크를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
  /**
   * 4xx. **재시도를 주지 않는다** — 특히 `PLAN_005` 는 일괄 교체로 항목 id 가 바뀐
   * 뒤라 다시 눌러도 영영 실패한다.
   *
   * `saveStaleError` 를 재사용하지 않는다 — 그쪽은 "저장" 을 말하는데 여기서 잃은 것은
   * 체크 한 번이라 "저장하지 못했어요" 가 과하게 들린다.
   */
  visitStaleError: '이 일정이 바뀌었어요. 새로고침한 뒤 다시 시도해 주세요.',

  /**
   * 일괄 교체가 체크를 초기화한다는 경고. **그 일자에 체크된 항목이 있을 때만 낸다** —
   * 잃을 것이 없는 날에 띄우면 경고가 배경음이 된다.
   *
   * 백엔드 스키마 설명이 못박은 사실이다: 일차 항목을 교체하면 새 항목이 되므로 그 날의
   * 체크가 초기화된다 (screen-inventory §4). **일괄 교체 모델과 부딪히는 지점이라
   * 화면이 먼저 말해야 한다.**
   */
  visitResetNotice: '순서를 바꾸거나 장소를 담으면 이 날의 ‘다녀옴’ 표시가 초기화돼요.',

  /** 미로그인 시트 — 아트보드 04 ④ */
  addToPlanLoginTitle: '일정에 담으려면 로그인이 필요해요',
  /** `{title}` 에는 조사를 붙인 이름이 들어간다 — `withObjectParticle()` */
  addToPlanLoginDescription: '로그인하면 {title} 담을 수 있어요. 지금 보던 화면으로 돌아와요.',
  addToPlanLoginAction: '로그인',
  addToPlanLoginDismiss: '둘러보기 계속',
} as const

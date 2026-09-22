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
   * 승격된 자리의 진행률 한 줄 (#732). `{total}` · `{checked}` 치환.
   *
   * **`packingCheckedSummary` 와 역할이 다르다.** 저쪽은 제목 줄 끝에서 훑는 눈에 걸리라고
   * 둔 작은 값이고, 이쪽은 출발 전날 이 카드가 답하는 질문 그 자체라 문장으로 쓴다.
   */
  packingProgress: '{total}개 중 {checked}개 챙김',
  /**
   * 요약 모드를 펴는 버튼 (#732).
   *
   * **`더 보기` 가 아니다** — 이 버튼이 여는 것은 나머지 항목만이 아니라 도구(재생성 ·
   * 직접 추가)이기도 하다.
   */
  packingExpandAction: '전체 보기',
  /**
   * 출발 전날인데 준비물이 비었을 때 개요 아래에 서는 한 줄 (#732).
   *
   * **빈 카드를 맨 위로 올리지 않는다** — 그날 이 화면을 연 사람이 가장 먼저 만나는 것이
   * "아직 아무것도 없어요" 가 되면 승격의 보상이 빈 상태를 잘 보이게 한 것뿐이다.
   * 진입점은 남기고 면적은 주지 않는다.
   *
   * **`내일` 이라고 쓰지 않는다** — 승격 창은 `D-1` 과 출발 당일 둘이라 하루를 못박으면
   * 당일 화면에서 거짓말이 된다 (`PACKING_PROMOTION_MAX_DAYS`).
   */
  packingPromptTitle: '출발이 가까워요. 준비물이 아직 비어 있어요',
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
   * 빈 상태의 **한 문장** (#841). 예전에는 41자 + 저장 안내 22자로 두 문장이었는데, CTA
   * 하나에 붙기에 무거웠고 **AI 가 무엇을 골라 주는지 짐작할 단서는 여전히 0** 이었다 —
   * 그 일은 이제 일러스트가 맡는다.
   *
   * **반려견 이름을 넣지 않는다.** 대표 아이 이름(`{petName}`)으로 치환하는 안을 #841 이
   * 적었다가 걷었다 — 위 `packingSinglePetNote` 주석이 이미 답을 적어 두었다: #179 로
   * 서버가 **동행 반려견 전체**를 근거로 삼고, 몇 마리가 실제로 들어갔는지 응답에 없다.
   * 두 마리 일정에서 한 아이 이름만 말하면 #179 가 지운 거짓말이 그대로 되살아난다.
   * **`대표 동행견` 은 계약에 없는 FE 발명이다.** 다음 사람이 또 이름을 넣으려 할 자리다.
   *
   * **주어는 `AI가` 로 남는다** (#397). 예전 문구(`일정과 여행 기간 예보, 반려견 특성을
   * 근거로 만들어요.`)는 같은 사실을 담고도 **주어가 없어** 누가 만드는지 읽히지 않았고,
   * 그래서 절이 부가 기능으로 보였다 — 짧게 줄이는 일과 주어를 빼는 일은 다르다.
   *
   * **일반 체크리스트와 무엇이 다른지가 이 문장의 일이다.** 어디서든 구할 수 있는
   * 목록이면 이 기능은 필요 없다.
   */
  packingIntro: 'AI가 날짜 · 장소 · 예보 · 반려견 특성을 읽고 챙길 것을 골라요.',
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
   * 숫자가 아닌 `planId` → 400 `PLAN_124`. **재시도를 주지 않는다** — 같은 주소를
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
  /**
   * **호출부가 없다** — #841 에서 걷었다. 빈 상태를 사실처럼 적으면 잡음만 남고, `예산 입력`
   * 액션으로 이어지지도 않아 예산이 없으면 칸 자체를 세우지 않는다. 키를 남겨 두는 이유는
   * `plan-detail.test.ts` 가 이 상수로 "이제 이렇게 적지 않는다" 를 단언하기 때문이다.
   */
  budgetEmpty: '예산 미정',

  /** `{day}` 치환 */
  dayLabel: '{day}일차',
  dayEmpty: '이 날은 아직 담은 곳이 없어요.',

  /**
   * 개요 카드 목차의 섹션 머리 (#841).
   *
   * **`판정` 이 아니라 `적합도` 다.** 목차 배지에서 축 접두어를 뗀 근거가 "축 이름은 섹션
   * 머리가 한 번만 갖는다" 인데, `일자별 판정` 은 축 이름이 아니라서 그 근거가 서지 않았다
   * — 카드에 `적합도` 가 0회이고 바로 아래 일자 카드에는 `적합도 보통` 이 그대로 서서
   * 같은 값이 한 화면에서 축 있는 배지와 축 없는 배지로 두 번 섰다 (#652 의 요구가 여기서
   * 깨진다).
   */
  verdictTocTitle: '일자별 적합도',
  /** 목차에서 판정을 못 낸 날. 낮은 등급으로 칠하지 않고 점선 unknown 으로 둔다 */
  verdictTocUnavailable: '판정 없음',
  /**
   * 개요 스트립에 다 세우지 못한 일자 수 (#732). `{count}` 치환.
   *
   * **감추는 것이 아니라 세어서 말한다** — 여행은 최대 30일이라 전부 세우면 요약이 아니라
   * 목록이 되고, 아무 말도 없으면 그 일정이 4일짜리로 읽힌다. 판정 자체는 아래 일자
   * 카드가 그대로 갖는다.
   */
  verdictStripMore: '외 {count}일',
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
  /**
   * 체감온도를 못 받은 날에 큰 숫자 옆에 서는 단서 (#732). **예보 출처를 모를 때의 갈래다**
   * — 출처를 알면 `verdictFallbackMetric` 이 둘을 함께 말한다.
   *
   * **체감온도를 이 이름으로 부르지 않는다** (#253) — 판정의 근거를 잘못 알려 주는 것이다.
   * 라벨은 `verdictFeelsLikeLabel` 로 고정이고, 그 날 실제로 선 값의 이름은 이 단서가 말한다.
   */
  verdictTemperatureLabel: '최고기온',
  /**
   * 큰 숫자 옆 단서 (#732). `{source}` 치환 — 서버가 준 `forecastSourceName`.
   *
   * 예전에는 `{source} 기준이라 대략적인 값이에요.` 가 **근거 문단 맨 아래**, 그것이
   * 설명하는 값에서 가장 먼 자리에 있었다. 나란한 두 일자가 다른 지표를 쓰는 이유를
   * 말하는 문장인데 그 자리에서는 아무도 둘을 잇지 못했다 — 값 옆으로 올리면서 문장을
   * 낱말로 줄였다(배지 한 칸).
   */
  verdictFallbackMetric: '{source} 최고기온',
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
  /**
   * 일자 액션 줄의 산책 링크 (#842). **판정 줄에서 내려오면서 목적지를 말하게 했다** —
   * `이 날 산책` 은 링크가 아니라 행동으로 읽혔다 (#653 의 남은 지적).
   *
   * **`산책 코스` 라고 부르지 않는다.** 이슈 #842 본문은 그 문구를 제안했지만, 이 저장소에서
   * `산책 코스` 는 `walkCourse` · `/walk-courses` 라는 **별개 도메인**이고 이 링크가 가는
   * 곳은 `/places/{representativePlaceId}` 즉 그 날 **기준 장소의 상세**다. 목적지를
   * 말하려다 틀린 목적지를 말하게 된다.
   *
   * `위험도` 인 이유는 그 화면이 이 축을 소유하기 때문이다 (`place-walk-safety-panel.tsx`).
   */
  walkAction: '이 날 산책 위험도',

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

  /**
   * 항목 시작 시각 줄의 스크린리더 전용 접두어 (#623 · 명세 D14-3).
   *
   * `<time datetime>` 만으로는 숫자가 무슨 뜻인지 알 수 없다 — `<span class="sr-only">`
   * 로 이 낱말을 먼저 읽힌다. 시각 자체(`10:30`)는 문구가 아니라 값이라 여기 없다.
   */
  startTimeSrLabel: '시작 시각',

  /**
   * 항목 산책 위험도 (#625 · 명세 D15-5). **시각 기준이다** — 일자 판정의
   * `verdictFeelsLikeLabel`(`최고 체감온도`, 하루 최대)과 라벨로 기준을 가른다.
   * `displayTemperature()` 를 쓰지 않는다 — 그 함수는 하루 단위 폴백 규칙이고 여기는
   * `feelsLikeCelsius` 하나뿐이라 폴백이 없다.
   */
  walkSafetyFeelsLikeLabel: '체감온도',
  /**
   * 일자는 반려견 특성을 반영했다는데 **이 항목만 반영하지 못한** 경우의 한 줄 (#717).
   *
   * **일자도 반영하지 못한 날에는 쓰지 않는다** — 그때는 일자 판정(`PlanDayVerdict`)이
   * 이미 같은 말을 하고 있어 항목마다 반복하면 새 정보 없이 줄만 늘어난다. 이 문구는
   * 일자의 주장과 행의 사실이 **어긋날 때만** 선다 (`plan-item-row.tsx`).
   */
  walkSafetyPetConditionMissing: '이 항목은 반려견 특성 없이 판정했어요.',
  /** 전체 조회 5xx·무응답 (D15-7). 항목 하나의 실패(`LOOKUP_FAILED`)와는 다른 자리다 */
  walkSafetyErrorTitle: '산책 위험도를 불러오지 못했어요.',
  /**
   * **`messages.common.retry`(다시 시도)를 쓰지 않는다.** 같은 일자 카드에 판정
   * 재시도(`PlanDayVerdict`)가 이미 있어, 이름이 갈려야 스크린리더가 둘을 구분한다
   * (D15-8 · WCAG 접근 가능한 이름). 전체 5xx 재시도와 `LOOKUP_FAILED` 재시도가 같은
   * 문구를 쓴다 — 둘 다 같은 재조회(`planKeys.walkSafety`)를 부른다.
   */
  walkSafetyRetryAction: '산책 위험도 다시 불러오기',

  statusConfirmAction: '일정 확정하기',
  statusConfirmError: '확정하지 못했어요. 잠시 후 다시 시도해 주세요.',
  /**
   * 확정을 되돌린다 (#565). **확인 대화상자를 붙이지 않는 근거가 이 문구 자체다** —
   * 되돌릴 수 있는 동작에 확인을 붙이면 되돌릴 수 없다는 거짓말이 된다. 삭제만
   * `되돌릴 수 없어요` 로 확인을 받는다.
   */
  statusRevertAction: '초안으로 되돌리기',
  statusRevertError: '되돌리지 못했어요. 잠시 후 다시 시도해 주세요.',
  /**
   * 확정된 여행을 마친다 (#613). **초안에서는 이 버튼을 열지 않는다** — 확정하지
   * 않은 여행을 마친 것으로 말하지 않는다. 잘못 닫았으면 `statusReopenAction` 으로
   * 확정만 되돌린다. 확인 대화상자를 붙이지 않는다 — 되돌릴 수 있는 동작이다.
   */
  statusCompleteAction: '여행 완료하기',
  statusCompleteError: '완료로 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.',
  /**
   * 완료를 확정으로 되돌린다. **초안으로는 가지 않는다.** 다녀온 기록을 작성 중으로
   * 되돌리는 것은 다른 판단이다.
   */
  statusReopenAction: '확정으로 되돌리기',
  statusReopenError: '되돌리지 못했어요. 잠시 후 다시 시도해 주세요.',

  manageLabel: '일정 관리',
  /**
   * **`기간` 이 들어간다** (#585). 메뉴 항목은 안에서 무엇을 고칠 수 있는지로 읽히므로,
   * 기간 편집을 열면서 문구를 그대로 두면 메뉴만 보고는 날짜를 고칠 수 있다는 것을 모른다.
   */
  editAction: '이름·기간·예산 수정',
  /**
   * 초안·확정에서 쓰는 같은 항목 (#622). **완료 일정에서는 `editAction` 이 그대로다** —
   * 그 상태에서는 동행견 그룹이 폼에 없으므로(`PLAN_019`), `동행견` 이 적힌 항목을 열었는데
   * 그 컨트롤이 없으면 위 `editAction` 주석의 근거가 반대로 깨진다.
   */
  editActionWithPets: '이름·기간·예산·동행견 수정',
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
  /**
   * 수정 모달의 동행견 그룹 `legend` (#622).
   *
   * **`fieldPet`(`누구와 가나요`)을 쓰지 않는다.** 그것은 만들기 폼의 질문형 라벨이고,
   * 이 모달의 다른 라벨은 전부 명사(`일정 이름` · `시작일` · `예산 (선택)`)다.
   */
  fieldPets: '동행 반려견',
  /**
   * 대표를 **사실로만** 말한다 (D13-7). 대표(`petIds[0]`)가 정하는 것은 목록 행 요약이고,
   * 일자 판정 기준(`basisPetId`)은 그날 점수가 가장 낮은 아이라 **다른 축**이다 — 그래서
   * 이 힌트가 판정을 말하지 않는다. 대표를 바꾸는 전용 컨트롤은 아직 없다 (D13-10 미결 1).
   */
  editPetsHint: '먼저 고른 아이가 대표예요.',
  /**
   * 동행견이 **전부 삭제돼 0마리로 열린** 폼에서만 `editPetsHint` 대신 선다 (#752 · D13-5).
   *
   * 그 상태에서 `먼저 고른 아이가 대표예요.` 만 서 있으면 _"골라야 저장되나"_ 로 읽힌다 —
   * 검증은 더 이상 막지 않는데(초기 0마리는 조작이 아니라 시작 상태다) 화면이 반대로
   * 말하는 셈이다. **막히지 않는다는 사실**을 같은 자리에서 말한다.
   *
   * 남은 반려견이 몇 마리인지 적지 않는다 — 옵션 목록이 바로 아래에 있고, 세는 값을 문구가
   * 복제하면 갈린다 (`message-tone.test.ts` 의 개수 규칙과 같은 판단).
   */
  editPetsClearedHint:
    '함께 가기로 한 아이가 모두 지워졌어요. 새로 고르지 않아도 이름·기간·예산은 저장돼요.',
  /**
   * **`petIds` 가 실제로 실린 저장에서만** 띄운다 (D13-6). 제목만 고친 저장에 뜨면 거짓말이다.
   *
   * 서버가 저장 시점에 판정·준비물을 다시 계산하지 않으므로
   * (`PlanCommandProcessor.java:199-201`) 달라지는 것은 **다음 조회부터**다. 화면이 그
   * 계산을 복제하지 않고 다시 읽기만 하니, 바뀔 수 있다는 사실만 알린다.
   */
  editPetsSaved: '동행견을 바꿨어요. 일자 판정과 준비물 근거가 달라질 수 있어요.',
  editError: '수정하지 못했어요. 잠시 후 다시 시도해 주세요.',

  deleteAction: '일정 삭제',
  /** `{title}` 치환 */
  deleteConfirmTitle: '{title} 일정을 삭제할까요?',
  deleteConfirmDescription: '담은 장소와 일자별 판정이 함께 사라져요. 되돌릴 수 없어요.',
  deleteError: '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',

  // ── 일정 복사 (#617) ────────────────────────────────────────────────────
  // 확정 문구 11종. `일정복사-세부명세.md` D5 가 정본이다 — 즉흥으로 짓지 않는다.
  copyAction: '이 일정 복사하기',
  copyTitle: '일정 복사',
  copyDescription: '담은 장소를 그대로 옮겨 새 초안을 만들어요. 원본 일정은 그대로 남아요.',
  copyCarryHint: '방문 체크 · 준비물 · 후기는 복사되지 않아요.',
  /** `{days}` 를 `plan.totalDays` 로 치환한다. `2박 3일` 이 아니라 `3일` — 서버가 세는 단위다 */
  copyPeriodHint: '원본과 같은 {days}일로 복사돼요. 일수가 다르면 저장되지 않아요.',
  copyTitleHint: '제목 뒤에 (복사) 가 붙어요. 복사한 뒤 바꿀 수 있어요.',
  copySubmit: '복사하기',
  copyCancel: '취소',
  copyError: '복사하지 못했어요. 잠시 후 다시 시도해 주세요.',
  copyMissingPlanAction: '목록으로',
  copyPetAction: '반려견 관리로 가기',

  // ── 일자 편집모드 (#81) ────────────────────────────────────────────────
  // 정본은 아트보드 `여행 일정` 03 A(모바일) · B(데스크톱) · C(저장 실패).

  editDayAction: '순서 편집',

  // ── 하루 재생성 (#128 · 하루재생성-세부명세 R7) ─────────────────────────────
  /** 일자 헤더 버튼. `장소 추가`·`순서 편집` 과 같은 줄이라 짧게 둔다 */
  regenerateDayAction: '다시 만들기',
  /**
   * 일자 카드 오버플로(`⋯`)의 접근 가능한 이름 (#653). **`{day}` 를 치환한다** —
   * 3일 일정이면 같은 `⋯` 가 셋이라 일자를 넣지 않으면 스크린리더에서 구별되지 않는다.
   */
  dayMenuLabel: '{day}일차 관리',
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
   * 시각 초기화 경고 (#623 · 명세 D14-6). **`regenerateDayVisitReset` 옆에** 조건부로
   * 선다 — 재생성 초안(`AiPlanScheduleItem`)에 시각 필드가 아예 없어(G5) 재생성된 날은
   * 시각이 전부 사라진다. **그 날에 시각 있는 항목이 있을 때만** 낸다 — 잃을 것이 없는
   * 날에 늘 뜨는 경고는 배경음이 되어 정작 잃을 날에 읽히지 않는다 (D9-2 와 같은 판단).
   */
  regenerateDayStartTimeReset: '다시 만들면 이 날에 적어 둔 시작 시각도 함께 사라져요.',
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
  /**
   * 시각 입력 위 안내 (#623 · 명세 G4). **`editHint` 와 다른 줄이다** — 순서 편집과
   * 시각 편집은 다른 조작이라 한 문장에 욱여넣으면 어느 쪽 이야기인지 갈린다.
   */
  editStartTimeHint: '시작 시각은 선택이에요. 비우면 상세에 표시하지 않아요.',
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

  /**
   * 시각 입력 접근 가능 이름 (#623 · 명세 G4). `{title}` 치환.
   *
   * **행마다 보이는 라벨을 달지 않는다.** 한 일자에 항목이 여럿이라 `시작 시각` 이
   * 여러 번 서므로 이름은 `aria-label` 이 지고, `{title}` 을 넣어 구별한다 — 담기
   * 버튼(`{title} 담기`, F6)과 같은 규칙이다.
   */
  editStartTimeLabel: '{title} 시작 시각',
  /** 지우기 버튼 접근 가능 이름. `{title}` 치환 */
  editStartTimeClearLabel: '{title} 시작 시각 지우기',

  editSave: '저장',
  // 취소 문구는 `editCancel`(이름·예산 수정에서 쓰는 것)을 그대로 쓴다
  /** 저장 버튼이 잠긴 이유. `aria-describedby` 로 준다 */
  editNoChanges: '순서를 바꾸거나 삭제 표시를 해야 저장할 수 있어요.',

  /**
   * 재시도로 풀리지 않는 4xx 일반. `PLAN_001`(지워졌거나 남의 일정) · `PLAN_124` ·
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
  /**
   * `PLAN_100` — 시각 본문 파싱 실패 (#623 · 명세 G4). **재시도를 주지 않는다** — 같은
   * 본문을 다시 보내면 같은 400 이다. 네이티브 `<input type="time">` 만 쓰면 이 경로에
   * 닿지 않는다고 보지만(G8 미결 2), 서버는 계약상 이 오류를 낼 수 있다.
   */
  editStartTimeFormatError: '시각 형식이 올바르지 않아요. 다시 입력해 주세요.',
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

  // ── 코스 상세에서 일정에 담기 (#620) ───────────────────────────────────
  // 아트보드는 없다 — `PlaceAddToPlanSheet` 와 같은 시트 모양을 쓴다
  // (`올레담기-세부명세.md` D0-1). 위의 장소 담기 문구를 최대한 재사용하고, 다른
  // 부분(1단계 제목·성공 토스트)만 여기 따로 둔다.

  /** 1단계 제목. `addToPlanSheetTitle`("어디에 담을까요?")과 다른 문장이다 (D5) */
  walkAddToPlanSheetTitle: '어느 일정에 담을까요?',
  /** `{courseLabel}` · `{name}` · `{distanceKm}` 치환. 시트 머리의 담기 대상 요약 줄 (D1) */
  walkAddSummaryLine: '{courseLabel} {name} · {distanceKm}',
  /**
   * `{course}`(조사 포함) · `{planTitle}` · `{day}` 치환. **일정 제목까지 말한다** —
   * 장소 담기 토스트(`addPlaceToast`)와 달리 코스 이름표만으로는 어느 일정에 담겼는지
   * 알 수 없다.
   */
  walkAddToast: '{course} {planTitle} {day}일차에 담았어요.',
  /**
   * 5xx·무응답. **`addPlaceErrorDescription` 을 재사용하지 않는다** — 분류는
   * `toPlanDaySaveError` 가 공유하고 문구만 화면이 준다 (D5).
   */
  walkAddErrorDescription: '코스를 담지 못했어요. 편집한 내용은 그대로 있어요. 다시 시도해 주세요.',
  /**
   * `PLAN_004`. **`addPlaceMissingPlaceError` 를 재사용하지 않는다** — 여기서 담는 것은
   * 코스인데 실패 원인은 그 일자에 이미 있던 **장소**다. 담기 화면에는 뺄 목록이 없으므로
   * "일정에서 빼 주세요" 로 할 수 있는 일을 가리킨다. 코스 때문에 나는 실패가 아니다
   * (서버가 `WALK` `targetId` 를 검증하지 않는다 — D3-3).
   */
  walkAddMissingPlaceError:
    '이 일자에 더 이상 조회되지 않는 장소가 있어 함께 저장할 수 없어요. 일정에서 그 장소를 빼 주세요.',

  // ── 항목 방문 체크 (#124) ──────────────────────────────────────────────

  /**
   * 방문 토글의 접근 가능한 이름. **상태가 아니라 누르면 일어날 일을 쓴다** —
   * `aria-pressed` 가 이미 현재 상태를 말하므로 이름까지 상태를 말하면 중복이다.
   *
   * **체크 전 이름은 보이는 글자(`visitToggleLabel`)와 같아야 한다** (#653 · WCAG 2.5.3
   * Label in Name). 토글이 `iconOnly` 를 벗으면서 보이는 글자가 생겼는데, 이름이
   * `다녀옴으로 표시` 이고 글자가 `다녀옴 표시` 면 **음성 제어 사용자가 화면에 보이는
   * 그대로 말했을 때 이 버튼이 잡히지 않는다.** 그래서 `다녀옴 표시` 로 맞춘다 —
   * 아이콘만이던 시절에는 보이는 글자가 없어 성립하던 규칙이다.
   *
   * 체크 뒤(`다녀옴` ⊂ `다녀옴 표시 해제`)는 이미 포함 관계라 그대로 둔다.
   */
  visitAction: '다녀옴 표시',
  visitedAction: '다녀옴 표시 해제',

  /**
   * 방문 토글의 **보이는** 글자, 체크 전 (#653 · 진단 PL-5).
   *
   * **`다녀옴` 을 그대로 쓰지 않는다.** 아직 안 간 행에 `다녀옴` 이 적혀 있으면 훑는
   * 사람에게는 그 행이 이미 다녀온 것으로 읽힌다 — `✓` 가 무엇인지 몰랐던 것보다 나쁘다.
   * 체크 전에는 **누르면 일어날 일**을, 체크 뒤에는 **상태**를 말한다.
   *
   * `visitAction` 과 같은 값이다. 키를 합치지 않는 것은 **역할이 다르기 때문**이다 —
   * 하나는 접근 가능한 이름이고 하나는 보이는 글자다. 나중에 한쪽만 바꿔야 할 때
   * 합쳐 두면 WCAG 2.5.3 을 모르는 사람이 조용히 깬다.
   */
  visitToggleLabel: '다녀옴 표시',
  /**
   * 체크된 항목의 토글에 붙는 낱말. **색만으로 전달하지 않기 위한 것이다**
   * (DESIGN.md §7) — 아이콘 채움과 톤 약화만으로는 색각 이상에서 구분되지 않는다.
   *
   * **배지가 아니라 토글 버튼이 이 낱말을 갖는다** (#653) — 배지는 체크 뒤에만 보였는데
   * 버튼은 체크 전에도 보여 `✓` 가 무엇인지 함께 말한다.
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

  // ── 여행 후기 (#615) ──────────────────────────────────────────────────────
  reviewHeading: '여행 후기',
  /**
   * 완료했는데 아직 안 쓴 상태. **재시도가 아니라 다음 행동** 이다 —
   * 404 `PLAN_015` 는 데이터 부재다.
   */
  reviewEmptyTitle: '아직 후기가 없어요',
  reviewEmptyDescription: '다녀온 여행이 어땠는지 남겨 두면 다음에 일정을 고를 때 도움이 돼요.',
  reviewWriteAction: '후기 쓰기',
  reviewEditAction: '후기 고치기',
  reviewCancelAction: '취소',
  reviewSubmitCreate: '후기 남기기',
  reviewSubmitUpdate: '후기 저장',
  reviewOverallLabel: '전체 만족도',
  /** `{rating}` 치환. **1~5 숫자를 그대로 쓴다** — 별점 한국어 매핑 테이블을 만들지 않는다 */
  reviewOverallValue: '전체 만족도 {rating}',
  reviewBodyLabel: '여행이 어땠나요',
  reviewBodyHint: '없어도 돼요. 2000자까지 적을 수 있어요.',
  reviewBodyPlaceholder: '둘째 날이 더워서 실내 위주로 다녔어요.',
  reviewPlacesLabel: '다녀온 장소',
  /**
   * 장소 평점은 빼도 된다. 서버도 빈 `items` 를 받는다 —
   * 전체 만족도만 남겨도 후기가 성립한다.
   */
  reviewPlacesHint: '다녀온 장소만 골라 적을 수 있어요. 빼도 돼요.',
  reviewPlaceRatingLabel: '장소 만족도',
  reviewPlaceCommentLabel: '한 줄 후기',
  reviewPlaceCommentHint: '없어도 돼요. 200자까지예요.',
  reviewLoadErrorTitle: '후기를 불러오지 못했어요',
  reviewSaveError: '후기를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',

  // ── 공유 링크 (#628) ──────────────────────────────────────────────────
  // 발급·폐기는 `/plans/[planId]` 관리 메뉴 안 모달, 열람은 `/shared-plans/[token]`.

  shareAction: '공유 링크',
  shareTitle: '공유 링크',
  /**
   * **보이지 않는 것을 먼저 말한다.** 링크를 주는 쪽이 가장 먼저 묻는 것이
   * "어디까지 보이나" 다 — 예산과 메모는 응답에서 빠져 있다(`SharedPlanResponse`).
   * 그 사실을 여기서 말하지 않으면 확인할 방법이 없다.
   */
  shareDescription:
    '링크를 아는 사람은 로그인 없이 이 일정을 볼 수 있어요. 예산과 메모는 보이지 않아요.',
  shareIssueAction: '링크 만들기',
  shareIssueError: '링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
  shareLoadError: '공유 링크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  shareLinkFieldLabel: '공유 링크 주소',
  shareCopyAction: '복사',
  shareCopiedLabel: '복사됨',
  /** 비 HTTPS · 구형 브라우저에서 `navigator.clipboard` 가 없다. 조용히 실패하지 않는다 */
  shareCopyError: '복사하지 못했어요. 주소를 직접 복사해 주세요.',
  shareRevokeAction: '링크 폐기',
  shareRevokeConfirmTitle: '공유 링크를 폐기할까요?',
  /**
   * **"다른 링크가 나온다" 를 말한다.** 재발급이 같은 링크를 돌려줄 것으로 기대하면
   * 이미 보낸 링크가 죽은 것을 모른 채 넘어간다 (BE 가 POST 를 멱등으로 만든 이유와
   * 같은 축이다 — 죽이는 것은 이 버튼뿐이어야 한다).
   */
  shareRevokeConfirmDescription:
    '이미 보낸 링크가 즉시 열리지 않게 돼요. 다시 만들면 다른 주소가 나와요.',
  shareRevokeError: '폐기하지 못했어요. 잠시 후 다시 시도해 주세요.',
  /** `{date}` 치환 */
  shareExpiryOn: '{date}까지 볼 수 있어요',
  shareExpiryToday: '오늘까지 볼 수 있어요',
  shareExpired: '만료됐어요',

  // 열람 화면 — 받은 사람이 본다

  /**
   * **일정 제목을 탭 제목에 넣지 않는다.** 브라우저 히스토리·탭 제목으로 남의 일정
   * 이름이 새는 것을 줄인다. 이 화면은 `noindex` 이기도 하다.
   */
  sharedPageTitle: '공유된 여행 일정',
  sharedReadOnlyNote: '공유받은 일정이라 볼 수만 있어요.',
  /**
   * **`dayEmpty` 와 갈라 둔다.** 소유자 문구("아직 담은 곳이 없어요")의 `아직` 은
   * 지금 담으라는 말이라 **담을 수 없는 사람에게는 할 일을 잘못 알린다.**
   */
  sharedDayEmpty: '이 날은 담은 곳이 없어요.',
  /**
   * 404 — 없는 토큰 · 폐기 · 삭제된 일정 · 초안 회귀가 **전부 여기로 온다.**
   * 서버가 어느 쪽인지 알려 주지 않으므로(토큰 존재 여부를 흘리지 않는다) 화면도
   * 원인을 단정하지 않는다.
   */
  sharedNotFoundTitle: '유효하지 않은 링크예요',
  sharedNotFoundDescription: '링크가 폐기됐거나 일정이 지워졌어요.',
  /** 410 — 만료만 따로 온다. 받은 사람이 할 수 있는 일이 있는 유일한 갈래다 */
  sharedExpiredTitle: '만료된 링크예요',
  sharedExpiredDescription: '링크를 만든 사람에게 새 링크를 요청해 주세요.',
  sharedErrorTitle: '일정을 불러오지 못했어요',
  // ── 출발 전 여행 브리핑 (#626) ────────────────────────────────────────────
  briefingHeading: '여행 브리핑',
  briefingPageTitle: '출발 전 여행 브리핑',
  briefingBack: '일정으로 돌아가기',
  /**
   * `{title}` · `{date}` · `{day}` 치환 — 값은 전부 **응답**의 것이다.
   *
   * **`{date}` 는 `formatPlanDay()` 가 만든 `9월 19일 (토)` 다** (#733). 예전에는 여기서
   * `09-19 (토)` 를 조립했는데, 같은 일정의 개요가 `2026년 9월 19일 (토)` 라 **같은 날을
   * 두 모양으로** 부르고 있었다. 날짜를 글자로 옮기는 곳은 `lib/plan/date.ts` 하나다 (#732).
   *
   * **날짜가 일차보다 앞이다.** 브리핑을 여는 사람이 먼저 맞춰 보는 것은 몇 일차인지가
   * 아니라 **어느 날**인지다 — 전날 밤에 여는 갈래가 특히 그렇다.
   */
  briefingSubtitle: '{title} · {date} · {day}일차',

  /**
   * 일정 상세의 진입 배너 (일정상세-세부명세 D16-3). **날짜 축 하나로만 노출을 가른다** —
   * 상태(`COMPLETED`)를 보지 않는다.
   *
   * **설명도 같은 축으로 갈린다** (#733). 전날 브리핑에는 특보도 골든타임도 없는데
   * (그 날은 서버가 둘 다 null 로 준다) 배너가 넷을 약속하면 **약속과 화면이 어긋난다** —
   * 별도 라우트까지 만들어 들어온 대가가 빈 카드 둘이었다.
   */
  briefingBannerEveTitle: '내일 출발 · 브리핑 보기',
  briefingBannerTodayTitle: '오늘의 브리핑',
  briefingBannerEveDescription: '내일 볼 것 미리 보기',
  briefingBannerTodayDescription: '그날 일정 · 날씨 · 특보 · 산책 시간을 한 번에 봐요',

  /**
   * 기간 밖 — **요청 자체를 하지 않는다** (`pickBriefingDate` 가 null). 데이터 부재라
   * `EmptyState` 고 재시도가 없다.
   */
  briefingOutOfRangeTitle: '아직 브리핑할 날이 아니에요',
  briefingOutOfRangeDescription: '출발 하루 전부터 여행 마지막 날까지 볼 수 있어요',
  briefingOutOfRangeAction: '일정 보기',
  /**
   * 브리핑 400(`PLAN_002`). **이 자리에만 400 에 재시도를 단다** — 화면이 기간 안의
   * 날짜만 보내므로 이 코드는 "그 사이 기간이 수정됐다" 는 뜻이고 다시 열면 풀린다.
   * 고칠 입력 필드가 없어 `일정 보기` 를 함께 준다.
   */
  briefingStaleRangeDescription: '일정 기간이 바뀐 것 같아요. 일정을 다시 열어 주세요',
  briefingErrorTitle: '브리핑을 불러오지 못했어요',

  briefingScheduleHeading: '그날 일정',
  /** `{count}` · `{visited}` 치환. **`visited` 가 0 이어도 적는다** — 그 0 이 정보다 */
  briefingScheduleCounts: '항목 {count}개 · 다녀온 곳 {visited}개',
  /**
   * 동선의 처음과 마지막 사이에 낀 항목 수 — `{count}` 치환 (#733).
   *
   * **`처음` · `마지막` 라벨을 대신한다.** 예전에는 라벨과 값이 한 노드에 같은 굵기로
   * 들어가 `처음 함덕 서우봉 해변` 이 한 문장처럼 읽혔다. 순서는 이제 점·선이 말하므로
   * 글자로 다시 말하지 않고, 그 자리에 **응답이 실제로 아는 값**을 넣는다.
   *
   * **이동 거리가 아니다.** 브리핑 응답의 `schedule` 에는 좌표가 없어(`walkTimes` 안에만
   * 온다) 항목 사이 거리를 낼 수 없다 — 지어내지 않고 셀 수 있는 것을 센다.
   */
  briefingScheduleBetween: '사이 {count}곳',
  /** 동선 항목에 붙는 태그. 별도 줄(`briefingScheduleBasisPlace`)을 없앤 자리다 (#733) */
  briefingScheduleBasisTag: '기준 장소',
  /** `{title}` 치환 — 기준 장소가 처음·마지막 **어느 쪽도 아닐 때만** 쓰는 줄이다 */
  briefingScheduleBasisPlace: '이 날 기준 장소 · {title}',
  briefingScheduleOpenDay: '이 날 일정 보기',
  /** 지도 위 기준 줄 — 핀은 대표 장소 하나뿐이라 "이 날의 경로" 로 읽히지 않게 못박는다 */
  briefingScheduleMapBasis: '{title} 기준',
  /** 유형 배지를 스크린리더가 값처럼 읽지 않게 붙이는 라벨 (서버 매핑 테이블이 아니다) */
  briefingScheduleTypeLabel: '유형',
  briefingScheduleEmptyTitle: '이 날에는 담긴 항목이 없어요',
  briefingScheduleEmptyAction: '일정에 장소 담기',

  /**
   * 날씨 카드 제목 — **갈래를 제목이 말한다** (#733).
   *
   * 전날에 여는 브리핑과 당일에 여는 브리핑이 같은 `날씨와 적합도` 였다. 이 화면이 보는
   * 날은 하나뿐인데 그 날이 언제인지를 제목이 말하지 않으면, 일정 상세의 일자 카드와
   * 구분이 되지 않는다.
   */
  briefingWeatherEveHeading: '내일 날씨와 적합도',
  briefingWeatherTodayHeading: '오늘 날씨와 적합도',
  /** 프레젠터상 나오지 않아야 하는 조합이다 — 그래도 자리를 비워 두지 않는다 */
  briefingWeatherMissing: '날씨 판정을 받지 못했어요',
  /**
   * 하루 지표 줄 — `{value}` 치환 (#733).
   *
   * **응답에 이미 있는데 버리고 있던 값이다.** `PlanDailyWeatherItem` 의 `skyStateName` ·
   * `minTemperature` · `maxTemperature` · `maxPrecipitationProbability` 를 판정 카드가
   * 하나도 쓰지 않았다 — 큰 숫자(최고 체감온도) 하나로는 전날 밤에 "내일 언제 나갈까" 를
   * 정할 수 없다.
   *
   * **시간대를 말하지 않는다.** 이 값들은 전부 **하루치 집계**라 `아침` · `낮` 같은 구간
   * 라벨을 붙이면 응답에 없는 사실을 화면이 지어내는 것이 된다 (BE 후속 요청).
   */
  briefingWeatherMaxTemperature: '최고 {value}℃',
  briefingWeatherMinTemperature: '최저 {value}℃',
  briefingWeatherPrecipitation: '강수 {value}%',

  briefingWarningHeading: '기상특보',
  /**
   * **`weatherWarning` 과 이유가 둘 다 null 일 때만 쓴다** (명세 D5-3).
   *
   * 이유가 차 있는데 이 문장을 쓰면 **태풍경보를 조용히 지운다** — 서버 javadoc 이 같은
   * 말을 한다. 갈래를 잠그는 테스트가 `plan-briefing-section.test.ts` 에 있다.
   */
  briefingWarningNone: '발효 중인 기상특보가 없어요',
  /**
   * 이유가 차 있는 날. **서버 문장을 그대로 아래 붙인다.**
   *
   * **`다시 시도` 를 달지 않는다** — 이유가 코드가 아니라 문장이라 "당일에만 확인"(정상)과
   * "가져오지 못했다"(일시 장애)를 화면이 가를 수 없다. 문장을 파싱하지 않는다.
   * 고칠 수 없는 것에 버튼을 달면 계속 누른다 (명세 D9-2 가 BE 후속으로 분리했다).
   */
  briefingWarningUnavailableTitle: '기상특보를 확인하지 못했어요',
  /** `{time}` 치환 — `effectiveAt` 의 `HH:mm` 이다. 없으면 이 줄을 빼고 말을 만들지 않는다 */
  briefingWarningEffectiveAt: '{time} 발효',
  /** `recommendationSuppressed === true` 일 때만. **`level.code` 로 직접 판정하지 않는다** */
  briefingWarningSuppressed: '경보가 발효 중이라 야외 일정은 미루는 게 좋아요',

  briefingWalkHeading: '산책하기 좋은 시간',
  /** `{from}` · `{to}` 치환 — en dash 를 읽지 못하는 스크린리더용 `sr-only` 문장이다 */
  briefingWalkRangeLabel: '{from}부터 {to}까지',
  /** `goldenWindowStatus` 가 없는 옛 서버에서 창도 없을 때만 */
  briefingWalkNone: '추천할 산책 구간이 없어요',
  /** `walkTimes` 와 이유가 둘 다 비어 온 계약 밖 조합 */
  briefingWalkUnknown: '산책 시간 판정을 받지 못했어요',
  /**
   * `NO_PLACE_ITEM` 갈래의 길 (#716). **재시도가 아니라 할 일이다** — 서버 enum 이
   * *"정작 사용자가 할 일(장소 담기)은 화면 어디에도 드러나지 않는다"* 고 적어 둔 자리다.
   */
  briefingWalkNoPlaceItemAction: '이 날에 장소 담기',
  /** 같은 사유에 특보 카드도 같은 버튼을 낸다 — 접근 이름으로 대상을 가른다 */
  briefingWalkRetryLabel: '산책 골든타임 다시 시도',
  briefingWarningRetryLabel: '기상특보 다시 시도',
  briefingCurveErrorTitle: '시간대별 예보를 불러오지 못했어요',
  /** `{title}` 치환. **"현재 위치 기준" 이라고 쓰지 않는다** — 그날 대표 장소 좌표 기준이다 */
  briefingWalkBasis: '{title} 기준 · 노면(아스팔트) 온도는 추정치예요',
  briefingWalkBasisNoPlace: '노면(아스팔트) 온도는 추정치예요',

  /**
   * 전날 갈래에서 **카드 둘을 대신하는 각주 한 줄** (#733).
   *
   * 예전에는 특보·골든타임 카드가 정상 크기로 서서 안내 한 줄씩만 담았다 — 화면 아래
   * 절반이 값 없는 카드였다.
   *
   * **`확인하지 못했어요`(실패)가 아니라 `열려요`(대기)다.** 실제 상태는 장애가 아니라
   * "아직 때가 아님" 이고, 실패 톤으로 말하면 사용자가 고칠 수 없는 것을 고치려 든다.
   * 굵기도 본문(400)이다 — 제목 굵기(600)에 보조 텍스트 색을 얹으면 위계가 어긋난다.
   */
  briefingEveFootnote: '기상특보와 산책 골든타임은 내일 아침에 열려요.',
} as const

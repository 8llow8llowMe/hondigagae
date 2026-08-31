/**
 * 여행 일정 목록 · 직접 만들기 화면 문구.
 *
 * 정본은 아트보드 `혼디가개 여행 일정.dc.html` 04 · 05 · 06 절이다.
 * 어미는 해요체로 통일한다 (DESIGN.md §1). 예외는 `// PLAN_NNN` 주석이 달린 줄 —
 * 백엔드 `PlanValidationMessage` 복제본이라 톤을 바꾸면 같은 폼에서 클라이언트 검증과
 * 서버 검증의 말투가 갈린다.
 */
export const planMessages = {
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

  sectionUpcoming: '다가오는 일정',
  sectionPast: '지난 일정',
  loadMore: '더 보기',

  /** `{days}` 치환. 0 이면 `ddayToday` 를 쓴다 */
  dday: 'D-{days}',
  ddayToday: 'D-DAY',

  // ── 만들기 ─────────────────────────────────────────────────────────────

  createAction: '새 일정 만들기',
  /** 모바일 헤더의 아이콘 버튼 — 라벨이 보이지 않아 `aria-label` 로 준다 */
  createActionLabel: '새 일정 만들기',
  createTitle: '일정 만들기',
  createDescription: '빈 일정을 만들고 장소는 나중에 담아요.',
  createSubmit: '만들기',
  createCancel: '취소',

  fieldPet: '누구와 가나요',
  fieldTitle: '일정 이름',
  fieldTitlePlaceholder: '예: 몽실이와 제주 2박 3일',
  fieldStartDate: '시작일',
  fieldEndDate: '종료일',
  fieldBudget: '예산 (선택)',
  fieldBudgetHint: '원 단위로 적어요. 나중에 바꿀 수 있어요.',

  // 아래 넷은 백엔드 PlanValidationMessage / PlanErrorCode 복제본이다.
  // 대응 코드 주석은 **바로 윗줄**에 둔다 — message-tone.test.ts 가 그 위치를 본다
  // PLAN_103
  errorTitleRequired: '일정 제목은 필수입니다.',
  // PLAN_104
  errorTitleTooLong: '일정 제목은 60자 이하만 가능합니다.',
  // PLAN_107
  errorBudgetNegative: '예산은 0 이상이어야 합니다.',
  // PLAN_003
  errorDateRange: '여행 시작일은 종료일보다 늦을 수 없습니다.',

  errorPetRequired: '반려견을 골라 주세요.',
  errorStartDateRequired: '시작일을 골라 주세요.',
  errorEndDateRequired: '종료일을 골라 주세요.',

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
  /** 반려견 특성 조회에 실패해 일반 조건으로 판정한 경우 */
  verdictPetConditionMissing: '반려견 특성을 반영하지 못해 일반 조건으로 판정했어요.',
  /** `{source}` 치환 — 서버가 준 `forecastSourceName` */
  verdictMidTermSource: '{source} 기준이라 대략적인 값이에요.',
  /** 최고기온 */
  verdictTemperatureLabel: '최고기온',
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
  /** 30km 이상 구간에 덧붙는다 */
  longTripSuffix: ' — 하루 이동이 깁니다.',

  statusConfirmAction: '일정 확정하기',
  statusConfirmError: '확정하지 못했어요. 잠시 후 다시 시도해 주세요.',

  manageLabel: '일정 관리',
  editAction: '이름·예산 수정',
  editTitle: '일정 수정',
  editSubmit: '저장',
  editCancel: '취소',
  /** 예산을 비우는 방법이 서버에 없다 — 0 을 보낸다 (D4). 그 사실을 문구로 알린다 */
  editBudgetHint: '예산을 지우면 0원으로 저장돼요.',
  editError: '수정하지 못했어요. 잠시 후 다시 시도해 주세요.',

  deleteAction: '일정 삭제',
  dangerZoneTitle: '위험 영역',
  /** `{title}` 치환 */
  deleteConfirmTitle: '{title} 일정을 삭제할까요?',
  deleteConfirmDescription: '담은 장소와 일자별 판정이 함께 사라져요. 되돌릴 수 없어요.',
  deleteError: '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
} as const

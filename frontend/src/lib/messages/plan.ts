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
} as const

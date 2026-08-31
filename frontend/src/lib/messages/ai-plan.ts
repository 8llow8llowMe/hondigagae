/**
 * AI 일정 생성 화면 문구.
 *
 * 정본은 아트보드 `혼디가개 AI 일정 생성.dc.html` 01 · 02 · 03 · 04 와 명세 S7 이다.
 * 어미는 해요체로 통일한다 (DESIGN.md §1). 예외는 `// AIPLAN_NNN` 주석이 달린 줄 —
 * 백엔드 `AiPlanValidationMessage` 복제본이다.
 *
 * **서버가 내려주는 문구는 여기에 없다.** 진행 안내(`status.description`), 실패 사유
 * (`errorMessage`), 추천 근거(`reasons[].description`)는 그대로 렌더한다 (명세 S2 · S7).
 */
export const aiPlanMessages = {
  // ── 조건 입력 (아트보드 01) ─────────────────────────────────────────────

  createTitle: 'AI 일정 만들기',
  createHeading: '어떤 여행을 원하세요?',
  createDescription: '자유롭게 적어도 되고, 아래 3가지만 채워도 만들 수 있어요.',

  fieldNote: '하고 싶은 여행 (선택)',
  fieldNotePlaceholder: '사람 많은 곳은 피하고, 오전엔 바다 산책 하고 오후엔 실내로 쉬고 싶어요.',
  /** 아트보드 01 의 곱은 인용부호를 쓴다 — `"` 는 HTML 에서 이스케이프돼 읽기 나빠진다 */
  fieldNoteHint: '예) “차 없이 다닐 수 있게”, “숙소는 서귀포 근처”',

  requiredGroupLabel: '필수 항목',

  fieldStartDate: '여행 시작일',
  fieldEndDate: '여행 종료일',
  /** `{days}` 치환. 기간을 다 고른 뒤에만 붙는다 */
  periodSummary: '{days}일 일정이에요.',

  fieldPet: '함께 갈 반려견',
  fieldPetHint: '반려견의 크기·민감도가 장소 선택과 하루 이동량에 반영돼요.',

  fieldBudget: '예산 (선택)',
  fieldBudgetUnit: '만원',
  fieldBudgetHint: '어림값이면 충분해요. 비워 두면 예산을 따지지 않아요.',
  budgetPresetLabel: '예산 고르기',
  budgetAny: '상관없음',

  createSubmit: '일정 만들기',
  /** 버튼 아래 — 소요 시간과 저장 시점을 미리 말한다 (아트보드 01 주석) */
  createSubmitHint: '만드는 데 20초쯤 걸려요. 결과는 초안으로 저장돼요.',

  /**
   * 지역 컨트롤을 두지 않는 이유를 화면에도 한 줄로 말한다 — 아트보드에는 제주시 /
   * 서귀포시 칩이 있어 없는 것이 누락처럼 보인다.
   */
  areaFixed: '제주 전체에서 찾아요.',

  // ── 조건 입력 오류 ──────────────────────────────────────────────────────

  // AIPLAN_105
  errorPetRequired: '반려견 식별자는 양수여야 합니다.',
  // AIPLAN_102
  errorStartDateRequired: '여행 시작일은 필수입니다.',
  // AIPLAN_103
  errorEndDateRequired: '여행 종료일은 필수입니다.',
  // AIPLAN_001
  errorDateRange: '여행 시작일은 종료일보다 늦을 수 없습니다.',
  // AIPLAN_106
  errorBudgetPositive: '예산은 0보다 커야 합니다.',
  // AIPLAN_107
  errorNoteTooLong: '요청 메모는 500자 이하만 가능합니다.',

  // ── 반려견 0마리 ────────────────────────────────────────────────────────

  noPetTitle: '먼저 반려견을 등록해 주세요',
  noPetDescription: '반려견의 크기와 민감도를 알아야 갈 수 있는 곳을 골라 줄 수 있어요.',
  noPetAction: '반려견 등록하기',

  // ── 생성 대기 (아트보드 02 ①) ──────────────────────────────────────────

  jobTitle: 'AI 일정 만들기',
  jobProgressTitle: '일정 만드는 중',
  /**
   * 진행 표시의 본문은 **서버 `status.description` 을 그대로 쓴다.** 이 문구는 서버가
   * 설명을 주지 않을 때만 쓰는 대체 문구다 — **단계 목록을 만들지 않는다** (명세 S2).
   */
  jobProgressFallback: '조건에 맞는 장소를 찾고 일자별로 배치하고 있어요.',
  jobLeaveHint: '이 화면을 벗어나도 만들기는 계속돼요. 주소를 남겨 두면 다시 볼 수 있어요.',

  jobSlowNotice: '아직 만들고 있어요. 조금만 더 기다려 주세요.',
  jobExceededTitle: '시간이 오래 걸리고 있어요.',
  jobExceededDescription: '만들기가 끝났는지 지금 확인해 볼 수 있어요.',
  jobExceededAction: '다시 확인하기',

  // ── 작업 실패 (아트보드 02 ②) ──────────────────────────────────────────

  /**
   * **`ErrorState` 를 쓰지 않고 "일시 장애" 문구도 쓰지 않는다.** HTTP 200 이고 실패
   * 이유가 조건 문제일 수 있다 (`AIPLAN_012` — 조건에 맞는 장소를 찾지 못했습니다).
   */
  failedTitle: '일정을 만들지 못했어요',
  failedFallback: '조건을 조금 바꾸면 만들 수 있어요.',
  failedRetry: '같은 조건으로 다시 시도',
  failedChange: '조건 바꾸기',
  failedManual: '직접 만들기',
  /** `{summary}` 치환 — 입력 조건을 그대로 남긴다 */
  failedKeptCondition: '입력한 조건({summary})은 그대로 남아 있어요.',

  // ── 작업을 찾을 수 없음 (AIPLAN_002) ───────────────────────────────────

  jobNotFoundTitle: '찾을 수 없는 작업이에요',
  jobNotFoundDescription: '주소가 잘못되었거나 다른 계정에서 만든 작업이에요.',
  jobNotFoundAction: '새로 만들기',

  // ── 조회 실패 ───────────────────────────────────────────────────────────

  jobErrorTitle: '만들기 상태를 불러오지 못했어요',
  jobErrorDescription: '잠시 후 다시 시도해 주세요.',

  // ── 미리보기 (아트보드 03) ─────────────────────────────────────────────

  previewTitle: '미리보기',
  draftBadge: 'AI 초안',
  /**
   * 요약줄은 **조각을 조립한다.** 한 문장에 `{range}` 를 박아 두면 조건을 잃어 기간을
   * 모를 때 `· 제주 · 항목 8개` 처럼 빈 구분자가 남는다 (375 실렌더에서 잡았다).
   */
  previewArea: '제주',
  /** `{count}` 치환 */
  previewItemCount: '항목 {count}개',
  /** `{budget}` 치환 */
  previewBudget: '예산 {budget} 내',
  previewNotSaved: '아직 저장되지 않았어요',

  reasonsTitle: '이렇게 짰어요',
  /** `%d` 가 남은 개수로 치환된다 — `ReasonList` 규약 */
  reasonsMore: '근거 %d개 더 보기',
  reasonsLess: '근거 접기',

  /** `{day}` 치환 */
  dayLabel: '{day}일차',

  itemPlaceDelisted: '더 이상 조회되지 않는 장소예요',
  /** `title` 이 비어 온 항목. **행을 지우지 않는다** — 담기에서 걸러질 뿐이다 */
  itemTitleUnknown: '이름이 없는 항목',

  /**
   * **`days` 가 여행 일수보다 적어도 감추지 않는다** (명세 S6).
   * `{total}` · `{made}` 치환.
   */
  partialDays: '{total}일 중 {made}일만 만들었어요.',
  partialDaysDescription: '나머지 날은 담은 뒤에 일정 화면에서 채울 수 있어요.',

  emptyDraftTitle: '만들어진 일정이 없어요',
  emptyDraftDescription: '조건을 조금 바꿔 다시 만들어 보세요.',

  // ── 담기 (아트보드 03 하단 바) ─────────────────────────────────────────

  commitFieldTitle: '일정 제목',
  commitSubmit: '내 일정에 담기',
  commitAgain: '전체 다시 만들기',
  commitDiscard: '버리기',
  commitHint: '담으면 초안으로 저장돼요. 저장한 뒤에 순서와 항목을 고칠 수 있어요.',

  discardConfirmTitle: '초안을 버릴까요?',
  discardConfirmDescription: '담지 않은 초안은 다시 볼 수 없어요.',
  discardConfirm: '버리기',

  // AIPLAN_100 대응은 아니지만 같은 이유로 서버 제약 복제본이다
  // PLAN_103
  errorTitleRequired: '일정 제목은 필수입니다.',
  // PLAN_104
  errorTitleTooLong: '일정 제목은 60자 이하만 가능합니다.',

  /** 조건을 잃어 담을 수 없는 상태 — 명세 S5 함정 1 */
  conditionLostTitle: '조건을 다시 알려 주세요',
  conditionLostDescription:
    '이 초안을 담으려면 반려견과 기간이 필요한데, 만들 때 쓴 조건이 이 브라우저에 남아 있지 않아요.',
  conditionLostAction: '조건 다시 입력하기',

  /** 담기 실패 `PLAN_004` — 항목을 지목하고 빼고 담게 한다 (명세 S5 함정 3) */
  commitDelistedTitle: '일부 장소를 더 이상 담을 수 없어요.',
  commitDelistedDescription:
    '아래 표시한 곳이 원천에서 사라졌어요. 그 항목을 빼면 나머지는 담을 수 있어요.',
  /** 어느 항목이 문제인지 짚을 수 없을 때 — 없는 근거로 "빼면 된다" 고 말하지 않는다 */
  commitDelistedUnknown:
    '어느 곳인지는 찾지 못했어요. 조건을 조금 바꿔 다시 만들거나 직접 만들어 주세요.',
  commitDelistedAction: '표시한 곳을 빼고 담기',
  /** `{count}` 치환 */
  commitExcludedNotice: '{count}개 항목을 빼고 담아요.',
  commitExcludedReset: '다시 포함하기',
} as const

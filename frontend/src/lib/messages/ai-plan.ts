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
  /** 달력을 눌러 고르는 자리라 서식(`YYYY-MM-DD`)이 아니라 **행동**을 적는다 */
  datePlaceholder: '날짜 선택',
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
   * 지역 좁히기 (#251 · 아트보드 01). 계약에 `sigunguCode` 가 없던 동안에는
   * "제주 전체에서 찾아요." 한 줄로 대신하고 있었다.
   *
   * **선택지 이름은 장소 찾기와 같은 표(`SIGUNGU_LABEL`)에서 가져온다** — 같은 코드에
   * 두 이름이 생기면 화면마다 다른 말을 하게 된다.
   */
  fieldRegion: '지역',
  /** `sigunguCode === null`. **"선택 안 함" 이 아니라 "전체" 다** */
  fieldRegionAll: '제주 전체',
  fieldRegionHint:
    '좁히면 그 시군구 안에서만 골라요. 조건에 맞는 곳이 없으면 만들지 못할 수 있어요.',

  /*
    ── 생성 옵션 확장 (#128) — 아트보드 `혼디가개 AI 일정 생성` 05 ──

    **"먼저" 와 "꼭" 을 섞지 않는다.** `preferFavorites` 는 우선순위(조건이 맞을 때만)이고
    `pinnedPlaceIds` 는 배치 보장이다. 아트보드가 두 문구를 갈라 쓰라고 못박았다 —
    지키지 못할 약속을 하면 결과를 못 믿게 된다.
  */

  optionGroupLabel: '더 좋은 결과를 위해 (선택)',

  /** 저장한 곳 먼저 — **"먼저" 쪽이다. "반드시" 라고 쓰지 않는다** */
  preferFavoritesLabel: '저장한 곳 먼저 넣기',
  /** `{count}` 는 저장한 장소 개수. 개수를 말해야 무엇이 후보에 들어가는지 안다 */
  preferFavoritesHint: '저장한 {count}곳을 후보에 합치고, 조건이 맞으면 먼저 배치해요',
  preferFavoritesLink: '저장한 장소 보기',
  /**
   * 저장 0곳. **숨기지 않고 비활성 + 이유 + 해결 방법이다** (아트보드 05).
   * 숨기면 이 옵션의 존재를 알 방법이 없어진다.
   */
  preferFavoritesEmpty: '저장한 곳이 아직 없어요. 장소를 저장하면 여기서 먼저 넣을 수 있어요.',
  preferFavoritesEmptyAction: '장소 찾아보기',

  /** 꼭 넣을 장소 — **"꼭" 쪽이다. 배치 보장** */
  pinnedLabel: '꼭 넣을 장소 (선택)',
  pinnedCount: '{count} / {max}',
  pinnedHint: '고른 곳은 반드시 일정에 들어가요. 날짜와 순서는 AI가 정해요.',
  pinnedAdd: '+ 장소 고르기',
  /** 칩의 제거 버튼 이름. 칩만으로는 어느 장소를 빼는지 스크린리더가 모른다 */
  pinnedRemoveLabel: '{title} 빼기',

  /** 피커 시트 — 같은 시트를 밀어 넣는 단계 전개다 (오버레이를 겹치지 않는다) */
  pickerTitle: '꼭 넣을 장소',
  pickerFavoritesTab: '저장한 장소',
  /** `{count}` 곳 담기. **라벨에 결과를 쓴다** (`BottomSheet` footer 규약) */
  pickerConfirm: '{count}곳 담기',
  pickerConfirmEmpty: '고른 곳 없이 닫기',
  /** 요약을 못 받은 행 — 이름·좌표가 없어 후보로 넘길 수 없다 */
  pickerUnpinnable: '요약이 없어 후보로 넘길 수 없어요',
  pickerEmptyTitle: '저장한 장소가 없어요',
  pickerEmptyDescription: '장소 상세에서 저장해 두면 여기서 골라 넣을 수 있어요.',
  pickerLoadFailedTitle: '저장한 장소를 불러오지 못했어요',
  /**
   * **검색 탭을 만들지 않았다.** 아트보드 05 는 `저장한 장소` / `검색` 두 탭을 그렸지만
   * `GET /places` 에 이름 검색 파라미터가 없다 — 지역·타입·동반 조건 필터뿐이다.
   * 아트보드도 "고르는 곳은 저장한 장소가 기본, 검색 탭은 두 번째" 라고 적었다.
   * BE 에 검색 API 를 요청해 뒀다 (명세 S8).
   */
  pickerSearchUnavailable: '이름으로 찾기는 준비 중이에요. 지금은 저장한 장소에서 고를 수 있어요.',

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
  /** 시트가 상한을 이미 막는다. 이 문구는 2차 방어가 걸렸을 때만 나온다 */
  errorPinnedTooMany: '꼭 넣을 장소는 {max}곳까지예요.',
  /** 반려견 상한(5) 2차 방어. 화면이 만들 수 없는 상태라 실제로는 닿지 않는다 */
  errorPetTooMany: '반려견은 최대 5마리까지 고를 수 있어요.',
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
   * 진행 표시의 본문은 **서버 문구를 그대로 쓴다** — 세부 단계가 있으면 `step.description`,
   * 없으면 `status.description` 이다. 이 문구는 서버가 둘 다 주지 않을 때만 쓰는 대체
   * 문구다 — **단계 이름을 화면이 지어내지 않는다** (명세 S2 · #250).
   */
  jobProgressFallback: '조건에 맞는 장소를 찾고 일자별로 배치하고 있어요.',
  /**
   * `{order}` · `{total}` 치환 (#250). **숫자는 서버가 준 것만 쓴다** — `total` 을 상수로
   * 적어 두면 백엔드가 단계를 늘릴 때 `5 / 4 단계` 가 나간다.
   */
  jobStepProgress: '{order} / {total}단계',
  jobLeaveHint: '이 화면을 벗어나도 만들기는 계속돼요. 주소를 남겨 두면 다시 볼 수 있어요.',

  // ── 작업 취소 (#250) ────────────────────────────────────────────────────

  /**
   * **"취소" 가 아니라 "그만두기" 다.** 예약 취소처럼 되돌리는 일이 아니라 진행 중인
   * 만들기를 멈추는 일이고, 화면의 다른 파괴 동작(`버리기`)과 결이 같다.
   *
   * **확인 모달을 두지 않는다.** 잘못 눌러도 잃는 것이 20초이고 조건이 그대로 남아
   * 바로 다시 만들 수 있다 — 되돌릴 수 없는 `버리기`(초안 폐기)와 다르다.
   */
  jobCancel: '그만두기',
  /**
   * 즉시 멈추지 못한다는 것을 **누르기 전에** 말한다. 협조적 취소라 이미 AI 호출에
   * 들어갔으면 그 호출이 끝날 때까지 몇 초 더 걸린다 — 안 적으면 버튼이 고장 난 것처럼
   * 보인다.
   */
  jobCancelHint: '이미 시작한 작업은 끝나는 데까지 몇 초 걸릴 수 있어요.',
  /** 취소 요청 자체가 실패했을 때. 작업은 계속 돌고 있으므로 진행 화면을 유지한다 */
  jobCancelFailed: '지금은 그만두지 못했어요. 잠시 후 다시 눌러 주세요.',

  canceledTitle: '만들기를 그만뒀어요',
  canceledDescription: '만들던 일정은 저장되지 않았어요. 같은 조건으로 다시 만들 수 있어요.',
  canceledRetry: '같은 조건으로 다시 만들기',
  canceledChange: '조건 바꾸기',

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
  /**
   * 지역을 좁힌 채 `AIPLAN_012`(조건에 맞는 장소를 찾지 못함)로 실패했을 때 (#251).
   * `{region}` 치환.
   *
   * **서버 문구를 대신하지 않고 아래에 덧붙인다.** 서버는 "장소를 찾지 못했다" 까지만
   * 말할 수 있고, **좁힌 지역이 원인일 수 있다는 것은 화면만 안다** — 서버는 요청에
   * `sigunguCode` 가 있었다는 사실을 응답에 싣지 않는다.
   */
  failedNarrowedRegion: '{region}(으)로 좁혀서 찾지 못했을 수 있어요. 지역을 넓혀 보세요.',

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

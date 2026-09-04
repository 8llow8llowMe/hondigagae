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
  packingCta: '준비물 목록 만들기',
  packingRetryCta: '다시 만들기',
  /**
   * **대기 문구가 시간을 먼저 말한다.** 동기 API 라 수십 초가 걸릴 수 있고(컨트롤러 설명),
   * 아무 안내 없이 기다리게 하면 사용자는 고장으로 읽는다.
   */
  packingPending: '준비물을 고르는 중이에요',
  packingPendingNote: '수십 초 걸릴 수 있어요. 화면을 닫지 마세요.',
  /** 결과를 서버가 보관하지 않는다 — 저장된 것으로 오해하면 나중에 다시 열어 보려다 잃는다 */
  packingNotSaved: '저장되지 않는 제안이에요. 화면을 벗어나면 사라져요.',
  /*
    `packingSinglePetNote`('대표 반려견 기준이에요')를 여기 뒀었다. #179 로 `AiPackingProcessor`
    가 동행 반려견 전체를 벌크 조회하게 되면서 거짓이 됐다.

    **"모든 아이 기준이에요" 로 바꾸지 않았다.** 특성 조회가 일부만 성공하면 백엔드는 그
    아이를 빼고 WARN 만 남기는데, `PackingListResponse` 에는 그 사실을 알려 주는 필드가
    없다 — 화면은 몇 마리가 근거에 들어갔는지 모른다. 이 저장소는 근거를 모를 때 아는
    척하지 않는 쪽으로 결정해 왔다(`weatherApplied`·`score: null`·`basisPetId`). 대신
    어느 아이 때문에 필요한 물건인지는 서버가 이유 문장에 `[반려견 2]` 꼴로 밝힌다.
  */
  packingIntro: '일정과 여행 기간 예보, 반려견 특성을 근거로 만들어요.',
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

  /**
   * 만들기 방식 시트 — 아트보드 04. **AI 화면(#84)이 생겨 항목이 둘이 됐다.**
   * 그 전에는 선택지가 하나뿐이라 시트를 두지 않았다 (공통명세 S2).
   */
  createSheetTitle: '어떻게 만들까요?',
  createSheetAi: 'AI로 만들기',
  createSheetAiDescription: '조건만 알려 주면 일자별 일정을 짜 드려요. 20초쯤 걸려요.',
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
  /**
   * `{distance}` 치환. 실내 대안 행 — **그날 기준 장소로부터**의 거리다.
   * 서버가 하버사인으로 재 주므로 화면이 계산하지 않지만, `직선` 은 똑같이 붙인다.
   */
  distanceStraight: '직선 {distance}',
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

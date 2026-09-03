/**
 * 홈 화면 문구 — 공통명세 S4-4 가 정본이다.
 *
 * 어미는 **해요체로 통일한다.** 서버가 내려주는 근거 문장(`description`)은 합니다체라
 * 섞이지만, **출처를 바꾸지 않는다** — 서버 문구를 FE 가 다시 쓰지 않는다
 * (docs/styling-guide.md §7).
 */
export const homeMessages = {
  walkTodayLabel: '오늘 산책',
  heatIndexLabel: '체감 열지수',
  pavementLabel: '추정 노면 온도',
  saferWindowLabel: '더 안전한 시간대',
  basisSuffix: '기준',
  reasonsLink: '판정 근거 보기',

  // ── 오늘의 산책 골든타임 (#158) ────────────────────────────────────────────
  goldenHeading: '오늘 산책하기 좋은 시간',
  /** 좌표 축이라 기준을 밝힌다 — 현재 위치가 아니다 */
  goldenBasis: '제주시 기준',
  /**
   * 추천 구간이 없는 날. **"그나마 이때가 낫다" 를 쓰지 않는다** — 서버가 일부러 구간을
   * 주지 않는 날이고, 대안을 지어내면 사용자가 그것을 허락으로 읽는다 (`GoldenWalkWindow`).
   */
  goldenNone: '오늘은 나가지 않는 편이 좋아요',
  goldenNoneDesc: '남은 시간이 모두 위험 등급이에요. 실내에서 보내는 편이 안전해요.',
  goldenPavementNote: '노면 온도는 추정치예요',
  /** 시간대 곡선을 못 받은 경우 (늦은 밤이면 남은 예보가 없다) */
  goldenCurveEmpty: '오늘 남은 예보가 없어요',

  // ── 제주 권역 날씨 비교 (#158) ─────────────────────────────────────────────
  regionHeading: '오늘 나가기 좋은 권역',
  /** `{name}` 을 권역 이름으로 치환한다 */
  regionRecommended: '오늘은 {name}이 가장 나아요',
  /**
   * 추천이 없는 날. **"그나마 여기" 를 쓰지 않는다** — 특보 경보이거나 어느 권역도 예보를
   * 못 받은 날이고, 적합도 0점·산책 위험이라고 말하는 같은 서비스가 여기서만 나가라고 하면 안 된다.
   */
  regionNone: '오늘은 추천할 권역이 없어요',
  /**
   * **이 점수는 장소 적합도가 아니다.** 같은 날씨 규칙을 쓰지만 장소·혼잡도 항목이 없어
   * "이 권역이 나가기 좋은가" 이지 "이 장소가 갈 만한가" 가 아니다.
   */
  regionScoreNote: '날씨만 본 점수예요',
  /** 예보를 못 받은 권역. **0점이 아니다** */
  regionScoreUnavailable: '예보 없음',
  /** `{name}` 을 반려견 이름으로 치환한다 */
  suitabilityHeading: '오늘 {name}에게 맞는 곳',
  suitabilityFallback: '오늘 갈 만한 곳',
  /** "적합도 순" 이라고 쓰지 않는다 — 상위 3개만 조회하므로 전체 정렬이 아니다 (D8-1) */
  sortNote: '오늘 날씨와 혼잡도 반영',
  moreReasons: '근거 {n}개 더 보기',
  lessReasons: '근거 접기',
  emptyPlacesTitle: '표시할 장소가 없어요',
  emptyPlacesDesc: '장소를 찾아보세요.',
  findPlaces: '장소 찾기',
  upcomingHeading: '다가오는 일정',
  noPlanTitle: '아직 일정이 없어요',
  noPlanDesc: '반려견에게 맞는 일정을 만들어보세요.',
  emergencyTitle: '주변 동물병원 찾기',
  /**
   * **"3곳뿐" 은 하드코딩이다** (공통명세 S5-3). 백엔드가 이 수를 주지 않는다.
   * 데이터가 바뀌면 문구가 거짓이 된다는 것을 알고 둔다 — 긴급 시설 화면(#13)은 실제 값을 쓴다.
   */
  emergencyDesc: '제주 24시간 병원은 3곳뿐이에요',
  congestionUnknown: '혼잡도 정보 없음',
  /** 점수를 내지 못한 경우. **0점이 아니다** */
  scoreUnavailable: '판단 근거 부족',
  indoorHeading: '비 올 때 갈 만한 실내',
  /** 미로그인 안내 */
  guestVerdictNotice: '반려견을 등록하면 우리 아이 기준으로 판정해요',
  registerPet: '반려견 등록',
  /**
   * 프로필 태그는 짧은 표기를 쓴다 — 아트보드 `01 홈 · P1`.
   * `messages.pet.labels` 의 "더위에 민감해요" 는 문장형이라 태그로는 길다.
   */
  traitHeat: '더위 민감',
  traitCold: '추위 민감',
  traitNoise: '소리 민감',
  traitWalk: '산책 선호',
  /** 미로그인 · 반려견 0마리일 때 프로필 자리 (아트보드 04-②) */
  guestProfileTitle: '반려견을 등록해 주세요',
  guestProfileDesc: '크기·민감도까지 반영한 판정을 볼 수 있어요.',
  /** 섹션 푸터 */
  morePlaces: '맞는 곳 {n}곳 더 보기',
  allPlaces: '맞는 곳 {n}곳 전체 보기 ›',
  allPlans: '일정 전체 보기 ›',
  /** 메타 줄 · 태그의 실내/야외 표기 */
  indoor: '실내',
  outdoor: '야외',
  /** 모바일 섹션 헤더는 폭이 좁아 짧게 쓴다 */
  sortNoteShort: '날씨·혼잡도 반영',
  verdictErrorTitle: '오늘 판정을 불러오지 못했어요.',
} as const

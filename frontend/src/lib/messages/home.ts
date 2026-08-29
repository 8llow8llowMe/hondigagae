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
  /** `{name}` 을 반려견 이름으로 치환한다 */
  suitabilityHeading: '오늘 {name}에게 맞는 곳',
  suitabilityFallback: '오늘 갈 만한 곳',
  /** "적합도 순" 이라고 쓰지 않는다 — 상위 3개만 조회하므로 전체 정렬이 아니다 (D8-1) */
  sortNote: '오늘 날씨와 혼잡도 반영',
  moreReasons: '근거 {n}개 더 보기',
  lessReasons: '근거 접기',
  emptyPlacesTitle: '표시할 장소가 없습니다',
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
} as const

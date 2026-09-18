/**
 * 제주올레 산책 코스 (#618).
 *
 * **서버가 내려주는 문구는 여기 없다** — `providerName` · `baseDate` · 404 `resultMessage`
 * 는 그대로 렌더한다 (`docs/api-integration-guide.md` §6). 활동량 이름(`낮음`·`보통`)도
 * 여기 없다: 코스 응답에 enum metadata 가 하나도 없어 `pet.activityLevel.name` 에서
 * 가져온다 (공통명세 S3 · S4-1 규칙 6).
 *
 * **제목에는 마침표를 찍지 않고 설명에는 찍는다** — `/places` · `/favorites` 와 같다.
 */
export const walkCourseMessages = {
  pageTitle: '산책 코스',
  pageDescription: '제주올레 코스를 거리와 걷는 시간으로 골라 봐요.',

  // ── 홈 진입점 (공통명세 S6-1) ─────────────────────────────────────────────
  /**
   * **전역 nav 에 넣지 않는다.** nav 셋(장소 찾기·여행 일정·AI 일정 생성)은 *할 일* 축이고
   * 항목을 늘리지 않기로 이미 정해져 있다 (`nav-links.tsx`). `Banner` 는 §0 이 인정한
   * 상시 진입점이다.
   */
  bannerTitle: '제주올레 걸어 보기',
  /** **개수를 적지 않는다.** 코스 수는 서버가 세고 적재(#383)로 바뀐다 */
  bannerDescription: '거리와 걷는 시간으로 걸을 만한 코스를 골라 봐요',

  // ── 목록 ──────────────────────────────────────────────────────────────────
  /** `{count}` 치환. `aria-live` 로 알리는 줄이기도 하다 (D6) */
  listCount: '코스 {count}개',
  activityGroupLabel: '걷는 시간',
  /**
   * **세그먼트 위에 얹는 보이는 캡션이다** (#734) — `activityGroupLabel` 과는 다른 자리다.
   * 라디오그룹의 접근 이름은 옵션이 실제로 말하는 값(걷는 시간 상한)을 그대로 두고,
   * 이 라벨은 그 축이 반려견의 **활동량**에서 온다는 것을 사람 눈에만 보탠다. 두 문구가
   * 같은 뜻을 두 번 말하므로 이 캡션은 `aria-hidden` 이다.
   */
  activityFieldLabel: '활동량',
  activityAll: '전체',
  /** `{hours}` 치환 — 숫자는 `lib/walk-course/activity.ts` 가 갖는다 (D5-2) */
  activityWithin: '{hours}시간 이내',
  sortGroupLabel: '정렬',
  sortCourseNo: '코스 순',
  sortDistanceAsc: '짧은 순',
  /** 1280 이상 열 머리의 코스 열 라벨 (#734). 거리·소요시간·시종점은 상세와 같은 라벨(아래)을 그대로 쓴다 */
  columnCourseLabel: '코스',

  /**
   * 기준 줄. **`petActivityLevelApplied` 가 참일 때만 그린다** — 로컬 상태가 아니라
   * 응답을 믿는다 (공통명세 S4-1 규칙 5).
   *
   * `{pet}` · `{level}` · `{hours}` 치환. `{level}` 은 **서버 enum metadata 의 `name`** 이다.
   */
  activityBasis: '{pet} 활동량({level}) 기준으로 {hours}시간 이내 코스만 보여 줘요.',
  /** 반려견 이름을 모를 때(대표견 조회 실패 뒤 URL 로 들어온 경우)의 기준 줄 */
  activityBasisWithoutPet: '{hours}시간 이내 코스만 보여 줘요.',

  emptyTitle: '조건에 맞는 코스가 없어요',
  emptyDescription: '걷는 시간을 넓혀 보세요.',
  emptyAction: '전체 코스 보기',

  errorTitle: '코스를 불러오지 못했어요',

  /**
   * **`LOW` 를 고르면 좌표 있는 코스가 0개가 된다** (D8-2 ②). 4개 모두 `4~5시간`·`5~6시간`
   * 이라 4시간 상한에서 전부 걸러진다 — 결함이 아니라 데이터 분포이고, 적재(#383) 후
   * 저절로 해소된다. 그 사실을 말하지 않으면 사용자는 기능의 존재를 모른다.
   */
  noGoldenInScope: '이 조건에는 날씨를 볼 수 있는 코스가 아직 없어요.',

  // ── 상세 ──────────────────────────────────────────────────────────────────
  distanceLabel: '거리',
  durationLabel: '소요시간',
  startEndLabel: '시종점',
  backToList: '코스 목록으로',
  /** `{provider}` · `{date}` 치환 — **둘 다 서버 값이다** */
  source: '{provider} · {date} 기준',

  /** 404 에서 서버 `resultMessage` 가 비었을 때만 쓰는 대체 문구 */
  detailNotFoundTitle: '없는 코스예요',

  /**
   * 좌표가 없는 코스 — **안내 상자의 첫 줄**([#730](https://github.com/8llow8llowMe/hondigagae/issues/730)).
   *
   * **"아직" 이라고 말한다** — 데이터가 채워지면 생기는 값이라, "정보가 없어요" 는
   * 영구적 결핍처럼 들린다.
   *
   * D5-2 는 이 문장 **하나만** 남기고 섹션을 걷으라고 적었는데, 그 갈래가 25/29 라
   * 화면의 기본형이 절반 빈 화면이 됐다 (#730 실측: 390 에서 문서 높이의 53%).
   * 지금은 섹션과 제목을 유지하고 이 문장이 상자의 첫 줄이 된다.
   */
  noCoordinates: '이 코스는 시작점 좌표가 아직 없어서 오늘 걷기 좋은 시간을 알려 드리지 못해요.',
  /**
   * ② 얼마나 흔한 일인지 (#730).
   *
   * **개수를 적지 않는다** — 코스 수도 좌표를 가진 코스 수도 서버가 세고 적재(#383)로
   * 바뀐다 (`bannerDescription` 과 같은 규칙). 사용자가 알아야 하는 것은 숫자가 아니라
   * **자기가 뭘 잘못 누른 것이 아니라는 사실**이다.
   */
  noCoordinatesCommon:
    '아직 좌표가 들어오지 않은 코스가 대부분이에요. 좌표가 채워지면 이 자리에 시간대별 판정이 생겨요.',
  /** ③ 대안 두 개를 여는 줄. 목록의 접근 이름이기도 하다 */
  noCoordinatesAlternatives: '대신 이렇게 해 볼 수 있어요',
  /**
   * 대안 ① — 장소 찾기로 보낸다 (`/places`).
   *
   * **검색어를 미리 채우지 않는다.** `startEndPoint` 는 `제주민속촌주차장 입구-남원포구`
   * 처럼 공백과 하이픈이 섞인 원문이고 갈라 쓰지 않기로 이미 정했다 (D4-2). 서버
   * `keyword` 는 `title`·`addr1` 의 `%LIKE%` 라(`PlaceCustomRepositoryImpl`) 그 원문도,
   * 갈라 만든 토막도 대부분 0건으로 떨어진다 — **결과 없음으로 데려가는 대안은 대안이 아니다.**
   */
  noCoordinatesPlacesAction: '시·종점 근처 장소 보기',
  noCoordinatesPlacesDescription:
    '위 시종점 이름으로 장소를 찾으면 그곳의 오늘 판정을 볼 수 있어요.',
  /**
   * 대안 ② — **아래 CTA 를 가리킨다. 버튼을 하나 더 두지 않는다.**
   *
   * 같은 이름의 컨트롤이 한 화면에 둘이면 보조기기에서 목적지가 둘로 들린다
   * (`WalkCourseDetailSection` 의 `DetailShell` 주석과 같은 축).
   */
  noCoordinatesPlanAction: '일정에 담고 그날 판정 받기',
  /** `{action}` 치환 — 아래 버튼의 **보이는 글자**를 그대로 넣는다 */
  noCoordinatesPlanDescription: '아래 {action}로 담으면 날짜가 생겨 그날의 산책 위험도를 받아요.',
  /** 골든타임 카드 아래 캡션. 코스 전체가 아니라 시작점 기준이라는 사실이다 (D8-5) */
  goldenBasis: '코스 시작점 기준이에요.',
  /** `다시 시도` 만이면 무엇을 다시 하는지 모른다 (D6) */
  goldenRetry: '날씨 다시 불러오기',
} as const

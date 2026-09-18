/**
 * 제주올레 산책 코스 — `tour-service` `walkcourse` 컨텍스트 (#618).
 *
 * 근거: `WalkCourseItem` · `WalkCourseListResponse` · `WalkCourseDetailResponse`
 * (backend `origin/develop` `2b0b62a4`) + dev 게이트웨이 실호출(2026-09-18).
 * 계약 상세는 `docs/features/walk-course/공통명세.md` S3.
 *
 * **`docs/api/openapi/tour-service.json`(2026-09-14) 을 정본으로 쓰지 않았다.** 스키마로는
 * 필드의 **값 분포**를 알 수 없는데 이 화면의 분기가 그 분포에 걸려 있다 — 29개 중 25개가
 * 좌표 null 이다 (공통명세 S3-1).
 */

/**
 * 코스 한 줄. 목록과 상세가 같은 필드를 공유한다.
 *
 * 근거: `WalkCourseItem.java:16-44`.
 */
export type WalkCourseSummary = {
  /**
   * **문자열이다.** 백엔드 내부는 `long`(Snowflake)이고 presenter 가 `String.valueOf` 로
   * 내린다 (`WalkCoursePresenter.java:27,43`). `Number()` 를 거치면 정밀도를 잃는다 —
   * `placeId` · `petId` 와 같다.
   */
  walkCourseId: string
  /** `1코스` · `3코스 (A)` — **서버가 조립해 준다.** FE 가 `courseNo + '코스'` 를 만들지 않는다 */
  courseLabel: string
  /** 구간명. `시흥-광치기` */
  name: string
  /** km. JSON number 로 온다 (`15.1` · `19.0`) */
  distanceKm: number
  /** 소요시간 **원문**. `4~5시간` · `1~2시간`. **파싱하지 않는다** */
  durationText: string
  /** 시종점 **원문**. `제주민속촌주차장 입구-남원포구` 처럼 공백과 하이픈이 섞인다 */
  startEndPoint: string
  /**
   * 시작점 좌표. **null 일 수 있다** — 실측 29개 중 25개가 null 이다.
   *
   * 좌표가 있는 코스만 골든타임(`GET /insights/walk-times`)과 이어진다. 판정은
   * `lib/walk-course/coordinates.ts` 한 곳이 갖는다 (공통명세 S4-2).
   */
  lat: number | null
  lng: number | null
  /**
   * 대표 이미지. **null 일 수 있다** — 좌표가 있는 코스와 **정확히 같은 4개**만 갖는다.
   * 둘 다 TourAPI 매칭에서 오고 그 매칭이 4건만 성공했다 (적재 #383).
   */
  firstImage: string | null
}

/**
 * `GET /walk-courses` — `WalkCourseListResponse.java:10-23`.
 *
 * **커서가 없다.** 코스가 29개뿐이라 전량이 한 번에 온다 — `useInfiniteQuery` 가 아니다.
 */
export type WalkCourseList = {
  courses: WalkCourseSummary[]
  /** 조건에 맞는 코스 수 */
  totalCount: number
  /** 서버가 활동량 필터를 실제로 적용했는가. **화면이 스스로 판정하지 않는다** */
  petActivityLevelApplied: boolean
  /** 출처 표기. 상수가 아니라 서버가 내려주는 문자열이다 */
  providerName: string
}

/**
 * `GET /walk-courses/{walkCourseId}` — `WalkCourseDetailResponse.java:9-42`.
 *
 * `baseDate` 는 **문자열이다**(`2025-04-28`). `Date` 로 파싱하면 자정 UTC 로 읽혀 KST
 * 기준 하루 밀린다 (`코스상세-세부명세.md` D4-3).
 */
export type WalkCourseDetail = WalkCourseSummary & {
  baseDate: string
  providerName: string
}

/**
 * 서버에 실제로 보내는 활동량 값.
 *
 * **`HIGH` 가 없다.** 결과가 필터 없음과 같은데(실측 29/29) 보내면
 * `petActivityLevelApplied: true` 가 와서 화면이 **좁히지도 않은 것을 좁혔다고 말한다**
 * (공통명세 S4-1 규칙 3). 대표견이 `HIGH` 면 파라미터 없이 조회한다.
 */
export const WALK_COURSE_ACTIVITY_PARAMS = ['LOW', 'MEDIUM'] as const
export type WalkCourseActivityParam = (typeof WALK_COURSE_ACTIVITY_PARAMS)[number]

/**
 * URL 이 갖는 활동량 값.
 *
 * `null` 은 **"값이 없다"** 이고 그때만 대표견으로 채운다. `'ALL'` 은 **"자동 채움을 껐다"**
 * 는 명시 값이다 — 둘을 한 값으로 합치면 활동량 낮은 아이의 보호자가 필터를 끄는 순간
 * 다시 켜져 전체 코스를 볼 방법이 사라진다 (`코스목록-세부명세.md` D0).
 */
export type WalkCourseActivityChoice = WalkCourseActivityParam | 'ALL' | null

/**
 * 화면에 노출하는 정렬. **계약은 4종이지만 둘만 쓴다** (`코스목록-세부명세.md` D8-4).
 *
 * `DISTANCE_DESC`(긴 코스부터)는 반려견 동반 맥락에서 먼저 물을 일이 아니고,
 * `DURATION_ASC` 는 `DISTANCE_ASC` 와 결과가 거의 같아 축이 둘로 보이면 혼란이다.
 *
 * **파싱도 이 목록을 화이트리스트로 쓴다.** 범위가 넓으면 `?sort=DURATION_ASC` 가 통과해
 * 정렬 컨트롤에는 선택된 항목이 없는 화면이 된다 (`emergency-filters.ts` 의 반경과 같은 규칙).
 */
export const WALK_COURSE_SORTS = ['DISTANCE_ASC'] as const
export type WalkCourseSort = (typeof WALK_COURSE_SORTS)[number]

/** 이 화면이 URL 에 두는 것 전부. `null` 은 각 축의 기본값이다 */
export type WalkCourseFilters = {
  activity: WalkCourseActivityChoice
  /** `null` = 서버 기본값 `COURSE_NO`. **기본값은 URL 에 쓰지 않는다** */
  sort: WalkCourseSort | null
}

export const DEFAULT_WALK_COURSE_FILTERS: WalkCourseFilters = {
  activity: null,
  sort: null,
}

/**
 * 제주올레 산책 코스 — `tour-service` `walkcourse` 컨텍스트 (#618).
 *
 * 근거: `WalkCourseItem` · `AppliedPetActivityLevelItem` · `WalkCourseListResponse` ·
 * `WalkCourseDetailResponse` (backend `origin/develop` `12f9f069` — #718) + dev 게이트웨이
 * 실호출(2026-09-18). 계약 상세는 `docs/features/walk-course/공통명세.md` S3.
 *
 * **#718 이 상한·소요·적합도를 응답에 실었다.** 그 전까지 화면이 갖고 있던 상한 복제본
 * (`ACTIVITY_MAX_HOURS` — 4·6시간)은 #735 에서 걷었다. 상한 숫자는 이제 응답만 말한다.
 *
 * **`docs/api/openapi/tour-service.json`(2026-09-14) 을 정본으로 쓰지 않았다.** 스키마로는
 * 필드의 **값 분포**를 알 수 없는데 이 화면의 분기가 그 분포에 걸려 있다 — 29개 중 25개가
 * 좌표 null 이다 (공통명세 S3-1).
 */

import type { CodeNameMetadata } from '@/types/api'

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
  /**
   * 소요시간 상한(분). **`null` 은 "제한 없음" 이 아니라 "원문을 파싱하지 못했다" 는 뜻이다**
   * (`WalkCourseItem.java:34-36`). 그 코스는 어느 활동량에서도 걸러지지 않으므로, 이 값이
   * 없다고 해서 화면이 "아무 아이나 걸을 수 있다" 로 읽히게 그리지 않는다.
   *
   * 화면에 분(minute)으로 그리지 않는다 — 사용자에게 보여 주는 소요시간은 `durationText`
   * 원문이다 (`lib/plan/walk-course-meta.ts` 와 같은 규칙).
   */
  durationMaxMinutes: number | null
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
 * 목록에 실제로 적용된 활동량과 그 상한 — `AppliedPetActivityLevelItem.java`.
 *
 * **세 가지 null 을 가른다** (`tour-service.md` `/api/v1/walk-courses` 절):
 *
 * | 응답                                            | 뜻                                  |
 * | ----------------------------------------------- | ----------------------------------- |
 * | `appliedPetActivityLevel: null`                 | 활동량으로 거르지 않았다            |
 * | 객체 있음 · `maxDurationMinutes: 240`           | `LOW` 로 걸렀고 상한이 4시간이다    |
 * | 객체 있음 · `maxDurationMinutes: null`          | `HIGH` 로 걸렀고 **상한이 없다**    |
 *
 * `level.description` 은 **반려견 성향** 문구다("짧은 산책을 선호하며…"). 소요시간 상한이
 * 아니므로 기준 줄에 상한으로 쓰지 않는다 — 상한은 `maxDurationMinutes` 숫자다.
 */
export type WalkCourseAppliedActivityLevel = {
  level: CodeNameMetadata
  /** **`null` 은 `HIGH`(상한 없음)다.** 객체 자체가 null 인 것(필터 미적용)과 뜻이 다르다 */
  maxDurationMinutes: number | null
}

/**
 * `GET /walk-courses` — `WalkCourseListResponse.java:11-46`.
 *
 * **커서가 없다.** 코스가 29개뿐이라 전량이 한 번에 온다 — `useInfiniteQuery` 가 아니다.
 */
export type WalkCourseList = {
  courses: WalkCourseSummary[]
  /** 조건에 맞는 코스 수 */
  totalCount: number
  /**
   * 서버가 실제로 적용한 활동량. **`null` 이면 거르지 않았다** — 화면이 스스로 판정하지
   * 않는다 (공통명세 S4-1 규칙 5).
   *
   * **응답의 `petActivityLevelApplied`(boolean)는 여기 없다.** 서버가 같은 사실을 한동안
   * 두 곳에서 말하지만(#718 이 deprecated 로 남겨 뒀다) 화면은 한쪽만 읽는다 — 둘이
   * 어긋나는 날 어느 쪽을 믿을지 정해 두지 않으면 그때 정하게 된다. 서버 쪽 제거는 #735
   * 머지 뒤 별도 PR 이다.
   */
  appliedPetActivityLevel: WalkCourseAppliedActivityLevel | null
  /** 출처 표기. 상수가 아니라 서버가 내려주는 문자열이다 */
  providerName: string
}

/**
 * `GET /walk-courses/{walkCourseId}` — `WalkCourseDetailResponse.java:11-59`.
 *
 * `baseDate` 는 **문자열이다**(`2025-04-28`). `Date` 로 파싱하면 자정 UTC 로 읽혀 KST
 * 기준 하루 밀린다 (`코스상세-세부명세.md` D4-3).
 */
export type WalkCourseDetail = WalkCourseSummary & {
  baseDate: string
  /**
   * 이 코스를 걸을 만한 활동량 전부 — **상세에만 있다** (목록 항목에는 싣지 않는다).
   *
   * **`durationMaxMinutes` 가 null 인 코스는 세 값이 다 담긴다.** 그것은 "아무 아이나
   * 된다" 가 아니라 **"소요시간을 모른다"** 는 뜻이라, 그리려면 `durationMaxMinutes` 를
   * 함께 보아야 한다 (`WalkCourseActivityFit.fittingLevels`).
   */
  fitsActivityLevels: CodeNameMetadata[]
  providerName: string
}

/**
 * 서버에 실제로 보내는 활동량 값.
 *
 * **`HIGH` 가 없다.** 결과가 필터 없음과 같은데(실측 29/29) 보내면
 * `appliedPetActivityLevel` 이 채워져 화면이 **좁히지도 않은 것을 좁혔다고 말한다**
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

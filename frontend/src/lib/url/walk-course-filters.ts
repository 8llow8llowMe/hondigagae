import {
  DEFAULT_WALK_COURSE_FILTERS,
  WALK_COURSE_ACTIVITY_PARAMS,
  WALK_COURSE_SORTS,
  type WalkCourseActivityChoice,
  type WalkCourseFilters,
  type WalkCourseSort,
} from '@/types/walk-course'

/**
 * 산책 코스 목록 조건의 URL 직렬화 — `코스목록-세부명세.md` D0.
 *
 * 규약 (`docs/architecture-guide.md` §10)
 *  - **URL 이 조건을 소유한다.** Zustand 에 두면 공유한 링크가 다른 화면을 보여 준다
 *  - 기본값은 URL 에서 생략한다 → 빈 URL = 기본 상태
 *  - 잘못된 값은 예외를 던지지 않고 기본값으로 떨어뜨린다 (URL 은 사용자가 손으로 고친다)
 *
 * **키 이름이 백엔드 파라미터와 다르다.** 서버는 `petActivityLevel` 이고 URL 은 `activity`
 * 다 — 화면의 값 집합이 서버의 것과 같지 않기 때문이다. URL 에는 `ALL`(자동 채움 끔)이
 * 있고 `HIGH` 가 없다. 같은 이름을 쓰면 "URL 에 적은 것이 그대로 나간다" 는 잘못된 기대를
 * 만든다 — 변환은 `lib/walk-course/activity.ts` 가 한다.
 */

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>

function read(params: RawParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key)

  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * **`HIGH` 를 `ALL` 로 정규화한다.** 결과가 필터 없음과 같은데(실측 29/29) 그대로 보내면
 * `petActivityLevelApplied: true` 가 와서 **화면이 좁히지도 않은 것을 좁혔다고 말한다**
 * (공통명세 S4-1 규칙 3). 주소에 손으로 적어 넣는 경로가 유일한 입구라 여기서 막는다.
 */
function readActivity(value: string | null): WalkCourseActivityChoice {
  if (value === null) return null
  if (value === 'ALL' || value === 'HIGH') return 'ALL'

  return WALK_COURSE_ACTIVITY_PARAMS.includes(value as (typeof WALK_COURSE_ACTIVITY_PARAMS)[number])
    ? (value as WalkCourseActivityChoice)
    : null
}

/**
 * 정렬은 **화이트리스트**다. 계약은 4종이지만 화면이 노출하는 것은 둘이라
 * (`코스목록-세부명세.md` D8-4), 범위를 넓히면 `?sort=DURATION_ASC` 가 통과해
 * **정렬 컨트롤에 선택된 항목이 없는 화면**이 된다 (`emergency-filters.ts` 의 반경과 같은 함정).
 */
function readSort(value: string | null): WalkCourseSort | null {
  if (value === null) return null

  return WALK_COURSE_SORTS.includes(value as WalkCourseSort) ? (value as WalkCourseSort) : null
}

export function parseWalkCourseFilters(params: RawParams): WalkCourseFilters {
  return {
    activity: readActivity(read(params, 'activity')),
    sort: readSort(read(params, 'sort')),
  }
}

/**
 * 화면 URL 용 쿼리 문자열. 기본값은 생략한다.
 *
 * **`ALL` 은 기본값이 아니다.** 빼면 새로고침·공유에서 자동 채움이 되살아나, 활동량 낮은
 * 아이의 보호자가 필터를 끄는 순간 다시 켜진다.
 */
export function toWalkCourseFilterQuery(filters: WalkCourseFilters): string {
  const params = new URLSearchParams()

  if (filters.activity !== DEFAULT_WALK_COURSE_FILTERS.activity && filters.activity !== null) {
    params.set('activity', filters.activity)
  }
  if (filters.sort !== null) params.set('sort', filters.sort)

  return params.toString()
}

/**
 * 조건이 바뀐 뒤의 주소. **훅에서 떼어 둔 순수 함수다** — 회귀가 나는 곳이 조립 규칙이라
 * 라우터 없이 그것만 고정할 수 있어야 한다 (`docs/testing-guide.md` §1).
 *
 * **조건을 통째로 다시 싣는다.** 한 축만 새로 쓰면 다른 축이 떨어져, 정렬을 바꾼 사용자가
 * 활동량 필터를 잃는다 (D4).
 */
export function walkCourseFilterHref(pathname: string, filters: WalkCourseFilters): string {
  const query = toWalkCourseFilterQuery(filters)

  return query === '' ? pathname : `${pathname}?${query}`
}

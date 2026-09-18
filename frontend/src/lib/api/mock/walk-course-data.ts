import type { MockResult } from '@/lib/api/mock/auth-data'
import type { ApiResponse } from '@/types/api'
import type { WalkCourseDetail, WalkCourseList, WalkCourseSummary } from '@/types/walk-course'

/**
 * 제주올레 산책 코스 mock (#618).
 *
 * **dev 실데이터(2026-09-18)를 옮긴 fixture 다.** 지어낸 값이 아니라 실호출 응답에서
 * 골라 왔고, **분포까지 흉내 낸다** — 좌표·이미지를 가진 코스가 소수다 (공통명세 S3-1).
 * 그것이 화면 분기의 전제라, 전부 좌표를 채워 두면 로컬에서는 **기본 모양을 한 번도 못 본다.**
 *
 * **백엔드보다 느슨하거나 엄격해서는 안 된다** (`favorite-data.ts` 와 같은 규칙):
 * 없는 id → 404 `WALKCOURSE_001`, 숫자 아닌 id → 400 `WALKCOURSE_113`,
 * `maxDistanceKm` 범위 밖 → 400 `WALKCOURSE_101`, `petActivityLevel` 대소문자 오류 →
 * 400 `WALKCOURSE_113`.
 *
 * 근거: `WalkCourseWebController` · `WalkCourseQueryProcessor` · `WalkCourseActivityFit` ·
 * `WalkCoursePresenter` · `WalkCourseErrorCode` 소스 실측 + dev 실호출.
 */

const PROVIDER_NAME = '제주특별자치도 올레코스현황 · 한국관광공사 TourAPI'
const BASE_DATE = '2025-04-28'

/**
 * `durationMaxMinutes` 는 **응답에 없다** — 서버가 필터에만 쓴다 (`WalkCourseActivityFit`).
 * mock 도 같은 자리에 두고 응답에서는 뺀다. 같은 값이 `PlanItemWalkCourseItem` 에는 있는데
 * 코스 목록·상세에는 없는 것이 계약의 실제 모양이고, BE 후속 요청으로 남겼다 (D9-2).
 */
type MockWalkCourse = WalkCourseSummary & { durationMaxMinutes: number | null }

/**
 * 여섯 코스로 화면 분기를 전부 덮는다 (`코스목록-세부명세.md` D7 표).
 *
 * `2코스` 만 좌표·이미지를 갖는다 — **골든타임 동선이 생기는 유일한 모양**이다.
 * 나머지 다섯이 기본 모양이고, `LOW`(240분)를 걸면 `6코스` 하나만 남아 **좌표 있는 코스가
 * 0개가 되는 상태**(D8-2)가 로컬에서 그대로 재현된다.
 */
export const MOCK_WALK_COURSES: MockWalkCourse[] = [
  {
    walkCourseId: '6911167100216303301',
    courseLabel: '1코스',
    name: '시흥-광치기',
    distanceKm: 15.1,
    durationText: '4~5시간',
    durationMaxMinutes: 300,
    startEndPoint: '시흥리정류장-광치기해변',
    lat: null,
    lng: null,
    firstImage: null,
  },
  {
    walkCourseId: '6911167100216303304',
    courseLabel: '2코스',
    name: '광치기-온평포구',
    distanceKm: 15.6,
    durationText: '4~5시간',
    durationMaxMinutes: 300,
    startEndPoint: '광치기해변-온평포구',
    lat: 33.3866,
    lng: 126.8734,
    firstImage: 'http://tong.visitkorea.or.kr/cms/resource/60/2666460_image2_1.jpg',
  },
  {
    walkCourseId: '6911167100216303306',
    courseLabel: '3코스 (A)',
    name: '온평포구-표선',
    distanceKm: 20.9,
    durationText: '6~7시간',
    durationMaxMinutes: 420,
    startEndPoint: '온평포구-표선해수욕장',
    lat: null,
    lng: null,
    firstImage: null,
  },
  {
    walkCourseId: '6911167100216303310',
    courseLabel: '6코스',
    name: '쇠소깍-제주올레여행자센터',
    distanceKm: 11.0,
    durationText: '3~4시간',
    durationMaxMinutes: 240,
    startEndPoint: '쇠소깍다리-제주올레여행자센터',
    lat: null,
    lng: null,
    firstImage: null,
  },
  {
    walkCourseId: '6911167100216303315',
    courseLabel: '10-1코스',
    name: '가파도',
    distanceKm: 4.2,
    durationText: '1~2시간',
    durationMaxMinutes: 120,
    startEndPoint: '가파도상동포구-가파도상동포구',
    lat: null,
    lng: null,
    firstImage: null,
  },
  {
    walkCourseId: '6911167100216303322',
    courseLabel: '15코스 (B)',
    name: '한림항-고내포구',
    distanceKm: 13.0,
    durationText: '4~5시간',
    durationMaxMinutes: 300,
    startEndPoint: '한림항비양도도항선대합실-고내포구',
    lat: null,
    lng: null,
    firstImage: null,
  },
]

/** 서버 상한 (`WalkCourseActivityFit.java:22-23`) */
const ACTIVITY_MAX_MINUTES: Record<string, number> = { LOW: 240, MEDIUM: 360 }
const ACTIVITY_CODES = ['LOW', 'MEDIUM', 'HIGH']
const SORTS = ['COURSE_NO', 'DISTANCE_ASC', 'DISTANCE_DESC', 'DURATION_ASC']

const MIN_DISTANCE_KM = 0.1
const MAX_DISTANCE_KM = 50

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: string): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

function toSummary(course: MockWalkCourse): WalkCourseSummary {
  // `durationMaxMinutes` 는 응답에 없다 — 여기서 떨어뜨리는 것이 계약을 지키는 일이다
  const { durationMaxMinutes, ...summary } = course
  void durationMaxMinutes

  return summary
}

/**
 * `WalkCourseActivityFit.fits` — **소요시간을 모르는 코스는 어느 활동량에서도 걸러지지
 * 않는다.** 모르는 것을 나쁜 것으로 판정하지 않는다는 규칙이고, `HIGH` 는 상한이 없다.
 */
function fits(course: MockWalkCourse, level: string): boolean {
  const max = ACTIVITY_MAX_MINUTES[level]
  if (max === undefined) return true
  if (course.durationMaxMinutes === null) return true

  return course.durationMaxMinutes <= max
}

/**
 * `WalkCourseQueryProcessor.search` — **어느 기준이든 코스 차례가 마지막 타이브레이크**이고,
 * `DURATION_ASC` 는 소요시간을 모르는 코스를 **뒤로 보낸다**(지우지도, 0분으로 앞세우지도
 * 않는다).
 */
function sorted(courses: MockWalkCourse[], sort: string): MockWalkCourse[] {
  const byCourseNo = (left: MockWalkCourse, right: MockWalkCourse) =>
    left.walkCourseId.localeCompare(right.walkCourseId)

  if (sort === 'DISTANCE_ASC') {
    return [...courses].sort((l, r) => l.distanceKm - r.distanceKm || byCourseNo(l, r))
  }
  if (sort === 'DISTANCE_DESC') {
    return [...courses].sort((l, r) => r.distanceKm - l.distanceKm || byCourseNo(l, r))
  }
  if (sort === 'DURATION_ASC') {
    return [...courses].sort((l, r) => {
      const left = l.durationMaxMinutes ?? Number.POSITIVE_INFINITY
      const right = r.durationMaxMinutes ?? Number.POSITIVE_INFINITY
      return left - right || byCourseNo(l, r)
    })
  }

  return [...courses].sort(byCourseNo)
}

function list(params: URLSearchParams): MockResult {
  const level = params.get('petActivityLevel')
  // 대소문자 오류가 여기로 온다 — dev 실측에서 `low` 가 400 `WALKCOURSE_113` 이었다
  if (level !== null && !ACTIVITY_CODES.includes(level)) {
    return fail(400, 'WALKCOURSE_113', 'petActivityLevel 파라미터 형식이 올바르지 않습니다.')
  }

  const sort = params.get('sort')
  if (sort !== null && !SORTS.includes(sort)) {
    return fail(400, 'WALKCOURSE_113', 'sort 파라미터 형식이 올바르지 않습니다.')
  }

  const rawDistance = params.get('maxDistanceKm')
  if (rawDistance !== null) {
    const distance = Number(rawDistance)
    if (!Number.isFinite(distance) || distance < MIN_DISTANCE_KM || distance > MAX_DISTANCE_KM) {
      return fail(400, 'WALKCOURSE_101', '검색 거리는 0.1 이상 50 이하여야 합니다.')
    }
  }

  const maxDistanceKm = rawDistance === null ? null : Number(rawDistance)
  const filtered = MOCK_WALK_COURSES.filter(
    (course) =>
      (level === null || fits(course, level)) &&
      (maxDistanceKm === null || course.distanceKm <= maxDistanceKm),
  )

  /*
    **`petActivityLevelApplied` 를 파라미터 유무로 계산한다** — presenter 와 같다
    (`WalkCoursePresenter.java:20`). 결과가 줄었는지로 판정하면 `HIGH` 가 false 가 되어,
    화면이 서버를 믿는 규칙(S4-1 규칙 5)을 mock 에서 검증할 수 없다.
  */
  const body: WalkCourseList = {
    courses: sorted(filtered, sort ?? 'COURSE_NO').map(toSummary),
    totalCount: filtered.length,
    petActivityLevelApplied: level !== null,
    providerName: PROVIDER_NAME,
  }

  return { status: 200, payload: ok(body) }
}

function detail(rawId: string): MockResult {
  // 컨트롤러가 `@PathVariable long` 이라 숫자가 아닌 id 는 404 가 아니라 400 이다
  if (!/^\d+$/.test(rawId)) {
    return fail(400, 'WALKCOURSE_113', '요청 파라미터 형식이 올바르지 않습니다.')
  }

  const found = MOCK_WALK_COURSES.find((course) => course.walkCourseId === rawId)
  if (found === undefined) return fail(404, 'WALKCOURSE_001', '존재하지 않는 산책 코스입니다.')

  const body: WalkCourseDetail = {
    ...toSummary(found),
    baseDate: BASE_DATE,
    providerName: PROVIDER_NAME,
  }

  return { status: 200, payload: ok(body) }
}

/** 처리 대상이 아니면 `null` — 호출부가 실제 게이트웨이로 넘어간다 */
export function resolveWalkCourseMock(
  path: string,
  method: string,
  search: string,
): MockResult | null {
  if (method !== 'GET') return null

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  if (path === '/walk-courses') return list(params)

  const match = /^\/walk-courses\/([^/]+)$/.exec(path)
  if (match !== null) return detail(match[1] ?? '')

  return null
}

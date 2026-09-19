import type { MockResult } from '@/lib/api/mock/auth-data'
import type { ApiResponse, CodeNameMetadata } from '@/types/api'
import type {
  WalkCourseAppliedActivityLevel,
  WalkCourseDetail,
  WalkCourseList,
  WalkCourseSummary,
} from '@/types/walk-course'

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
 * `durationMaxMinutes` 는 **이제 응답에 있다** (#718 · `WalkCourseItem.java:34-36`). 목록·상세
 * 항목이 그대로 싣는다 — 전에는 서버가 필터에만 써서 mock 이 응답에서 떨어뜨렸고, 그 부재를
 * 목 테스트가 계약으로 고정하고 있었다 (#735 가 뒤집은 전제).
 */
type MockWalkCourse = WalkCourseSummary

/**
 * 일곱 코스로 화면 분기를 전부 덮는다 (`코스목록-세부명세.md` D7 표).
 *
 * `2코스` 만 좌표·이미지를 갖는다 — **골든타임 동선이 생기는 유일한 모양**이다.
 * 나머지가 기본 모양이고, `LOW`(240분)를 걸면 **좌표 있는 코스가 0개가 되는 상태**(D8-2)가
 * 로컬에서 그대로 재현된다.
 *
 * **`20코스` 는 소요시간을 모르는 갈래다** ([#748](https://github.com/8llow8llowMe/hondigagae/issues/748)).
 * 없을 때는 여섯 코스가 **전부 `durationMaxMinutes` 를 갖고 있어** 상세의 모르는 갈래
 * (`activityFitUnknown`)를 로컬에서 한 번도 볼 수 없었다 — 이 저장소가 반복해서 데인
 * 패턴이다([#671](https://github.com/8llow8llowMe/hondigagae/issues/671) E-1).
 * 테스트 fixture 의 `WALK_COURSE_UNKNOWN_DURATION` 과 **같은 코스**이되 시종점만 다르다
 * (그 fixture 는 `WALK_COURSE_PLAIN` 을 스프레드해 1코스의 시종점을 물려받는다 — 아래 주석).
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
  {
    /*
      **소요시간 원문을 파싱하지 못한 코스** (#718 · #748). `durationMaxMinutes: null` 은
      "제한 없음" 이 아니라 **"모른다"** 라서, `fits` 가 통과시켜 `fittingLevels` 가 세 값을
      다 내려 준다 — 목을 따로 짜지 않아도 저절로 그 모양이 된다.
    */
    walkCourseId: '6911167100216303320',
    courseLabel: '20코스',
    name: '김녕-하도',
    distanceKm: 17.6,
    durationText: '미정',
    durationMaxMinutes: null,
    /*
      **시종점은 fixture 에서 물려받지 않는다.** 테스트 fixture 의
      `WALK_COURSE_UNKNOWN_DURATION` 은 `WALK_COURSE_PLAIN` 을 스프레드해 1코스의
      시종점을 그대로 갖는데, 그것을 여기 옮기면 목록에 **같은 시종점을 가진 코스가
      둘** 뜬다. 이 파일은 서버 실데이터의 복제본이라고 스스로 규정하므로(머리 주석)
      복제본이 거짓을 가르치면 안 된다 — 코스 이름(`김녕-하도`)과 맞춘다.
    */
    startEndPoint: '김녕서포구-하도해수욕장',
    lat: null,
    lng: null,
    firstImage: null,
  },
]

/**
 * 서버 상한 (`WalkCourseActivityFit.java:26-27`).
 *
 * **이것은 화면의 복제본이 아니라 mock 서버의 값이다.** 화면 쪽 복제본은 #735 에서 걷었고,
 * 여기 남는 이유는 mock 이 *서버 역할*을 하기 때문이다 — 거르고, 그 상한을 응답에 실어야
 * 화면이 응답만 보고 기준 줄을 그리는 것을 로컬에서 검증할 수 있다. `HIGH` 는 상한이 없다.
 */
const ACTIVITY_MAX_MINUTES: Record<string, number | undefined> = { LOW: 240, MEDIUM: 360 }
const ACTIVITY_CODES = ['LOW', 'MEDIUM', 'HIGH']

/**
 * `ActivityLevel` enum metadata (`shared-travel` `ActivityLevel.java:14-16`).
 *
 * mock 은 **서버 문구를 그대로** 낸다 — `appliedPetActivityLevel.level` 과
 * `fitsActivityLevels` 가 이 값으로 나가야 화면이 서버 metadata 를 렌더하는지 검증된다.
 */
const ACTIVITY_LEVELS: Record<string, CodeNameMetadata> = {
  LOW: {
    code: 'LOW',
    name: '낮음',
    description: '짧은 산책을 선호하며 장시간 활동을 힘들어합니다.',
  },
  MEDIUM: {
    code: 'MEDIUM',
    name: '보통',
    description: '일반적인 산책과 관광 일정을 소화합니다.',
  },
  HIGH: { code: 'HIGH', name: '높음', description: '긴 산책과 활동적인 일정을 선호합니다.' },
}
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
 * `WalkCoursePresenter.toAppliedPetActivityLevel` — **활동량을 주지 않은 조회는 객체 자체가
 * null 이다.** 별도 불리언(`petActivityLevelApplied`)을 함께 내지 않는다: 서버는 한동안
 * 둘 다 내지만 deprecated 라 곧 사라지고(#718 주석), 화면은 이미 이 객체만 읽는다 (#735).
 *
 * `HIGH` 는 상한이 없어 `maxDurationMinutes` 가 `null` 이다 — **객체가 null 인 것과 뜻이
 * 다르다.** 이 갈래가 mock 에 있어야 화면이 둘을 가르는지 로컬에서 볼 수 있다.
 */
function toAppliedActivityLevel(level: string | null): WalkCourseAppliedActivityLevel | null {
  if (level === null) return null

  const metadata = ACTIVITY_LEVELS[level]
  if (metadata === undefined) return null

  return { level: metadata, maxDurationMinutes: ACTIVITY_MAX_MINUTES[level] ?? null }
}

/**
 * `WalkCourseActivityFit.fittingLevels` — **소요시간을 모르는 코스는 세 값이 다 담긴다.**
 * 그것은 "아무 아이나 된다" 가 아니라 "모른다" 는 뜻이고, 소비처가 `durationMaxMinutes`
 * 를 함께 보게 되어 있다.
 */
function fittingLevels(course: MockWalkCourse): CodeNameMetadata[] {
  return ACTIVITY_CODES.filter((code) => fits(course, code))
    .map((code) => ACTIVITY_LEVELS[code])
    .filter((level): level is CodeNameMetadata => level !== undefined)
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
    **`appliedPetActivityLevel` 을 파라미터 유무로 만든다** — presenter 와 같다
    (`WalkCoursePresenter.java:20,59-67`). 결과가 줄었는지로 판정하면 `HIGH` 가 null 이 되어,
    화면이 서버를 믿는 규칙(S4-1 규칙 5)을 mock 에서 검증할 수 없다.
  */
  const body: WalkCourseList = {
    courses: sorted(filtered, sort ?? 'COURSE_NO'),
    totalCount: filtered.length,
    appliedPetActivityLevel: toAppliedActivityLevel(level),
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
    ...found,
    baseDate: BASE_DATE,
    fitsActivityLevels: fittingLevels(found),
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

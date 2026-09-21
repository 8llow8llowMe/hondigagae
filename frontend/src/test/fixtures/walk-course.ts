import type { WalkCourseDetail, WalkCourseSummary } from '@/types/walk-course'

/**
 * 산책 코스 테스트 fixture — **dev 실호출 응답(2026-09-18) 기준**이다
 * (`docs/testing-guide.md` §4, 공통명세 S2-1).
 *
 * **분포를 흉내 내는 것이 요점이다.** 실측 29개 중 25개가 좌표·이미지 null 이라
 * (공통명세 S3-1), 좌표 있는 코스를 기본 fixture 로 두면 **테스트가 소수 갈래만 본다.**
 * 그래서 `WALK_COURSE_PLAIN` 이 기본이고 `WALK_COURSE_WITH_COORDS` 가 예외다.
 */

/** **기본 모양** — 좌표·이미지 없음. 실측 29개 중 25개가 이것이다 */
export const WALK_COURSE_PLAIN: WalkCourseSummary = {
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
}

/** 좌표·이미지를 **둘 다** 가진 코스. 골든타임 동선이 생기는 유일한 모양이다 */
export const WALK_COURSE_WITH_COORDS: WalkCourseSummary = {
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
}

/** 거리가 **정수로 오는** 코스. `19km` 로 줄면 같은 열의 `19.1` 과 자릿수가 어긋난다 */
export const WALK_COURSE_ROUND_DISTANCE: WalkCourseSummary = {
  ...WALK_COURSE_PLAIN,
  walkCourseId: '6911167100216303318',
  courseLabel: '19코스',
  name: '조천만세동산-김녕서포구',
  distanceKm: 19,
  durationText: '5~6시간',
  durationMaxMinutes: 360,
  startEndPoint: '조천만세동산-김녕서포구',
}

/** **하이픈과 공백이 섞인 시종점 원문** (4코스). 갈라 재조립하면 잘못 갈린다 (D4-4) */
export const WALK_COURSE_MIXED_START_END: WalkCourseSummary = {
  ...WALK_COURSE_PLAIN,
  walkCourseId: '6911167100216303308',
  courseLabel: '4코스',
  name: '표선-남원',
  distanceKm: 19,
  durationText: '6~7시간',
  durationMaxMinutes: 420,
  startEndPoint: '제주민속촌주차장 입구-남원포구',
}

/**
 * **소요시간 원문을 파싱하지 못한 코스** (#718). `durationMaxMinutes: null` 은 "제한 없음"
 * 이 아니라 "모른다" 이고, 그래서 어느 활동량에서도 걸러지지 않고 `fitsActivityLevels` 에
 * 세 값이 다 담긴다 — **그 둘을 함께 보지 않으면 "아무 아이나 된다" 로 읽히는 갈래다.**
 *
 * **`durationText: '미정'` 은 서버 값이 아니다** (#776 · 목록명세 D5-3). 백엔드에 그런
 * 폴백이 없고 `WalkCourseItem.durationText` 는 **파싱에 실패한 원문을 그대로** 내린다 —
 * 여기 `미정` 은 이 fixture 가 자리를 채우려고 고른 문자열일 뿐이다. **행이 이 낱말로
 * 미상 갈래를 알려 준다고 읽지 않는다** — 실제 미상 코스는 평범해 보이는 원문을 단다.
 *
 * 실물 예시가 없는 이유는 **dev 실측(2026-09-21)에 미상 코스가 0건**이기 때문이다. 재적재
 * (#722)로 실제 값이 나오면 그 원문으로 바꾼다.
 */
export const WALK_COURSE_UNKNOWN_DURATION: WalkCourseSummary = {
  ...WALK_COURSE_PLAIN,
  walkCourseId: '6911167100216303320',
  courseLabel: '20코스',
  name: '김녕-하도',
  distanceKm: 17.6,
  durationText: '미정',
  durationMaxMinutes: null,
}

export const WALK_COURSE_PROVIDER = '제주특별자치도 올레코스현황 · 한국관광공사 TourAPI'

/** `낮음` 활동량 metadata — 서버 `ActivityLevel.LOW` 문구 그대로다 */
export const ACTIVITY_LEVEL_LOW = {
  code: 'LOW',
  name: '낮음',
  description: '짧은 산책을 선호하며 장시간 활동을 힘들어합니다.',
}

/**
 * 상세 fixture. `fitsActivityLevels` 기본값은 **소요시간을 아는 코스**의 모양이다 —
 * `WALK_COURSE_PLAIN`(300분)은 `MEDIUM`·`HIGH` 가 걸을 만하고 `LOW` 는 아니다.
 */
export function walkCourseDetail(summary: WalkCourseSummary = WALK_COURSE_PLAIN): WalkCourseDetail {
  return {
    ...summary,
    baseDate: '2025-04-28',
    fitsActivityLevels: [
      { code: 'MEDIUM', name: '보통', description: '일반적인 산책과 관광 일정을 소화합니다.' },
      { code: 'HIGH', name: '높음', description: '긴 산책과 활동적인 일정을 선호합니다.' },
    ],
    providerName: WALK_COURSE_PROVIDER,
  }
}

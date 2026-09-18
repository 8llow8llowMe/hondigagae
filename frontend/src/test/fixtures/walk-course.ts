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
  startEndPoint: '제주민속촌주차장 입구-남원포구',
}

export const WALK_COURSE_PROVIDER = '제주특별자치도 올레코스현황 · 한국관광공사 TourAPI'

export function walkCourseDetail(summary: WalkCourseSummary = WALK_COURSE_PLAIN): WalkCourseDetail {
  return { ...summary, baseDate: '2025-04-28', providerName: WALK_COURSE_PROVIDER }
}

import { describe, expect, it } from 'vitest'

import { resolveMock } from '@/lib/api/mock'
import type { WalkCourseDetail, WalkCourseList } from '@/types/walk-course'

/**
 * mock 이 **실서버와 같은 모양**으로 답하는지 (`코스목록-세부명세.md` D7).
 *
 * 느슨하면 화면의 오류 분기를 로컬에서 볼 수 없고, 엄격하면 통과하는 조작이 mock 에서만
 * 오류로 보인다 (`favorite-data.ts` 와 같은 규칙).
 */
function list(search: string) {
  const result = resolveMock('/walk-courses', 'GET', search, null)
  if (result === null) throw new Error('mock 이 경로를 처리하지 못했다')
  return result
}

function body(search: string): WalkCourseList {
  return list(search).payload.dataBody as WalkCourseList
}

describe('산책 코스 mock — 공개 API', () => {
  it('토큰 없이도 200 이다', () => {
    expect(list('').status).toBe(200)
  })

  it('상세도 토큰 없이 200 이다', () => {
    expect(resolveMock('/walk-courses/6911167100216303304', 'GET', '', null)?.status).toBe(200)
  })

  /** 커서가 없다 — `totalCount` 와 `providerName` 이 온다 (공통명세 S3) */
  it('커서가 아니라 totalCount 를 준다', () => {
    const result = body('')

    expect(result.totalCount).toBe(result.courses.length)
    expect(result.providerName.length).toBeGreaterThan(0)
    expect(result).not.toHaveProperty('hasNext')
  })

  /** 좌표·이미지가 있는 코스가 소수라는 실데이터 분포를 fixture 가 흉내 낸다 (S3-1) */
  it('좌표 없는 코스가 다수다 — 기본 모양이 그것이다', () => {
    const { courses } = body('')
    const withCoords = courses.filter((course) => course.lat !== null && course.lng !== null)

    expect(withCoords.length).toBeLessThan(courses.length - withCoords.length)
  })

  /** 좌표와 이미지는 같은 매칭에서 온다 — 한쪽만 있는 코스가 없어야 분포가 실제와 같다 */
  it('좌표가 있는 코스가 이미지도 갖는다', () => {
    for (const course of body('').courses) {
      expect(course.lat !== null).toBe(course.firstImage !== null)
    }
  })

  /** 응답에 없는 필드를 흘리지 않는다 — `durationMaxMinutes` 는 필터 전용이다 (D9-2) */
  it('durationMaxMinutes 를 응답에 싣지 않는다', () => {
    for (const course of body('').courses) {
      expect(course).not.toHaveProperty('durationMaxMinutes')
    }
  })
})

describe('산책 코스 mock — 활동량 필터 (S4-1)', () => {
  /**
   * **`petActivityLevelApplied` 는 파라미터 유무로 정한다** (`WalkCoursePresenter.java:20`).
   * 결과가 줄었는지로 판정하면 `HIGH` 가 false 가 되어, 화면이 응답을 믿는 규칙을
   * mock 에서 검증할 수 없다.
   */
  it('파라미터가 없으면 applied 가 거짓이다', () => {
    expect(body('').petActivityLevelApplied).toBe(false)
  })

  it('LOW 는 4시간 초과 코스를 걸러 내고 applied 가 참이다', () => {
    const result = body('?petActivityLevel=LOW')

    expect(result.petActivityLevelApplied).toBe(true)
    expect(result.courses.length).toBeLessThan(body('').courses.length)
  })

  it('MEDIUM 은 LOW 보다 넓다', () => {
    expect(body('?petActivityLevel=MEDIUM').courses.length).toBeGreaterThan(
      body('?petActivityLevel=LOW').courses.length,
    )
  })

  /**
   * **`HIGH` 는 결과가 필터 없음과 같은데 `applied` 만 참이 된다.** 화면이 이 값을
   * 보내지 않기로 한 이유가 이것이고, mock 도 서버처럼 답해야 그 판단이 검증된다.
   */
  it('HIGH 는 결과가 필터 없음과 같은데 applied 만 참이다', () => {
    const high = body('?petActivityLevel=HIGH')

    expect(high.courses.length).toBe(body('').courses.length)
    expect(high.petActivityLevelApplied).toBe(true)
  })

  /** 모르는 것을 나쁜 것으로 판정하지 않는다 (`WalkCourseActivityFit.fits`) */
  it('LOW 결과에 좌표 있는 코스가 하나도 없다 — 실데이터 분포 그대로다', () => {
    const { courses } = body('?petActivityLevel=LOW')

    expect(courses.length).toBeGreaterThan(0)
    expect(courses.every((course) => course.lat === null)).toBe(true)
  })

  it('소문자는 400 WALKCOURSE_113 이다', () => {
    const result = list('?petActivityLevel=low')

    expect(result.status).toBe(400)
    expect(result.payload.dataHeader.resultCode).toBe('WALKCOURSE_113')
  })
})

describe('산책 코스 mock — 정렬·거리', () => {
  it('DISTANCE_ASC 는 짧은 코스부터다', () => {
    const distances = body('?sort=DISTANCE_ASC').courses.map((course) => course.distanceKm)

    expect(distances).toEqual([...distances].sort((left, right) => left - right))
  })

  it('maxDistanceKm 범위 밖은 400 WALKCOURSE_101 이다', () => {
    const result = list('?maxDistanceKm=99')

    expect(result.status).toBe(400)
    expect(result.payload.dataHeader.resultCode).toBe('WALKCOURSE_101')
  })
})

describe('산책 코스 mock — 상세 오류 (D0-1)', () => {
  it('없는 id 는 404 WALKCOURSE_001 이다', () => {
    const result = resolveMock('/walk-courses/1234567890123456789', 'GET', '', null)

    expect(result?.status).toBe(404)
    expect(result?.payload.dataHeader.resultCode).toBe('WALKCOURSE_001')
  })

  /** `@PathVariable long` 이라 파싱 단계에서 갈린다 — 404 가 아니다 */
  it('숫자가 아닌 id 는 400 WALKCOURSE_113 이다', () => {
    const result = resolveMock('/walk-courses/abc', 'GET', '', null)

    expect(result?.status).toBe(400)
    expect(result?.payload.dataHeader.resultCode).toBe('WALKCOURSE_113')
  })

  it('상세는 baseDate 와 providerName 을 더한다', () => {
    const result = resolveMock('/walk-courses/6911167100216303304', 'GET', '', null)
    const detail = result?.payload.dataBody as WalkCourseDetail

    expect(detail.baseDate).toBe('2025-04-28')
    expect(detail.providerName.length).toBeGreaterThan(0)
  })
})

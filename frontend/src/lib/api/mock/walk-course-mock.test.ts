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

  /**
   * **좌표·이미지가 있는 코스가 기본이라는 실데이터 분포를 fixture 가 흉내 낸다** (S3-1 ·
   * [#767](https://github.com/8llow8llowMe/hondigagae/issues/767)). 2026-09-18 에는 정반대를
   * 단언하던 자리다 — 재적재로 29/29 가 되었다.
   */
  it('좌표 있는 코스가 다수다 — 기본 모양이 그것이다', () => {
    const { courses } = body('')
    const withCoords = courses.filter((course) => course.lat !== null && course.lng !== null)

    expect(withCoords.length).toBeGreaterThan(courses.length - withCoords.length)
  })

  /**
   * **없는 갈래를 다 지우지는 않는다.** 이미지·좌표는 계약이 아니라 TourAPI 매칭에서 오는
   * 데이터라 원천이 다시 비면 돌아온다 — 그때 상세 안내 상자(D5-2)와 썸네일 없는 행을
   * 로컬에서 볼 수 있어야 한다.
   */
  it('좌표 없는 코스를 하나는 남긴다', () => {
    const { courses } = body('')

    expect(courses.filter((course) => course.lat === null)).toHaveLength(1)
  })

  /**
   * **좌표 없음과 소요시간 모름은 서로 독립이다.** 한 행에 겹쳐 두면 로컬에서 둘이 묶여
   * 보이고, "좌표가 없으면 소요시간도 모른다" 로 잘못 읽힌다.
   */
  it('좌표 없는 코스와 소요시간 모르는 코스가 다른 행이다', () => {
    const { courses } = body('')
    const noCoords = courses.find((course) => course.lat === null)
    const unknownDuration = courses.find((course) => course.durationMaxMinutes === null)

    expect(noCoords).toBeDefined()
    expect(unknownDuration).toBeDefined()
    expect(noCoords?.walkCourseId).not.toBe(unknownDuration?.walkCourseId)
  })

  /** 좌표와 이미지는 같은 매칭에서 온다 — 한쪽만 있는 코스가 없어야 분포가 실제와 같다 */
  it('좌표가 있는 코스가 이미지도 갖는다', () => {
    for (const course of body('').courses) {
      expect(course.lat !== null).toBe(course.firstImage !== null)
    }
  })

  /**
   * **`durationMaxMinutes` 가 응답에 있다** (#718). 전에는 서버가 필터에만 써서 mock 이
   * 떨어뜨렸고 이 테스트가 그 부재를 계약으로 고정했다 — #735 가 뒤집은 전제다.
   */
  it('durationMaxMinutes 를 항목에 싣는다', () => {
    for (const course of body('').courses) {
      expect(course).toHaveProperty('durationMaxMinutes')
    }
  })

  /**
   * 상세에만 `fitsActivityLevels` 가 있다 — 목록은 이미 활동량으로 걸러 내려가므로 항목마다
   * 같은 판정을 반복하면 응답만 부푼다 (`WalkCoursePresenter.toItem` 주석).
   */
  it('적합 활동량 목록은 상세에만 있다', () => {
    const detail = resolveMock('/walk-courses/6911167100216303304', 'GET', '', null)?.payload
      .dataBody as WalkCourseDetail

    expect(detail.fitsActivityLevels.length).toBeGreaterThan(0)
    // 서버 enum metadata 를 그대로 낸다 — code 만 내면 화면이 한국어 표를 만들게 된다
    expect(detail.fitsActivityLevels[0]).toHaveProperty('name')

    for (const course of body('').courses) {
      expect(course).not.toHaveProperty('fitsActivityLevels')
    }
  })
})

describe('산책 코스 mock — 활동량 필터 (S4-1)', () => {
  /**
   * **`appliedPetActivityLevel` 은 파라미터 유무로 정한다** (`WalkCoursePresenter.java:20`).
   * 결과가 줄었는지로 판정하면 `HIGH` 가 null 이 되어, 화면이 응답을 믿는 규칙을
   * mock 에서 검증할 수 없다.
   */
  it('파라미터가 없으면 적용 객체 자체가 null 이다', () => {
    expect(body('').appliedPetActivityLevel).toBeNull()
  })

  /** deprecated 필드는 내지 않는다 — 화면이 새 필드만 읽는다 (#735) */
  it('petActivityLevelApplied 를 내지 않는다', () => {
    expect(body('?petActivityLevel=LOW')).not.toHaveProperty('petActivityLevelApplied')
  })

  it('LOW 는 4시간 초과 코스를 걸러 내고 적용 객체를 준다', () => {
    const result = body('?petActivityLevel=LOW')

    expect(result.appliedPetActivityLevel?.level.code).toBe('LOW')
    expect(result.courses.length).toBeLessThan(body('').courses.length)
  })

  /**
   * **상한을 숫자로 내린다** — 화면이 4시간·6시간을 제 상수로 적지 않게 하려고 #718 이
   * 실은 값이다 (`WalkCourseActivityFit.maxMinutesOf`).
   */
  it('적용된 상한을 분으로 함께 내린다', () => {
    expect(body('?petActivityLevel=LOW').appliedPetActivityLevel?.maxDurationMinutes).toBe(240)
    expect(body('?petActivityLevel=MEDIUM').appliedPetActivityLevel?.maxDurationMinutes).toBe(360)
  })

  /** `level.description` 은 **반려견 성향** 문구다 — 소요시간 상한이 아니다 */
  it('활동량 metadata 를 서버 문구 그대로 낸다', () => {
    const level = body('?petActivityLevel=LOW').appliedPetActivityLevel?.level

    expect(level?.name).toBe('낮음')
    expect(level?.description).toContain('짧은 산책')
  })

  it('MEDIUM 은 LOW 보다 넓다', () => {
    expect(body('?petActivityLevel=MEDIUM').courses.length).toBeGreaterThan(
      body('?petActivityLevel=LOW').courses.length,
    )
  })

  /**
   * **`HIGH` 는 결과가 필터 없음과 같은데 적용 객체만 선다.** 화면이 이 값을 보내지 않기로
   * 한 이유가 이것이고, mock 도 서버처럼 답해야 그 판단이 검증된다.
   *
   * **`maxDurationMinutes: null` 은 "상한 없음" 이다** — 객체가 통째로 null 인 것(필터
   * 미적용)과 뜻이 다르다. 화면이 그 둘을 가르는지 로컬에서 볼 수 있어야 한다.
   */
  it('HIGH 는 결과가 필터 없음과 같은데 적용 객체만 선다', () => {
    const high = body('?petActivityLevel=HIGH')

    expect(high.courses.length).toBe(body('').courses.length)
    expect(high.appliedPetActivityLevel?.level.code).toBe('HIGH')
    expect(high.appliedPetActivityLevel?.maxDurationMinutes).toBeNull()
  })

  /**
   * **소요시간을 모르는 코스는 어느 활동량에서도 걸러지지 않는다**
   * ([#748](https://github.com/8llow8llowMe/hondigagae/issues/748) · `WalkCourseActivityFit.fits`).
   * 목에 `20코스` 가 없던 동안에는 상세의 모르는 갈래를 로컬에서 한 번도 볼 수 없었다.
   */
  it('소요시간을 모르는 코스가 LOW 결과에 남는다', () => {
    const { courses } = body('?petActivityLevel=LOW')

    expect(courses.some((course) => course.durationMaxMinutes === null)).toBe(true)
  })

  /**
   * **뒤집힌 단언이다** ([#767](https://github.com/8llow8llowMe/hondigagae/issues/767)). 재적재
   * 전에는 `LOW` 를 걸면 좌표 있는 코스가 **하나도** 남지 않아, 활동량이 낮은 아이의
   * 보호자는 골든타임을 한 번도 볼 수 없었다(D8-2). 실측 29/29 뒤에는 `LOW` 통과 6개가
   * **전부 좌표를 갖는다** — fixture 도 같은 모양이어야 로컬이 실제와 같은 말을 한다.
   */
  it('LOW 결과에 좌표 있는 코스가 남는다 — 실데이터 분포 그대로다', () => {
    const { courses } = body('?petActivityLevel=LOW')

    expect(courses.length).toBeGreaterThan(0)
    expect(courses.some((course) => course.lat !== null)).toBe(true)
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
    expect(result?.payload.dataHeader).toMatchObject({
      resultCode: 'WALKCOURSE_113',
      resultMessage: 'walkCourseId 파라미터 형식이 올바르지 않습니다.',
      fieldErrors: [
        {
          code: 'WALKCOURSE_113',
          field: 'walkCourseId',
          message: 'walkCourseId 파라미터 형식이 올바르지 않습니다.',
        },
      ],
    })
  })

  /**
   * **소요시간을 모르는 코스(20코스)는 세 값을 다 받는다** (#748). 그것이 "아무 아이나
   * 걷는다" 가 아니라 **"모른다"** 라는 것이 상세 화면의 갈래이고, `length` 로는 그 둘을
   * 가를 수 없다는 사실을 목이 보여 준다.
   */
  it('소요시간을 모르는 코스는 적합 활동량 세 값을 다 준다', () => {
    const detail = resolveMock('/walk-courses/6911167100216303320', 'GET', '', null)?.payload
      .dataBody as WalkCourseDetail

    expect(detail.durationMaxMinutes).toBeNull()
    expect(detail.fitsActivityLevels.map((level) => level.name)).toEqual(['낮음', '보통', '높음'])
  })

  it('상세는 baseDate 와 providerName 을 더한다', () => {
    const result = resolveMock('/walk-courses/6911167100216303304', 'GET', '', null)
    const detail = result?.payload.dataBody as WalkCourseDetail

    expect(detail.baseDate).toBe('2025-04-28')
    expect(detail.providerName.length).toBeGreaterThan(0)
  })
})

import { describe, expect, it } from 'vitest'

import { walkCourseActivityFit } from '@/lib/walk-course/activity-fit'
import {
  ACTIVITY_LEVEL_HIGH,
  ACTIVITY_LEVEL_MEDIUM,
  ACTIVITY_LEVELS_ALL,
} from '@/test/fixtures/walk-course'

/**
 * 걸을 만한 활동량의 갈래 판정 — `코스상세-세부명세.md` D5-3 · D7.
 *
 * **판정자가 `durationMaxMinutes` 하나라는 사실을 고정한다.** `fitsActivityLevels.length`
 * 로 가르면 120분짜리 코스(10-1코스)가 "모른다" 로 떨어진다 — 서버 `fits` 가 `LOW ≤ 240분`
 * 이라 짧은 코스도 세 값을 받기 때문이다.
 */
const KNOWN_TWO = [ACTIVITY_LEVEL_MEDIUM, ACTIVITY_LEVEL_HIGH]

describe('walkCourseActivityFit — 아는 갈래', () => {
  it('300분 코스는 아는 갈래이고 이름을 · 로 잇는다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: 300,
      fitsActivityLevels: KNOWN_TWO,
    })

    expect(fit).toEqual({ kind: 'known', levels: '보통 · 높음' })
  })

  /**
   * **필수 회귀** — `length === 3` 을 "모른다" 로 읽으면 이 테스트가 깨진다.
   * 10-1코스(`durationMaxMinutes: 120`)는 짧아서 세 값을 다 받는다 — 모르는 것이 아니라
   * **정말 아무 아이나 걸을 만한 코스**다.
   */
  it('120분 코스는 세 값을 받아도 아는 갈래다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: 120,
      fitsActivityLevels: ACTIVITY_LEVELS_ALL,
    })

    expect(fit).toEqual({ kind: 'known', levels: '낮음 · 보통 · 높음' })
  })

  it('한 값이면 그 이름 하나가 그대로 나온다 — 구분자가 붙지 않는다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: 420,
      fitsActivityLevels: [ACTIVITY_LEVEL_HIGH],
    })

    expect(fit).toEqual({ kind: 'known', levels: '높음' })
  })

  /**
   * **서버 `name` 만 잇는다.** `code`(`LOW`·`MEDIUM`·`HIGH`)가 결과에 섞이면 FE 가 코드를
   * 렌더하고 있다는 뜻이고, 그 다음 수순은 한국어 매핑 테이블이다
   * (`api-integration-guide.md` §6 — 절대 규칙).
   */
  it('code 는 결과에 없다 — FE 매핑 테이블이 설 자리를 막는다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: 300,
      fitsActivityLevels: ACTIVITY_LEVELS_ALL,
    })

    const levels = fit?.kind === 'known' ? fit.levels : ''

    expect(levels.length).toBeGreaterThan(0)
    for (const level of ACTIVITY_LEVELS_ALL) {
      expect(levels).not.toContain(level.code)
    }
  })

  /** 서버가 이름을 바꾸면 화면이 따라간다 — 화면이 제 표를 갖고 있지 않다는 단언이다 */
  it('서버가 준 이름을 그대로 쓴다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: 300,
      fitsActivityLevels: [{ ...ACTIVITY_LEVEL_MEDIUM, name: '보통(테스트)' }],
    })

    expect(fit).toEqual({ kind: 'known', levels: '보통(테스트)' })
  })
})

describe('walkCourseActivityFit — 모르는 갈래', () => {
  /** **필수** — 20코스. 세 값이 담긴 것은 "아무 아이나" 가 아니라 "모른다" 는 뜻이다 */
  it('durationMaxMinutes 가 null 이면 세 값이 와도 모르는 갈래다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: null,
      fitsActivityLevels: ACTIVITY_LEVELS_ALL,
    })

    expect(fit).toEqual({ kind: 'unknown' })
  })

  /** `durationMaxMinutes` 가 **단독 판정자**다 — 배열 길이가 무엇이든 갈래가 같다 */
  it('durationMaxMinutes 가 null 이면 두 값이 와도 모르는 갈래다', () => {
    const fit = walkCourseActivityFit({
      durationMaxMinutes: null,
      fitsActivityLevels: KNOWN_TWO,
    })

    expect(fit).toEqual({ kind: 'unknown' })
  })

  /** `0` 은 값이 있는 것이다 — falsy 로 판정하면 모르는 갈래로 샌다 */
  it('durationMaxMinutes 가 0 이면 아는 갈래다', () => {
    expect(walkCourseActivityFit({ durationMaxMinutes: 0, fitsActivityLevels: KNOWN_TWO })).toEqual(
      {
        kind: 'known',
        levels: '보통 · 높음',
      },
    )
  })
})

describe('walkCourseActivityFit — 빈 배열은 줄을 그리지 않는다', () => {
  /**
   * 계약상 오지 않는다(`HIGH` 는 상한이 없어 항상 통과한다). 그래도 방어한다 — 빈 배열을
   * 모르는 갈래로 흘려보내면 **계약이 깨진 응답이 이 코스의 사실처럼 그려진다.**
   */
  it('소요시간을 알아도 null 이다', () => {
    expect(walkCourseActivityFit({ durationMaxMinutes: 300, fitsActivityLevels: [] })).toBeNull()
  })

  it('소요시간을 몰라도 null 이다 — 모르는 갈래 문장으로 새지 않는다', () => {
    expect(walkCourseActivityFit({ durationMaxMinutes: null, fitsActivityLevels: [] })).toBeNull()
  })
})

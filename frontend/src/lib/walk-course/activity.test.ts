import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_MAX_HOURS,
  representativePet,
  resolveActivityParam,
} from '@/lib/walk-course/activity'
import type { Pet } from '@/types/pet'

function pet(petId: string, activityCode: string, representative = false): Pet {
  return {
    petId,
    name: `아이${petId}`,
    breed: '말티즈',
    birthYm: '2022-04',
    age: 4,
    sizeType: { code: 'SMALL', name: '소형견' },
    weightKg: null,
    profileImageUrl: null,
    representative,
    heatSensitive: false,
    coldSensitive: false,
    noiseSensitive: false,
    activityLevel: { code: activityCode, name: activityCode === 'LOW' ? '낮음' : '보통' },
    walkPreferred: true,
    sociality: { code: 'HIGH', name: '높음' },
  }
}

/**
 * 활동량 파라미터를 채우는 규칙 — 공통명세 S4-1.
 *
 * **URL 이 정본이고, 비어 있을 때만 대표견으로 채운다.** 여기서 틀리면 두 방향으로 샌다:
 * 덜 채우면 활동량 필터가 아예 안 걸리고, 더 채우면 사용자가 끈 조건이 되살아난다.
 */
describe('resolveActivityParam — URL 이 값을 가지면 그대로 쓴다', () => {
  it('LOW 는 그대로 보낸다', () => {
    expect(resolveActivityParam('LOW', [pet('1', 'HIGH', true)])).toBe('LOW')
  })

  it('MEDIUM 은 그대로 보낸다', () => {
    expect(resolveActivityParam('MEDIUM', [pet('1', 'LOW', true)])).toBe('MEDIUM')
  })

  /**
   * `ALL` 은 "자동 채움을 껐다" 는 **명시 값**이다. 대표견이 `LOW` 여도 덮어쓰지 않는다 —
   * 덮어쓰면 필터를 끄는 순간 다시 켜져 전체 코스를 볼 방법이 사라진다.
   */
  it('ALL 은 파라미터를 보내지 않는다', () => {
    expect(resolveActivityParam('ALL', [pet('1', 'LOW', true)])).toBeNull()
  })
})

describe('resolveActivityParam — URL 이 비면 대표견으로 채운다', () => {
  it('대표견이 LOW 면 LOW 를 보낸다', () => {
    expect(resolveActivityParam(null, [pet('1', 'MEDIUM'), pet('2', 'LOW', true)])).toBe('LOW')
  })

  it('대표견이 MEDIUM 이면 MEDIUM 을 보낸다', () => {
    expect(resolveActivityParam(null, [pet('1', 'MEDIUM', true)])).toBe('MEDIUM')
  })

  /**
   * **`HIGH` 는 보내지 않는다** (규칙 3). 결과가 필터 없음과 같은데(실측 29/29) 보내면
   * `petActivityLevelApplied: true` 가 와서 화면이 좁히지도 않은 것을 좁혔다고 말한다.
   */
  it('대표견이 HIGH 면 파라미터를 보내지 않는다', () => {
    expect(resolveActivityParam(null, [pet('1', 'HIGH', true)])).toBeNull()
  })

  it('대표견이 없고 아이가 여럿이면 첫 아이의 활동량을 쓴다', () => {
    expect(resolveActivityParam(null, [pet('1', 'LOW'), pet('2', 'MEDIUM')])).toBe('LOW')
  })

  /** 모르는 코드를 그대로 보내면 400(`WALKCOURSE_113`)이 된다 — 조용히 폴백한다 */
  it('모르는 활동량 코드는 파라미터를 보내지 않는다', () => {
    expect(resolveActivityParam(null, [pet('1', 'EXTREME', true)])).toBeNull()
  })
})

describe('resolveActivityParam — 폴백 (공개 API 라 목록은 그대로 뜬다)', () => {
  /** 미로그인·펫 조회 실패 둘 다 `null` 로 들어온다 — 호출부가 분기를 새로 만들지 않는다 */
  it('반려견 목록이 null 이면 파라미터를 보내지 않는다', () => {
    expect(resolveActivityParam(null, null)).toBeNull()
  })

  it('반려견이 한 마리도 없으면 파라미터를 보내지 않는다', () => {
    expect(resolveActivityParam(null, [])).toBeNull()
  })
})

describe('representativePet — 대표견, 없으면 첫 아이', () => {
  it('representative 가 참인 아이를 고른다', () => {
    const pets = [pet('1', 'LOW'), pet('2', 'MEDIUM', true)]

    expect(representativePet(pets)?.petId).toBe('2')
  })

  it('대표 지정이 없으면 첫 아이다', () => {
    expect(representativePet([pet('1', 'LOW'), pet('2', 'MEDIUM')])?.petId).toBe('1')
  })

  it('목록이 비면 null 이다', () => {
    expect(representativePet([])).toBeNull()
  })
})

/**
 * **상한 숫자는 FE 문자열이다** (`코스목록-세부명세.md` D5-2 · D9-1). 응답에 상한도 활동량
 * metadata 도 없어 화면이 `4`·`6` 을 스스로 적는다. 값이 한 곳에 있다는 것만 여기서 잠근다.
 */
describe('ACTIVITY_MAX_HOURS — 서버 상한의 복제본', () => {
  it('LOW 는 4시간 · MEDIUM 은 6시간이다 (WalkCourseActivityFit.java:22-23)', () => {
    expect(ACTIVITY_MAX_HOURS.LOW).toBe(4)
    expect(ACTIVITY_MAX_HOURS.MEDIUM).toBe(6)
  })
})

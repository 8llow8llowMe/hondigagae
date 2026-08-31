import { describe, expect, it } from 'vitest'

import {
  type AccountState,
  canChangePassword,
  canRemovePassword,
  canSetupPassword,
  toAccountState,
} from '@/lib/member/account-state'
import { providerName } from '@/lib/member/provider'

/**
 * 계정 상태 판정 — 공통명세 S2 / 마이페이지-세부명세 D7.
 *
 * `MemberMyInfoResponse.hasPassword` 의 스키마 설명이 조합을 못박아 뒀다.
 * 이 표가 어긋나면 소셜 계정 사용자에게 "현재 비밀번호" 를 묻는 폼이 나간다.
 */
describe('toAccountState — provider × hasPassword', () => {
  it('provider 가 없고 비밀번호가 있으면 일반 계정이다', () => {
    expect(toAccountState({ provider: null, hasPassword: true })).toBe('general')
  })

  it('소셜이 연결됐고 비밀번호가 없으면 소셜 전용이다', () => {
    expect(toAccountState({ provider: 'KAKAO', hasPassword: false })).toBe('social-only')
  })

  it('소셜이 연결됐고 비밀번호도 있으면 연결됨이다', () => {
    expect(toAccountState({ provider: 'KAKAO', hasPassword: true })).toBe('linked')
  })

  it('provider 도 비밀번호도 없으면 판별 불가다 — 나올 수 없는 조합이라 서버 결함이다', () => {
    expect(toAccountState({ provider: null, hasPassword: false })).toBe('unknown')
  })

  it('빈 문자열 provider 를 "연결됨" 으로 읽지 않는다', () => {
    // 서버가 null 대신 '' 를 내려도 계정 상태 판정이 뒤집히면 안 된다.
    // `''` 를 연결로 보면 일반 계정에 소셜 전용 전환 버튼이 나간다
    expect(toAccountState({ provider: '', hasPassword: true })).toBe('general')
  })
})

describe('계정 상태별로 제시할 수 있는 동작', () => {
  const CASES: Record<AccountState, { change: boolean; setup: boolean; remove: boolean }> = {
    general: { change: true, setup: false, remove: false },
    'social-only': { change: false, setup: true, remove: false },
    linked: { change: true, setup: false, remove: true },
    unknown: { change: false, setup: false, remove: false },
  }

  it.each(Object.keys(CASES) as AccountState[])('%s 상태의 동작 조합이 명세와 같다', (state) => {
    const expected = CASES[state]

    expect(canChangePassword(state)).toBe(expected.change)
    expect(canSetupPassword(state)).toBe(expected.setup)
    expect(canRemovePassword(state)).toBe(expected.remove)
  })

  /**
   * D5 의 "판별 불가 상태에서 동작 버튼이 하나도 나오지 않는다" 를 논리 수준에서 고정한다.
   * 화면 쪽 확인은 `AccountSection` 렌더 테스트(비밀번호 행 부재)가 맡는다 —
   * `PasswordView` 는 React Query hook 을 써서 node 환경에서 렌더되지 않는다
   * (docs/testing-guide.md §1).
   */
  it('판별 불가에서는 세 동작이 모두 불가하다 — 빈 화면이 아니라 안내만 낸다', () => {
    expect(canChangePassword('unknown')).toBe(false)
    expect(canSetupPassword('unknown')).toBe(false)
    expect(canRemovePassword('unknown')).toBe(false)
  })

  it('일반 계정은 비밀번호를 제거할 수 없다 — 마지막 로그인 수단이 사라진다', () => {
    // 백엔드도 MEMBER_009 로 막는다. 화면이 먼저 막지 않으면 서버 오류로 알게 된다
    expect(canRemovePassword('general')).toBe(false)
  })
})

describe('providerName — 표시명 매핑과 폴백', () => {
  it('아는 값은 한국어 표시명으로 바꾼다', () => {
    expect(providerName('KAKAO')).toBe('카카오')
    expect(providerName('NAVER')).toBe('네이버')
  })

  it('모르는 값은 원문을 그대로 쓴다 — 빈칸을 내지 않는다', () => {
    // 백엔드에 제공자가 늘면 이 표가 먼저 낡는다. 그때 문장이 깨지면 안 된다
    expect(providerName('GOOGLE')).toBe('GOOGLE')
  })

  it('일반 계정(null)은 null 이다 — 호출부가 "연결됨" 문장을 짓지 않게 한다', () => {
    expect(providerName(null)).toBeNull()
  })

  it('빈 문자열도 null 로 다룬다 — "로 연결됨" 같은 문장이 만들어지지 않게 한다', () => {
    expect(providerName('   ')).toBeNull()
  })

  /**
   * 표를 객체 리터럴로 두면 상속된 멤버가 값처럼 반환된다 — `'toString'` 은 함수라
   * 표시명 자리에 함수가 들어간다. `Map` 이라 폴백(원문 그대로)으로 떨어져야 한다.
   */
  it('프로토타입 키를 값으로 착각하지 않는다', () => {
    expect(providerName('toString')).toBe('toString')
    expect(providerName('__proto__')).toBe('__proto__')
  })
})

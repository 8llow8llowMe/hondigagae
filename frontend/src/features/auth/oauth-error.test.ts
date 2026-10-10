import { describe, expect, it } from 'vitest'

import { oauthNextAction } from '@/features/auth/oauth-error'

describe('oauthNextAction — 오류 코드를 다음 행동으로만 가른다', () => {
  it('동의·인증이 필요한 셋은 제공자 쪽 조치다', () => {
    expect(oauthNextAction('AUTH_009')).toBe('consent')
    expect(oauthNextAction('AUTH_011')).toBe('consent')
    expect(oauthNextAction('AUTH_012')).toBe('consent')
  })

  it('이미 다른 소셜로 가입된 계정은 그 소셜로 로그인해야 한다', () => {
    // 같은 소셜을 다시 눌러도 결과가 같으므로 "다시 시도" 로 안내하면 안 된다
    expect(oauthNextAction('AUTH_008')).toBe('signin')
  })

  /*
    **우리 쪽 가입 동의는 제공자 동의와 다른 행동이다** (#688). `consent` 로 합치면
    화면이 "제공자 동의 화면에서 켜고 다시 시도" 로 안내하는데, 켤 곳은 우리 회원가입
    화면의 체크박스다.
  */
  it('가입 동의 누락은 회원가입 화면으로 보내야 한다', () => {
    expect(oauthNextAction('MEMBER_010')).toBe('signup-consent')
    expect(oauthNextAction('MEMBER_011')).toBe('signup-consent')
  })

  it('나머지는 처음부터 다시다', () => {
    expect(oauthNextAction('AUTH_007')).toBe('retry')
    expect(oauthNextAction('AUTH_010')).toBe('retry')
    expect(oauthNextAction('AUTH_013')).toBe('retry')
    expect(oauthNextAction('AUTH_014')).toBe('retry')
  })

  it('모르는 코드와 null 도 막다른 곳이 되지 않는다', () => {
    // 백엔드에 오류 코드가 늘어도 화면에 다음 행동이 사라지면 안 된다
    expect(oauthNextAction('AUTH_999')).toBe('retry')
    expect(oauthNextAction(null)).toBe('retry')
  })

  it('상속된 키를 참으로 읽지 않는다 — 표가 Set 인 이유', () => {
    // 객체 리터럴이면 'toString' 이 상속된 함수를 돌려줘 판정이 뒤집힌다
    expect(oauthNextAction('toString')).toBe('retry')
    expect(oauthNextAction('__proto__')).toBe('retry')
  })
})

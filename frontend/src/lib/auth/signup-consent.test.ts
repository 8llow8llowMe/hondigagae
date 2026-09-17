import { describe, expect, it } from 'vitest'

import {
  consentCodeTargets,
  hasConsentErrors,
  isSignupConsentCode,
  isSignupConsentComplete,
  NO_SIGNUP_CONSENT,
  SIGNUP_CONSENT_KEYS,
  type SignupConsent,
  toConsentErrors,
} from '@/lib/auth/signup-consent'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'

const ALL_AGREED: SignupConsent = {
  termsAgreed: true,
  privacyAgreed: true,
  ageOver14Confirmed: true,
}

describe('isSignupConsentComplete — 소셜 버튼의 활성 조건', () => {
  it('셋 다 켜져야 true 다', () => {
    expect(isSignupConsentComplete(ALL_AGREED)).toBe(true)
  })

  /*
    하나씩 꺼 본다. `every` 를 `some` 으로 잘못 고치면 **두 개만 켜도 소셜 버튼이 열리고**,
    그 요청은 콜백에서야 MEMBER_010/011 로 거부된다 — 인가코드를 이미 태운 뒤라 되돌릴 수 없다.
  */
  for (const key of SIGNUP_CONSENT_KEYS) {
    it(`${key} 가 꺼져 있으면 false 다`, () => {
      expect(isSignupConsentComplete({ ...ALL_AGREED, [key]: false })).toBe(false)
    })
  }

  it('기본값은 아무것도 동의하지 않은 상태다', () => {
    expect(isSignupConsentComplete(NO_SIGNUP_CONSENT)).toBe(false)
  })
})

describe('consentCodeTargets — 필드 없는 오류를 체크박스로 되돌린다', () => {
  it('MEMBER_010 은 문서 동의 두 개를 가리킨다 — 서버가 둘을 구분하지 않는다', () => {
    expect(consentCodeTargets('MEMBER_010')).toEqual(['termsAgreed', 'privacyAgreed'])
  })

  it('MEMBER_011 은 연령 확인만 가리킨다 — MEMBER_010 과 합치면 강조할 곳을 잃는다', () => {
    expect(consentCodeTargets('MEMBER_011')).toEqual(['ageOver14Confirmed'])
  })

  it('모르는 코드와 null 은 비어 있다', () => {
    expect(consentCodeTargets('MEMBER_001')).toEqual([])
    expect(consentCodeTargets(null)).toEqual([])
  })

  /* 객체 리터럴 조회였다면 상속 키가 참을 돌려준다 — 서버 문자열을 키로 쓰는 자리다 */
  it('상속 키를 코드로 착각하지 않는다', () => {
    expect(isSignupConsentCode('toString')).toBe(false)
    expect(isSignupConsentCode('constructor')).toBe(false)
  })
})

describe('toConsentErrors — 동의 블록이 그릴 오류', () => {
  it('MEMBER_115/116/117 은 field 로 이미 갈려 와서 그대로 옮긴다', () => {
    const errors = toConsentErrors(
      {
        fields: {
          termsAgreed: '이용약관에 동의해야 가입할 수 있습니다.',
          ageOver14Confirmed: '만 14세 이상만 가입할 수 있습니다.',
        },
        form: null,
      },
      'MEMBER_115',
      NO_SIGNUP_CONSENT,
    )

    expect(errors.fields.termsAgreed).toBe('이용약관에 동의해야 가입할 수 있습니다.')
    expect(errors.fields.ageOver14Confirmed).toBe('만 14세 이상만 가입할 수 있습니다.')
  })

  it('동의와 무관한 필드 오류는 가져오지 않는다 — 비밀번호 오류가 체크박스에 붙으면 안 된다', () => {
    const errors = toConsentErrors(
      { fields: { password: '비밀번호는 필수입니다.' }, form: null },
      'MEMBER_103',
      NO_SIGNUP_CONSENT,
    )

    expect(errors.fields).toEqual({})
  })

  it('MEMBER_010 은 아직 켜지 않은 문서 동의에만 붙는다', () => {
    const errors = toConsentErrors(
      { fields: {}, form: '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.' },
      'MEMBER_010',
      { termsAgreed: true, privacyAgreed: false, ageOver14Confirmed: true },
    )

    // 이미 켠 항목에 "동의해야 한다" 를 붙이면 "다 했는데 왜 안 되지" 가 된다
    expect(errors.fields.termsAgreed).toBeUndefined()
    expect(errors.fields.privacyAgreed).toBe(
      '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.',
    )
  })

  it('후보가 전부 켜져 있으면 후보 전체에 붙인다 — 문구가 사라지는 것이 가장 나쁘다', () => {
    const errors = toConsentErrors(
      { fields: {}, form: '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.' },
      'MEMBER_010',
      ALL_AGREED,
    )

    expect(Object.keys(errors.fields).sort()).toEqual(['privacyAgreed', 'termsAgreed'])
  })

  it('MEMBER_011 은 연령 체크박스에 붙는다', () => {
    const errors = toConsentErrors(
      { fields: {}, form: '만 14세 이상만 가입할 수 있습니다.' },
      'MEMBER_011',
      { termsAgreed: true, privacyAgreed: true, ageOver14Confirmed: false },
    )

    expect(errors.fields.ageOver14Confirmed).toBe('만 14세 이상만 가입할 수 있습니다.')
  })

  /* 폼 전체 오류는 단계 컴포넌트의 FormAlert 몫이다 — 여기서 또 그리면 두 번 보인다 */
  it('form 은 항상 null 이다', () => {
    expect(
      toConsentErrors({ fields: {}, form: '이미 가입된 이메일입니다.' }, 'MEMBER_001', ALL_AGREED)
        .form,
    ).toBeNull()
  })

  it('동의와 무관한 실패에서는 아무것도 남기지 않는다', () => {
    const errors = toConsentErrors(
      { fields: {}, form: '이미 가입된 이메일입니다.' },
      'MEMBER_001',
      ALL_AGREED,
    )

    expect(hasConsentErrors(errors)).toBe(false)
  })
})

describe('hasConsentErrors — FormAlert 를 끌지 판정한다', () => {
  it('오류가 없으면 false 다', () => {
    expect(hasConsentErrors(NO_FORM_ERRORS)).toBe(false)
  })

  it('동의 외 필드만 있으면 false 다', () => {
    expect(hasConsentErrors({ fields: { password: '비밀번호는 필수입니다.' }, form: null })).toBe(
      false,
    )
  })

  it('동의 필드가 하나라도 있으면 true 다', () => {
    expect(hasConsentErrors({ fields: { privacyAgreed: '동의가 필요합니다.' }, form: null })).toBe(
      true,
    )
  })
})

import type { FormErrors } from '@/lib/form/field-errors'

/**
 * 가입 동의·만 14세 확인 — 이슈 #688 (백엔드 #607 · #608).
 *
 * **일반 가입과 소셜 최초 연동이 같은 값을 쓴다.** 일반 가입은 요청 바디로(필수),
 * 소셜은 `/authorize` 쿼리로(선택, 기본 false) 실린다. 한쪽만 고치면 두 입구가
 * 서로 다른 동의를 받게 되므로 타입을 하나로 둔다.
 *
 * **소셜은 동의를 `/authorize` 단계에서 받는다.** OAuth 인가코드는 1회용이라
 * 콜백에서 거부하면 되돌릴 방법이 없다 — 사용자가 제공자 인가 화면부터 다시 밟아야
 * 한다 (`AuthWebController.generateOAuthAuthorizationUrl` 설명).
 */
export type SignupConsent = {
  /** 이용약관 동의. 일반 가입에서 false 면 `MEMBER_115` */
  termsAgreed: boolean
  /** 개인정보 처리방침 동의. 일반 가입에서 false 면 `MEMBER_116` */
  privacyAgreed: boolean
  /** 만 14세 이상 자기확인. 일반 가입에서 false 면 `MEMBER_117` */
  ageOver14Confirmed: boolean
}

/**
 * 화면에 세우는 순서이자 요청 DTO(`MemberGeneralSignupRequest`)의 선언 순서다.
 * 백엔드가 그 순서로 검증 오류를 정렬하므로(`ValidationErrorSupport`), 여기가
 * 어긋나면 "첫 오류" 가 화면과 서버에서 다른 항목을 가리킨다.
 */
export const SIGNUP_CONSENT_KEYS = ['termsAgreed', 'privacyAgreed', 'ageOver14Confirmed'] as const

export type SignupConsentKey = (typeof SIGNUP_CONSENT_KEYS)[number]

/** 아무것도 동의하지 않은 상태. 화면 진입 기본값이다 */
export const NO_SIGNUP_CONSENT: SignupConsent = {
  termsAgreed: false,
  privacyAgreed: false,
  ageOver14Confirmed: false,
}

/** 셋 다 true 인가. 소셜 버튼의 활성 조건이다 */
export function isSignupConsentComplete(consent: SignupConsent): boolean {
  return SIGNUP_CONSENT_KEYS.every((key) => consent[key])
}

/**
 * 필드 없는 동의 오류 코드가 가리키는 **체크박스 후보**.
 *
 * `MEMBER_115/116/117` 은 web 경계의 `@AssertTrue` 라 `field` 가 함께 오지만,
 * `MEMBER_010`(문서 동의 누락) · `MEMBER_011`(만 14세 미확인)은 프로세서가 던지는
 * 도메인 예외라 `field` 가 없다. **코드로 갈라야 어느 체크박스인지 알 수 있다.**
 *
 * `MEMBER_010` 이 두 개를 돌려주는 것은 서버가 둘을 구분하지 않기 때문이다 —
 * `validateSignupConsent` 는 `termsAgreed` 와 `privacyAgreed` 중 하나라도 비면
 * 같은 코드를 던진다.
 *
 * `Set`·`Map` 이 아니라 분기인 이유는 값이 둘뿐이고, 반환이 "키 목록" 이라
 * 조회 테이블로 만들면 상속 키(`toString`) 문제만 새로 생기기 때문이다.
 */
export function consentCodeTargets(resultCode: string | null): readonly SignupConsentKey[] {
  if (resultCode === 'MEMBER_010') return ['termsAgreed', 'privacyAgreed']
  if (resultCode === 'MEMBER_011') return ['ageOver14Confirmed']
  return []
}

/** 동의 때문에 막힌 실패인가. 소셜 콜백이 "회원가입에서 동의" 로 안내할 근거다 */
export function isSignupConsentCode(resultCode: string | null): boolean {
  return consentCodeTargets(resultCode).length > 0
}

/**
 * 서버 실패를 **동의 블록이 그릴 오류**로 접는다.
 *
 * 두 종류를 한 자리에 모은다:
 *  1. `MEMBER_115/116/117` — 이미 `fields` 에 항목별로 들어와 있다. 그대로 옮긴다.
 *  2. `MEMBER_010/011` — `fields` 가 비고 대표 메시지(`form`)만 온다. 코드가 가리키는
 *     체크박스에 그 문구를 건다.
 *
 * 2번에서 **아직 체크하지 않은 항목이 있으면 그것만 짚는다.** 사용자가 이미 켠
 * 체크박스에 "동의해야 가입할 수 있습니다" 를 붙이면 "다 했는데 왜 안 되지" 가 된다.
 * 후보가 전부 켜져 있는 경우(화면과 서버 상태가 어긋난 경우)에는 후보 전체에 건다 —
 * 어디에도 붙지 않아 문구가 사라지는 것이 가장 나쁘다.
 *
 * `form` 은 항상 `null` 이다. 폼 전체 오류는 단계 컴포넌트(`FormAlert`)의 몫이라
 * 여기서 또 그리면 같은 문구가 두 번 보인다.
 */
export function toConsentErrors(
  errors: FormErrors,
  resultCode: string | null,
  consent: SignupConsent,
): FormErrors {
  const fields: Record<string, string> = {}

  for (const key of SIGNUP_CONSENT_KEYS) {
    const message = errors.fields[key]
    if (message !== undefined) fields[key] = message
  }

  const targets = consentCodeTargets(resultCode)
  if (targets.length > 0 && errors.form !== null) {
    const unchecked = targets.filter((key) => !consent[key])
    for (const key of unchecked.length > 0 ? unchecked : targets) {
      fields[key] = errors.form
    }
  }

  return { fields, form: null }
}

/** 동의 블록이 오류를 들고 있는가. 들고 있으면 단계 컴포넌트의 FormAlert 를 끈다 */
export function hasConsentErrors(errors: FormErrors): boolean {
  return SIGNUP_CONSENT_KEYS.some((key) => errors.fields[key] !== undefined)
}

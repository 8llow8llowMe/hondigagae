import { type MockStore, mockStore, nextMemberId } from '@/lib/api/mock/store'
import { EMAIL_PATTERN } from '@/lib/form/email-pattern'
import { PASSWORD_PATTERN } from '@/lib/form/password-pattern'
import type { ApiResponse } from '@/types/api'

/**
 * 인증 mock.
 *
 * 근거: `AuthWebController` · `MemberWebController` · `AuthErrorCode` ·
 * `AuthValidationMessage` · `MemberErrorCode` · `MemberValidationMessage` ·
 * `PasswordResetProcessor` · `OAuthLoginProcessor` · `RedisOAuthStateStoreAdapter` ·
 * `ValidationErrorSupport` 소스 실측 (origin/develop, 2026-08-31).
 * **없는 API 를 만들지 않는다.**
 */

export type MockResult = {
  status: number
  payload: ApiResponse<unknown>
  /** 게이트웨이의 Set-Cookie 를 대신한다. 없으면 BFF 세션의 refresh 가 비어 재발급이 안 돈다 */
  refreshToken?: string
}

/** 개발용 고정 인증코드. 백엔드 예시(A3K7MP2X)와 같은 8자 영숫자 형태다 */
export const MOCK_EMAIL_CODE = 'A3K7MP2X'

/**
 * 비밀번호 재설정용 고정 코드. **회원가입 코드와 일부러 다르게 둔다** — 같은 값이면
 * 두 흐름이 서로의 코드로도 통과해 버려서, 발급처를 구분하지 못하는 mock 의 결함이
 * 테스트에 잡히지 않는다. 백엔드 예시(A2B3C4D5)와 같은 8자 영숫자 형태다.
 */
export const MOCK_PASSWORD_RESET_CODE = 'R7M2K9QX'

/**
 * 코드 검증 실패 상한. 백엔드 `PasswordResetProcessor.MAX_VERIFY_FAILURES` 와 같다.
 * **`failures >= MAX` 판정이라 5번째 불일치에서 AUTH_017 이 난다** (4번째까지는 AUTH_004).
 */
export const MAX_PASSWORD_RESET_FAILURES = 5

/**
 * mock 이 지원하는 소셜 제공자. 백엔드 `OAuthProvider` enum 과 같다.
 * 경로는 대소문자를 가리지 않는다 — `WebConfig` 가 `fromName` 컨버터를 등록해 뒀다.
 */
const OAUTH_PROVIDERS = new Map<string, string>([
  ['kakao', 'KAKAO'],
  ['naver', 'NAVER'],
])

/** provider 표시 이름. AUTH_008 문구가 이 값을 쓴다 (`OAuthProvider.description`) */
const OAUTH_PROVIDER_NAMES = new Map<string, string>([
  ['KAKAO', '카카오'],
  ['NAVER', '네이버'],
])

/**
 * 소셜 제공자가 돌려주는 프로필. mock 은 provider 별로 **고정 계정**을 쓴다.
 *
 *  - `kakao` → `social@` (provider KAKAO · 비밀번호 없음) — **소셜 전용 계정 로그인 경로.**
 *    #83 이 만든 `/mypage/password` 의 소셜 전용 분기를 브라우저로 확인하려면 이 계정에
 *    로그인할 수 있어야 한다. 이메일 로그인은 비밀번호가 없어 불가능하므로 여기가 유일한 문이다.
 *  - `naver` → 미가입 이메일 — **자동 회원가입 경로** (`OAuthLoginProcessor.createOAuthMember`).
 *
 * `code` 로 프로필을 바꿔 오류 시나리오를 만든다 (`oauthProfile` 참고).
 */
const OAUTH_PROFILE_EMAIL = new Map<string, string>([
  ['KAKAO', 'social@hondigagae.dev'],
  ['NAVER', 'naver@hondigagae.dev'],
])

/**
 * `code` 에 이 조각이 들어 있으면 해당 시나리오가 된다. 주소창에서 손으로 바꿔 쓴다.
 *
 * **`authorize` 가 시나리오를 받지 않는 이유**: 백엔드 계약에 그런 파라미터가 없다.
 * 없는 것을 mock 에 만들면 화면이 mock 에만 있는 입구에 의존하게 된다.
 */
const OAUTH_CODE_SCENARIOS = {
  /** AUTH_009 — 이메일 제공 미동의 */
  emailDenied: 'email-denied',
  /** AUTH_011 — 프로필(닉네임) 제공 미동의 */
  profileDenied: 'profile-denied',
  /** AUTH_012 — 제공자에서 이메일 미인증 */
  unverified: 'unverified',
  /** AUTH_014 — 제공자 통신 불가 */
  unavailable: 'unavailable',
  /**
   * 이미 다른 소셜로 가입된 계정을 물고 온다. `naver` 로 쓰면 `social@`(KAKAO)와
   * provider 가 어긋나 **AUTH_008 이 규칙대로 발생한다** — 응답을 손으로 박지 않는다.
   */
  linked: 'linked',
} as const

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: unknown): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

type FieldError = { code: string; field: string; message: string }

/** 백엔드 ValidationErrorBody 형태로 만든다 — 첫 오류가 대표 메시지다 */
function failValidation(errors: FieldError[]): MockResult {
  const first = errors[0]
  if (first === undefined) return fail(400, 'MEMBER_100', '요청 값이 올바르지 않습니다.')
  return fail(400, first.code, { message: first.message, errors })
}

function parse(body: string | null): Record<string, unknown> {
  if (body === null || body.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

// 이메일·비밀번호 정규식은 자체 정의하지 않고 FE 스키마와 공유하는 lib/form 의
// EMAIL_PATTERN · PASSWORD_PATTERN 을 그대로 쓴다. mock 이 FE 스키마보다 엄격하면
// 실제로는 통과할 이메일(`a@b`)이 mock 에서만 400 으로 거부되는 드리프트가 생긴다
// — 이슈 #24 최종 리뷰 I5.

/** 백엔드 정렬 순서를 흉내 낸다: DTO 선언 순서 → 필수 → 길이 → 형식 */
function validateSignup(values: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = []
  const email = text(values.email)
  const password = text(values.password)
  const name = text(values.name)
  const nickname = text(values.nickname)

  if (email.length === 0)
    errors.push({ code: 'MEMBER_101', field: 'email', message: '이메일은 필수입니다.' })
  else if (!EMAIL_PATTERN.test(email))
    errors.push({ code: 'MEMBER_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' })

  if (password.length === 0)
    errors.push({ code: 'MEMBER_103', field: 'password', message: '비밀번호는 필수입니다.' })
  else {
    if (password.length < 8 || password.length > 20)
      errors.push({
        code: 'MEMBER_104',
        field: 'password',
        message: '비밀번호는 8자 이상 20자 이하여야 합니다.',
      })
    if (!PASSWORD_PATTERN.test(password))
      errors.push({
        code: 'MEMBER_105',
        field: 'password',
        message: '비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.',
      })
  }

  if (name.length === 0)
    errors.push({ code: 'MEMBER_106', field: 'name', message: '이름은 필수입니다.' })
  else if (name.length > 10)
    errors.push({ code: 'MEMBER_107', field: 'name', message: '이름은 10자 이하만 가능합니다.' })

  if (nickname.length === 0)
    errors.push({ code: 'MEMBER_108', field: 'nickname', message: '닉네임은 필수입니다.' })
  else if (nickname.length > 10)
    errors.push({
      code: 'MEMBER_109',
      field: 'nickname',
      message: '닉네임은 10자 이하만 가능합니다.',
    })

  return errors
}

/**
 * 이메일 필수·형식 검증. `AuthValidationMessage` 의 AUTH_101 / AUTH_102 그대로다.
 * send-code · verify-code · password/reset 세 곳이 **같은 제약**을 쓴다.
 */
function validateEmail(email: string): MockResult | null {
  if (email.length === 0) {
    return failValidation([{ code: 'AUTH_101', field: 'email', message: '이메일은 필수입니다.' }])
  }
  if (!EMAIL_PATTERN.test(email)) {
    return failValidation([
      { code: 'AUTH_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' },
    ])
  }
  return null
}

/**
 * 재설정 요청 검증. **DTO 선언 순서(email → code → newPassword) → 필수 → 길이 → 형식**
 * 으로 모은다 — `ValidationErrorSupport` 의 정렬과 같아야 첫 오류(대표 메시지)가 어긋나지 않는다.
 */
function validatePasswordReset(values: Record<string, unknown>): FieldError[] {
  const errors: FieldError[] = []
  const email = text(values.email)
  const code = text(values.code)
  const newPassword = text(values.newPassword)

  if (email.length === 0)
    errors.push({ code: 'AUTH_101', field: 'email', message: '이메일은 필수입니다.' })
  else if (!EMAIL_PATTERN.test(email))
    errors.push({ code: 'AUTH_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' })

  if (code.length === 0)
    errors.push({ code: 'AUTH_104', field: 'code', message: '인증코드는 필수입니다.' })

  if (newPassword.length === 0)
    errors.push({ code: 'AUTH_106', field: 'newPassword', message: '새 비밀번호는 필수입니다.' })
  else {
    if (newPassword.length < 8 || newPassword.length > 20)
      errors.push({
        code: 'AUTH_107',
        field: 'newPassword',
        message: '비밀번호는 8자 이상 20자 이하여야 합니다.',
      })
    if (!PASSWORD_PATTERN.test(newPassword))
      errors.push({
        code: 'AUTH_108',
        field: 'newPassword',
        message: '비밀번호는 공백 없이 영문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.',
      })
  }

  return errors
}

/** 로그인 성공 응답. 일반 로그인과 소셜 로그인이 **같은 모양**이다 (`AuthGeneralLoginResponse`) */
function loginSuccess(memberId: string): MockResult {
  return {
    status: 200,
    payload: ok({ accessToken: `mock-access-${memberId}`, memberId }),
    refreshToken: `mock-refresh-${memberId}`,
  }
}

/**
 * `code` 에서 소셜 프로필을 만든다. 오류 시나리오는 여기서 **프로필 결함**으로 표현하고,
 * 판정은 아래 `oauthLogin` 이 백엔드와 같은 규칙으로 한다.
 */
function oauthProfile(
  provider: string,
  code: string,
): { email: string; nickname: string; emailVerified: boolean } {
  const email = code.includes(OAUTH_CODE_SCENARIOS.linked)
    ? (OAUTH_PROFILE_EMAIL.get('KAKAO') as string)
    : (OAUTH_PROFILE_EMAIL.get(provider) ?? '')

  return {
    // 미동의는 "값이 비어서 온다" 로 재현한다 — 백엔드 validateRequiredProfile 과 같은 신호다
    email: code.includes(OAUTH_CODE_SCENARIOS.emailDenied) ? '' : email,
    nickname: code.includes(OAUTH_CODE_SCENARIOS.profileDenied) ? '' : '소셜이',
    emailVerified: !code.includes(OAUTH_CODE_SCENARIOS.unverified),
  }
}

/**
 * `GET /auth/{provider}/login` — 백엔드 `OAuthLoginProcessor` 의 판정 순서를 그대로 따른다.
 *
 *   state 검증(일회성 소비) → 프로필 필수값 → 계정 조회 → (연결 / 일치 / 불일치) 또는 생성
 *
 * **state 는 소비한다.** 백엔드가 Redis `GETDEL` 로 원자적으로 지우기 때문이다
 * (`RedisOAuthStateStoreAdapter.consume`). 그래서 **같은 콜백 URL 을 두 번 태우면
 * 두 번째는 `AUTH_010` 으로 실패한다** — 화면의 중복 실행 가드를 확인할 수 있는 것이
 * 이 성질이고, 명세가 적어 둔 "code 를 두 번 쓰면 실패" 의 실제 메커니즘이다.
 */
function oauthLogin(store: MockStore, rawProvider: string, search: string): MockResult {
  const provider = OAUTH_PROVIDERS.get(rawProvider.toLowerCase())
  if (provider === undefined) {
    return fail(400, 'AUTH_007', `지원하지 않는 소셜 로그인 제공자입니다. (${rawProvider})`)
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const code = params.get('code') ?? ''
  const state = params.get('state') ?? ''

  // 백엔드 validateState: 공란도 모르는 state 도 같은 AUTH_010 이다
  if (state.length === 0 || !store.oauthStates.has(`${provider}:${state}`)) {
    return fail(
      401,
      'AUTH_010',
      '유효하지 않은 소셜 로그인 요청입니다. 처음부터 다시 시도해주세요.',
    )
  }
  store.oauthStates.delete(`${provider}:${state}`)

  if (code.length === 0) {
    return fail(400, 'AUTH_013', '소셜 로그인 인증에 실패했습니다. 처음부터 다시 시도해주세요.')
  }
  if (code.includes(OAUTH_CODE_SCENARIOS.unavailable)) {
    return fail(
      502,
      'AUTH_014',
      '소셜 로그인 제공자와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.',
    )
  }

  const profile = oauthProfile(provider, code)
  if (profile.email.length === 0) {
    return fail(400, 'AUTH_009', '소셜 계정의 이메일 제공 동의가 필요합니다.')
  }
  if (!profile.emailVerified) {
    return fail(
      400,
      'AUTH_012',
      '소셜 계정의 이메일이 인증되지 않았습니다. 제공자에서 이메일 인증 후 다시 시도해주세요.',
    )
  }
  if (profile.nickname.length === 0) {
    return fail(400, 'AUTH_011', '소셜 계정의 프로필(닉네임) 제공 동의가 필요합니다.')
  }

  const existing = store.members.find((it) => it.email === profile.email)
  if (existing === undefined) {
    // 미가입 이메일 → 자동 회원가입 후 로그인. **비밀번호는 null 이다** (소셜 전용 계정)
    const member = {
      memberId: nextMemberId(store),
      email: profile.email,
      password: null,
      name: profile.nickname,
      nickname: profile.nickname,
      profileImageUrl: null,
      provider,
    }
    store.members.push(member)
    return loginSuccess(member.memberId)
  }

  // 일반 계정이면 소셜 계정으로 **연결**하고 로그인시킨다 — 백엔드 resolveExistingMember
  if (existing.provider === null) {
    existing.provider = provider
    return loginSuccess(existing.memberId)
  }

  if (existing.provider !== provider) {
    const name = OAUTH_PROVIDER_NAMES.get(existing.provider) ?? existing.provider
    return fail(
      409,
      'AUTH_008',
      `이미 ${name}(으)로 가입된 계정입니다. 해당 소셜 로그인을 이용해주세요.`,
    )
  }

  return loginSuccess(existing.memberId)
}

/** 처리 대상이 아니면 null 을 반환해 호출부가 게이트웨이로 넘기게 한다 */
export function resolveAuthMock(
  path: string,
  method: string,
  search: string,
  body: string | null,
): MockResult | null {
  const store = mockStore()

  if (path === '/auth/login' && method === 'POST') {
    const values = parse(body)
    const email = text(values.email)
    const password = text(values.password)
    const member = store.members.find((it) => it.email === email && it.password === password)

    // 미존재와 비밀번호 불일치를 하나의 응답으로 합친다 — 계정 열거 방지 (AuthErrorCode 주석)
    if (member === undefined) {
      return fail(401, 'AUTH_006', '이메일 또는 비밀번호가 올바르지 않습니다.')
    }

    return {
      status: 200,
      payload: ok({ accessToken: `mock-access-${member.memberId}`, memberId: member.memberId }),
      refreshToken: `mock-refresh-${member.memberId}`,
    }
  }

  if (path === '/auth/logout' && method === 'POST') {
    // 게이트웨이는 빈 값으로 쿠키를 지운다. BFF 가 '' 을 보고 세션을 비운다
    return { status: 200, payload: ok(null), refreshToken: '' }
  }

  if (path === '/auth/token/reissue' && method === 'POST') {
    const member = store.members[0]
    if (member === undefined) return fail(401, 'AUTH_002', '유효하지 않은 Refresh Token입니다.')
    return {
      status: 200,
      payload: ok({
        accessToken: `mock-access-${member.memberId}-reissued`,
        memberId: member.memberId,
      }),
      refreshToken: `mock-refresh-${member.memberId}`,
    }
  }

  if (path === '/auth/email/send-code' && method === 'POST') {
    const email = text(parse(body).email)

    // AuthValidationMessage 순서: 필수 → 형식 (AuthEmailCodeSendRequest 의 @NotBlank / @Email)
    if (email.length === 0) {
      return failValidation([{ code: 'AUTH_101', field: 'email', message: '이메일은 필수입니다.' }])
    }
    if (!EMAIL_PATTERN.test(email)) {
      return failValidation([
        { code: 'AUTH_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' },
      ])
    }
    // 가입 여부와 무관하게 항상 성공한다 — 계정 열거 방지
    store.pendingEmails.add(email)
    return { status: 200, payload: ok(null) }
  }

  if (path === '/auth/email/verify-code' && method === 'POST') {
    const values = parse(body)
    const email = text(values.email)
    const code = text(values.code)

    // AuthValidationMessage 순서: DTO 선언 순서(email → code) → 필수 → 형식.
    // pendingEmails 조회보다 먼저 온다 — 공란 입력이 AUTH_005/AUTH_004 로 잘못 떨어지면 안 된다
    if (email.length === 0) {
      return failValidation([{ code: 'AUTH_101', field: 'email', message: '이메일은 필수입니다.' }])
    }
    if (!EMAIL_PATTERN.test(email)) {
      return failValidation([
        { code: 'AUTH_102', field: 'email', message: '이메일 형식이 올바르지 않습니다.' },
      ])
    }
    if (code.length === 0) {
      return failValidation([
        { code: 'AUTH_104', field: 'code', message: '인증코드는 필수입니다.' },
      ])
    }

    if (!store.pendingEmails.has(email)) {
      return fail(
        400,
        'AUTH_005',
        '인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.',
      )
    }
    if (code !== MOCK_EMAIL_CODE) {
      return fail(400, 'AUTH_004', '인증코드가 일치하지 않습니다.')
    }

    store.verifiedEmails.add(email)
    return { status: 200, payload: ok(null) }
  }

  if (path === '/auth/password/reset/send-code' && method === 'POST') {
    const email = text(parse(body).email)

    const invalid = validateEmail(email)
    if (invalid !== null) return invalid

    /*
      **계정 존재 여부와 무관하게 항상 성공한다.** 미가입 이메일과 소셜 전용 계정에는
      코드가 아니라 안내 메일이 나가고(`PasswordResetProcessor.sendResetCode`),
      응답은 셋 다 같다. mock 이 404 를 내면 화면이 계정 열거를 어겼는지 확인할 수 없다.

      코드를 **실제로 발급하는 대상은 일반 계정뿐**이다 — 그래야 `social@` 로 재설정을
      시도했을 때 뒤이은 reset 이 AUTH_005 로 떨어지는 실제 경로가 재현된다.
    */
    const member = store.members.find((it) => it.email === email)
    if (member !== undefined && member.password !== null) {
      // 새 코드를 발급하면 이전 실패 카운터도 초기화된다 (clearVerifyFailures)
      store.passwordResetCodes.set(email, { code: MOCK_PASSWORD_RESET_CODE, attempts: 0 })
    }

    return { status: 200, payload: ok(null) }
  }

  if (path === '/auth/password/reset' && method === 'POST') {
    const values = parse(body)
    const errors = validatePasswordReset(values)
    if (errors.length > 0) return failValidation(errors)

    const email = text(values.email)
    const issued = store.passwordResetCodes.get(email)

    // 발급되지 않았거나 만료 — 소셜 전용·미가입 이메일도 여기로 떨어진다
    if (issued === undefined) {
      return fail(
        400,
        'AUTH_005',
        '인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.',
      )
    }

    if (issued.code !== text(values.code)) {
      issued.attempts += 1
      // 백엔드는 증가 후 `failures >= MAX` 로 판정한다 — 5번째 불일치에서 코드가 사라진다
      if (issued.attempts >= MAX_PASSWORD_RESET_FAILURES) {
        store.passwordResetCodes.delete(email)
        return fail(
          400,
          'AUTH_017',
          '인증코드 시도 횟수를 초과했습니다. 인증코드를 다시 요청해주세요.',
        )
      }
      return fail(400, 'AUTH_004', '인증코드가 일치하지 않습니다.')
    }

    const member = store.members.find((it) => it.email === email && it.password !== null)
    // 발송과 재설정 사이에 계정이 사라진 경우 — 백엔드도 코드 만료와 같게 응답한다
    if (member === undefined) {
      return fail(
        400,
        'AUTH_005',
        '인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.',
      )
    }

    member.password = text(values.newPassword)
    store.passwordResetCodes.delete(email)

    /*
      **`refreshToken: ''` 를 싣지 않는다.** 전 기기 세션 무효화는 서버 안에서만 일어나고
      (`jwtTokenStorePort.deleteAllSessions`), 이 응답에는 `Set-Cookie` 가 없다 —
      `AuthWebController.resetPassword` 는 쿠키 헤더를 붙이지 않는 유일한 인증 엔드포인트다.
      비밀번호 변경(`MemberWebController`)과 헷갈리면 안 된다. 그쪽은 clearRefreshCookie 를 싣는다.
    */
    return { status: 200, payload: ok(null) }
  }

  const oauthAuthorize = /^\/auth\/([^/]+)\/authorize$/.exec(path)
  if (oauthAuthorize !== null && method === 'GET') {
    const provider = OAUTH_PROVIDERS.get((oauthAuthorize[1] ?? '').toLowerCase())
    if (provider === undefined) {
      return fail(400, 'AUTH_007', `지원하지 않는 소셜 로그인 제공자입니다. (${oauthAuthorize[1]})`)
    }

    const seq = store.nextOAuthSeq
    store.nextOAuthSeq += 1
    const state = `mockstate${String(seq).padStart(6, '0')}`
    // state 는 provider 와 함께 저장한다 — 백엔드도 provider 를 값으로 저장하고 대조한다
    store.oauthStates.add(`${provider}:${state}`)

    /*
      **우리 콜백으로 곧장 돌려보낸다.** 실제 응답은 제공자의 인가 페이지 절대 URL 이지만,
      mock 에는 제공자가 없다. 상대 경로라도 `location.assign` 이 그대로 처리하므로
      로그인 → 콜백 → 세션까지 로컬에서 한 바퀴 돈다.

      오류 시나리오는 이 주소의 `code` 를 손으로 바꿔서 만든다 (OAUTH_CODE_SCENARIOS).
    */
    const code = `mockcode${String(seq).padStart(6, '0')}`
    return {
      status: 200,
      payload: ok({
        authorizationUrl: `/oauth/${oauthAuthorize[1] ?? ''}/callback?code=${code}&state=${state}`,
      }),
    }
  }

  const oauthLoginPath = /^\/auth\/([^/]+)\/login$/.exec(path)
  if (oauthLoginPath !== null && method === 'GET') {
    return oauthLogin(store, oauthLoginPath[1] ?? '', search)
  }

  if (path === '/members/signup' && method === 'POST') {
    const values = parse(body)
    const errors = validateSignup(values)
    if (errors.length > 0) return failValidation(errors)

    const email = text(values.email)
    if (!store.verifiedEmails.has(email)) {
      return fail(
        400,
        'MEMBER_006',
        '이메일 인증이 완료되지 않았습니다. 인증 후 다시 시도해주세요.',
      )
    }
    if (store.members.some((it) => it.email === email)) {
      return fail(409, 'MEMBER_001', `이미 가입된 이메일 (${email})입니다.`)
    }

    store.members.push({
      memberId: nextMemberId(store),
      email,
      password: text(values.password),
      name: text(values.name),
      nickname: text(values.nickname),
      // 일반 가입이라 소셜 연결이 없고 프로필 사진도 아직 없다 (= 계정 상태 general)
      profileImageUrl: null,
      provider: null,
    })
    store.verifiedEmails.delete(email)
    return { status: 200, payload: ok(null) }
  }

  return null
}

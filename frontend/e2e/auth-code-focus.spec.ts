import { expect, type Page, test } from '@playwright/test'

import { MOCK_EMAIL_CODE, MOCK_PASSWORD_RESET_CODE } from '../src/lib/api/mock/auth-data'
import { messages } from '../src/lib/messages'

/**
 * **인증코드 정규화와 제출 실패 뒤 포커스** — 이슈 #1078.
 *
 * ### 왜 e2e 인가
 *
 * 둘 다 node vitest 로는 원리적으로 못 본다 (`testing-guide.md` §1).
 *
 * - 정규화 **함수**는 `verification-code.test.ts` 가 보지만, 입력 중 커서가 끝으로 튀지 않는지는
 *   제어 입력이 DOM 값을 다시 쓰는 순간의 일이라 브라우저에서만 드러난다.
 * - 포커스는 effect 와 `document.activeElement` 의 일이다. 제출 중 버튼이 `disabled` 가 되며
 *   포커스가 `BODY` 로 떨어지는 것도 실제 브라우저의 동작이다.
 *
 * 세션 없이 시작한다 — 세션이 있으면 세 화면이 폼 대신 "이미 로그인되어 있어요" 를 그린다.
 */
test.use({ storageState: { cookies: [], origins: [] } })

/** `MOCK_API=true` 저장소의 일반 계정 (`src/lib/api/mock/store.ts`) */
const DEMO_EMAIL = 'demo@hondigagae.dev'
/**
 * 비밀번호 재설정용. **같은 비밀번호로 재설정한다** — 목 저장소는 서버 프로세스 메모리라 값을
 * 바꾸면 다른 스펙의 로그인이 깨진다. 데모 계정은 `auth.setup.ts` 가 쓰므로 건드리지 않는다.
 */
const RESET_ACCOUNT = { email: 'linked@hondigagae.dev', password: 'password123!' } as const

const formAlert = (page: Page) => page.locator('[data-form-alert]')

/** 클릭이 React 에 닿으려면 hydration 이 끝나야 한다 */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

/** 가입 2단계까지 간다 */
async function toSignupCodeStep(page: Page, email: string): Promise<void> {
  await open(page, '/signup')
  await page.locator('#email').fill(email)
  await page.getByRole('button', { name: messages.auth.sendCode }).click()
  await expect(page.locator('#code')).toBeFocused()
}

/** 백엔드 공통 래퍼의 실패 봉투 — `src/lib/api/response.ts` 가 판별한다 */
function failure(status: number, resultCode: string, resultMessage: string) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      dataHeader: { success: false, resultCode, resultMessage },
      dataBody: null,
    }),
  }
}

test.describe('인증코드 정규화 (#1078)', () => {
  test('가입 2단계: 소문자 · 공백 섞인 코드를 붙여넣어도 대문자로 고쳐져 통과한다', async ({
    page,
  }) => {
    await toSignupCodeStep(page, 'new-user-1078@hondigagae.dev')

    const pasted = ` ${MOCK_EMAIL_CODE.slice(0, 4).toLowerCase()} ${MOCK_EMAIL_CODE.slice(4).toLowerCase()} `
    // 붙여넣기 = 입력 이벤트 한 번에 글자 여럿
    await page.keyboard.insertText(pasted)
    await expect(page.locator('#code')).toHaveValue(MOCK_EMAIL_CODE)

    await page.getByRole('button', { name: messages.auth.verifyCode, exact: true }).click()
    // 3단계로 넘어갔다 — 단계 전환 effect 가 비밀번호 칸으로 옮긴다
    await expect(page.locator('#password')).toBeFocused()
  })

  test('가입 2단계: 가운데를 고쳐도 커서가 끝으로 튀지 않는다', async ({ page }) => {
    await toSignupCodeStep(page, 'new-user-1078-caret@hondigagae.dev')
    const code = page.locator('#code')

    await code.pressSequentially('abcd')
    await expect(code).toHaveValue('ABCD')

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('x')
    await expect(code).toHaveValue('ABXCD')
    expect(await code.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(3)

    // 공백은 지워지고 값이 그대로라도 커서는 제자리다
    await page.keyboard.type(' ')
    await expect(code).toHaveValue('ABXCD')
    expect(await code.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(3)
  })

  test('재설정: 소문자 코드로 바꾸고 완료 뒤 포커스가 로그인 링크로 간다', async ({ page }) => {
    await open(page, '/password/reset')
    await page.locator('#email').fill(RESET_ACCOUNT.email)
    await page.getByRole('button', { name: messages.auth.resetSendCode }).click()
    await expect(page.locator('#code')).toBeFocused()

    await page.keyboard.insertText(` ${MOCK_PASSWORD_RESET_CODE.toLowerCase()}`)
    await expect(page.locator('#code')).toHaveValue(MOCK_PASSWORD_RESET_CODE)

    // 먼저 약한 비밀번호 — 코드가 아니라 새 비밀번호 칸으로 가야 한다
    await page.locator('#newPassword').fill('short')
    await page.getByRole('button', { name: messages.auth.resetSubmit }).click()
    await expect(page.locator('#newPassword')).toBeFocused()
    await expect(page.locator('#code')).toHaveValue(MOCK_PASSWORD_RESET_CODE)

    await page.locator('#newPassword').fill(RESET_ACCOUNT.password)
    await page.getByRole('button', { name: messages.auth.resetSubmit }).click()

    // 완료 화면 — 폼이 사라져도 BODY 에 떨어지지 않는다
    await expect(page.getByRole('link', { name: messages.auth.toLoginScreen })).toBeFocused()
  })
})

test.describe('제출 실패 뒤 포커스 (#1078)', () => {
  test('가입 1단계: 빈 채로 내면 이메일 칸으로 간다', async ({ page }) => {
    await open(page, '/signup')
    await page.getByRole('button', { name: messages.auth.sendCode }).click()

    await expect(page.locator('#email')).toBeFocused()
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true')
  })

  test('가입 3단계: 빈 채로 내면 비밀번호, 409 면 폼 전체 알림으로 간다', async ({ page }) => {
    // 이미 가입된 이메일 — send-code · verify-code 는 계정 열거 방지로 통과하고 3단계에서 409 다
    await toSignupCodeStep(page, DEMO_EMAIL)
    await page.keyboard.insertText(MOCK_EMAIL_CODE)
    await page.getByRole('button', { name: messages.auth.verifyCode, exact: true }).click()
    await expect(page.locator('#password')).toBeFocused()

    await page.getByLabel(messages.auth.consentAllLabel).check()

    // 클라이언트 검증 실패 — 화면의 첫 오류
    await page.getByRole('button', { name: messages.auth.signupSubmit }).click()
    await expect(page.locator('#password')).toBeFocused()

    await page.locator('#password').fill('abcd123!')
    await page.locator('#name').fill('홍길동')
    await page.locator('#nickname').fill('길동')
    await page.getByRole('button', { name: messages.auth.signupSubmit }).click()

    await expect(formAlert(page)).toBeFocused()
    await expect(formAlert(page)).toContainText(DEMO_EMAIL)
  })

  const LOGIN_FAILURES = [
    {
      label: '503',
      response: failure(503, 'COMMON_503', '서비스를 일시적으로 사용할 수 없습니다.'),
    },
    { label: '429 AUTH_015', response: failure(429, 'AUTH_015', '로그인 시도가 너무 많습니다.') },
    {
      label: '400 MEMBER_007',
      response: failure(400, 'MEMBER_007', '소셜 로그인 계정은 비밀번호를 사용하지 않습니다.'),
    },
  ] as const

  for (const { label, response } of LOGIN_FAILURES) {
    test(`로그인 ${label}: 버튼이 disabled 였다 풀려도 BODY 가 아니라 알림에 있다`, async ({
      page,
    }) => {
      await page.route('**/api/bff/auth/login', (route) => route.fulfill(response))
      await open(page, '/login')

      await page.locator('#email').fill(DEMO_EMAIL)
      await page.locator('#password').fill('password123!')
      await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()

      await expect(formAlert(page)).toBeFocused()
    })
  }

  test('로그인 401: 지금처럼 비밀번호를 비우고 그 칸으로 간다', async ({ page }) => {
    await open(page, '/login')
    await page.locator('#email').fill(DEMO_EMAIL)
    await page.locator('#password').fill('wrong-password1!')
    await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()

    await expect(page.locator('#password')).toBeFocused()
    await expect(page.locator('#password')).toHaveValue('')
  })
})

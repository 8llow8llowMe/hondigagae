import { expect, type Page, test } from '@playwright/test'

import { MOCK_EMAIL_CODE } from '../src/lib/api/mock/auth-data'
import { messages } from '../src/lib/messages'
import { trackAppRouterMount, waitForAppRouterMounted } from './helpers/app-router'

/**
 * **재전송 뒤 포커스 · 실패 알림의 낭독 경로 · 5xx 뒤 값 수정** — 이슈 #1102.
 *
 * ### 왜 e2e 인가
 *
 * 셋 다 node vitest 로는 원리적으로 못 본다 (`testing-guide.md` §1).
 *
 * - **재전송 뒤 포커스** — 버튼이 `disabled` 가 되며 `BODY` 로 떨어지는 것은 브라우저의 일이고,
 *   옮기는 것은 effect 다. 고치기 전 실측에서 가입 · 재설정 2단계의 성공 · 429 · 503 여섯 갈래가
 *   모두 `BODY` 였다.
 * - **낭독 경로가 하나인가** — 실제 스크린리더 대신 **접근성 트리의 역할**과 포커스를 함께 본다.
 *   포커스를 받는 실패 표시에는 `role="alert"` 가 없고(포커스가 읽는다), 포커스가 다른 칸으로 가는
 *   갈래(로그인 401 · 되돌림 안내)에는 `role="alert"` 가 하나다(알림이 읽는다).
 * - **5xx 뒤 값 수정** — 입력 이벤트 뒤의 상태 변화라 렌더 테스트가 닿지 않는다. 판정 자체는
 *   `form-failure-display.test.ts` 의 `formErrorsAfterEdit` 가 본다.
 *
 * **`main` 안으로 좁힌다** — `next dev` 오버레이가 문서 끝에 자기 `alert` 을 둔다.
 */

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

const SERVER_5XX = '서비스를 일시적으로 사용할 수 없습니다.'
const UNAVAILABLE = failure(503, 'COMMON_503', SERVER_5XX)
const TOO_MANY = failure(429, 'AUTH_003', '잠시 후 다시 요청해주세요.')

const formAlert = (page: Page) => page.locator('main [data-form-alert]')
const temporary = (page: Page) => page.locator('main [data-form-temporary-error]')
const liveAlerts = (page: Page) => page.getByRole('main').getByRole('alert')

test.beforeEach(async ({ page }) => {
  await trackAppRouterMount(page)
})

/** 클릭이 React 에 닿으려면 hydration 이 끝나야 한다 — 앱 라우터 마운트 표식 (`testing-guide.md` §12) */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForAppRouterMounted(page)
}

/** 포커스를 받는 실패 표시 — 역할 없이 포커스가 읽는다 */
async function expectFocusAnnounced(page: Page, target: ReturnType<Page['locator']>) {
  await expect(target).toBeFocused()
  await expect(target).not.toHaveAttribute('role', 'alert')
  await expect(liveAlerts(page)).toHaveCount(0)
}

test.describe('세션 없이 — 인증 화면', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.describe('재전송 뒤 포커스 (#1102 항목 1)', () => {
    const SCREENS = [
      {
        name: '가입 2단계',
        path: '/signup',
        email: 'resend-1102@hondigagae.dev',
        send: messages.auth.sendCode,
        api: '**/api/bff/auth/email/send-code',
      },
      {
        name: '재설정 2단계',
        path: '/password/reset',
        email: 'linked@hondigagae.dev',
        send: messages.auth.resetSendCode,
        api: '**/api/bff/auth/password/reset/send-code',
      },
    ] as const

    /** 2단계로 가서 쿨다운(60초)을 넘긴 뒤, 키보드로 `다시 보내기` 를 누른다 */
    async function resendFromCodeStep(
      page: Page,
      screen: (typeof SCREENS)[number],
      response?: ReturnType<typeof failure>,
    ): Promise<void> {
      await page.locator('#email').fill(screen.email)
      await page.getByRole('button', { name: screen.send }).click()
      await expect(page.locator('#code')).toBeFocused()

      await page.clock.fastForward('01:05')
      const resend = page.getByRole('button', { name: messages.auth.resendCode, exact: true })
      await expect(resend).toBeEnabled()

      if (response !== undefined) {
        await page.route(screen.api, (route) => route.fulfill(response))
      }
      await resend.focus()
      await page.keyboard.press('Enter')
    }

    for (const screen of SCREENS) {
      test(`${screen.name}: 성공이면 코드 칸으로 간다 — BODY 가 아니다`, async ({ page }) => {
        await page.clock.install()
        await open(page, screen.path)
        await resendFromCodeStep(page, screen)

        await expect(page.locator('#code')).toBeFocused()
        // 쿨다운에 다시 들어갔다 — 버튼은 비활성, 포커스는 그 버튼에 남지 않는다
        await expect(
          page.getByRole('button', { name: messages.auth.resendCooldown(60) }),
        ).toBeDisabled()
      })

      test(`${screen.name}: 429 면 알림으로 가고 그 알림은 포커스가 읽는다`, async ({ page }) => {
        await page.clock.install()
        await open(page, screen.path)
        await resendFromCodeStep(page, screen, TOO_MANY)

        await expectFocusAnnounced(page, formAlert(page))
        await expect(formAlert(page)).toHaveText('잠시 후 다시 요청해주세요.')
      })

      test(`${screen.name}: 503 이면 일시 장애 상자로 가고, 다음 Tab 이 다시 시도다`, async ({
        page,
      }) => {
        await page.clock.install()
        await open(page, screen.path)
        await resendFromCodeStep(page, screen, UNAVAILABLE)

        await expectFocusAnnounced(page, temporary(page))
        await page.keyboard.press('Tab')
        await expect(page.getByRole('button', { name: messages.common.retry })).toBeFocused()
      })

      /*
        429 뒤 쿨다운이 끝나 다시 보내 성공하면 앞선 429 문구를 걷는다. 남기면 성공한 재전송 위에
        "잠시 후 다시 요청해주세요" 가 서고 포커스도 그 알림으로 간다.
      */
      test(`${screen.name}: 429 뒤 성공하면 직전 알림을 걷고 코드 칸으로 간다`, async ({
        page,
      }) => {
        await page.clock.install()
        await open(page, screen.path)
        await resendFromCodeStep(page, screen, TOO_MANY)
        await expect(formAlert(page)).toBeFocused()

        await page.unroute(screen.api)
        await page.clock.fastForward('01:05')
        const resend = page.getByRole('button', { name: messages.auth.resendCode, exact: true })
        await expect(resend).toBeEnabled()
        await resend.focus()
        await page.keyboard.press('Enter')

        await expect(page.locator('#code')).toBeFocused()
        await expect(formAlert(page)).toHaveCount(0)
      })
    }
  })

  test.describe('로그인 실패의 낭독 경로는 하나다 (#1102 항목 2)', () => {
    async function submitLogin(page: Page, password = 'password123!'): Promise<void> {
      await page.locator('#email').fill('demo@hondigagae.dev')
      await page.locator('#password').fill(password)
      await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()
    }

    test('429: 포커스가 알림으로 오고, 알림에는 role=alert 가 없다', async ({ page }) => {
      await page.route('**/api/bff/auth/login', (route) =>
        route.fulfill(failure(429, 'AUTH_015', '로그인 시도가 너무 많습니다.')),
      )
      await open(page, '/login')
      await submitLogin(page)

      await expectFocusAnnounced(page, formAlert(page))
      // 역할을 뗀 뒤에도 접근성 트리에서 문단으로 남아 포커스가 그 글을 읽는다
      await expect(formAlert(page)).toHaveRole('paragraph')
      await expect(formAlert(page)).toHaveText('로그인 시도가 너무 많습니다.')
    })

    test('503: 포커스가 일시 장애 상자로 오고, 상자에는 role=alert 가 없다', async ({ page }) => {
      await page.route('**/api/bff/auth/login', (route) => route.fulfill(UNAVAILABLE))
      await open(page, '/login')
      await submitLogin(page)

      await expectFocusAnnounced(page, temporary(page))
      await expect(temporary(page)).toContainText(messages.common.temporaryErrorTitle)
    })

    test('401: 포커스는 비밀번호 칸이고, 알림이 role=alert 하나로 읽힌다', async ({ page }) => {
      await open(page, '/login')
      await submitLogin(page, 'wrong-password1!')

      await expect(page.locator('#password')).toBeFocused()
      await expect(liveAlerts(page)).toHaveCount(1)
      await expect(liveAlerts(page)).toHaveAttribute('data-form-alert', '')
    })
  })

  test('가입 되돌림 안내(AUTH_005): 포커스는 이메일 칸이고, 안내가 role=alert 로 읽힌다', async ({
    page,
  }) => {
    await open(page, '/signup')
    await page.locator('#email').fill('stepback-1102@hondigagae.dev')
    await page.getByRole('button', { name: messages.auth.sendCode }).click()
    await expect(page.locator('#code')).toBeFocused()

    const expired = '인증코드가 만료되었거나 발급되지 않았습니다. 다시 요청해주세요.'
    await page.route('**/api/bff/auth/email/verify-code', (route) =>
      route.fulfill(failure(400, 'AUTH_005', expired)),
    )
    await page.keyboard.insertText(MOCK_EMAIL_CODE)
    await page.getByRole('button', { name: messages.auth.verifyCode, exact: true }).click()

    await expect(page.locator('#email')).toBeFocused()
    await expect(liveAlerts(page)).toHaveCount(1)
    await expect(liveAlerts(page)).toHaveText(expired)
  })

  test.describe('5xx 뒤 값을 고치면 실패 표시가 함께 걷힌다 (#1102 항목 3)', () => {
    /** 일시 장애가 걷혔고, 그 자리에 서버 문구 알림으로 바뀌어 서지도 않는다 */
    async function expectNoFailure(page: Page): Promise<void> {
      await expect(temporary(page)).toHaveCount(0)
      await expect(formAlert(page)).toHaveCount(0)
      await expect(page.getByText(SERVER_5XX)).toHaveCount(0)
    }

    test('로그인', async ({ page }) => {
      await page.route('**/api/bff/auth/login', (route) => route.fulfill(UNAVAILABLE))
      await open(page, '/login')
      await page.locator('#email').fill('demo@hondigagae.dev')
      await page.locator('#password').fill('password123!')
      await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()
      await expect(temporary(page)).toBeFocused()

      await page.locator('#email').fill('demo2@hondigagae.dev')
      await expectNoFailure(page)
    })

    test('가입 1단계', async ({ page }) => {
      await page.route('**/api/bff/auth/email/send-code', (route) => route.fulfill(UNAVAILABLE))
      await open(page, '/signup')
      await page.locator('#email').fill('five-xx-1102@hondigagae.dev')
      await page.getByRole('button', { name: messages.auth.sendCode }).click()
      await expect(temporary(page)).toBeFocused()

      await page.locator('#email').fill('five-xx-1102b@hondigagae.dev')
      await expectNoFailure(page)
    })

    test('재설정 2단계 — 걷히면 발송 안내도 돌아온다', async ({ page }) => {
      await open(page, '/password/reset')
      await page.locator('#email').fill('linked@hondigagae.dev')
      await page.getByRole('button', { name: messages.auth.resetSendCode }).click()
      await expect(page.locator('#code')).toBeFocused()

      await page.route('**/api/bff/auth/password/reset', (route) => route.fulfill(UNAVAILABLE))
      await page.keyboard.insertText('ABCDEF')
      await page.locator('#newPassword').fill('password123!')
      await page.getByRole('button', { name: messages.auth.resetSubmit }).click()
      await expect(temporary(page)).toBeFocused()
      // 서버 문구가 `errors.form` 에 남아 있는 동안은 발송 안내가 꺼진다
      await expect(page.getByText(messages.auth.resetCodeSent)).toHaveCount(0)

      await page.locator('#code').fill('ABCDEG')
      await expectNoFailure(page)
      await expect(page.getByText(messages.auth.resetCodeSent)).toBeVisible()
    })
  })
})

test.describe('세션 있음 — 반려견 등록', () => {
  test('5xx 뒤 값을 고치면 일시 장애가 서버 문구 알림으로 바뀌지 않고 걷힌다 (#1102 항목 3)', async ({
    page,
  }) => {
    await page.route('**/api/bff/members/me/pets', (route) =>
      route.request().method() === 'POST' ? route.fulfill(UNAVAILABLE) : route.fallback(),
    )
    await open(page, '/pets/new')

    const name = page.locator('#name')
    await name.fill('콩이')
    await page.getByRole('button', { name: messages.pet.register, exact: true }).click()
    await expect(temporary(page)).toBeFocused()
    await expect(temporary(page)).not.toHaveAttribute('role', 'alert')

    await name.fill('콩이네')
    await expect(temporary(page)).toHaveCount(0)
    await expect(formAlert(page)).toHaveCount(0)
    await expect(page.getByText(SERVER_5XX)).toHaveCount(0)
  })
})

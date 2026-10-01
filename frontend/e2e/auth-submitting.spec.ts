import { expect, type Page, type Route, test } from '@playwright/test'

import { messages } from '../src/lib/messages'

/**
 * **인증 화면 잔손질** — 이슈 #1084 (L2 · L5 · 포커스 링 덤).
 *
 * ### 왜 e2e 인가
 *
 * vitest 는 마크업 문자열만 본다 (`testing-guide.md` §1). 여기서 잠그는 것은 둘이다.
 *
 * - **요청이 도는 동안의 화면.** 응답을 route 로 붙잡아야 "로그인 중" 순간을 볼 수 있다.
 *   단언은 재시도하므로 **렌더 한 번 차이의 틈은 잡지 못한다** — 처음 effect 로 배선했을 때
 *   "로그인 중" 직후 소셜 버튼이 아직 눌리던 틈은 수동 계측으로 확인했고, 배선을 제출 핸들러로
 *   옮겨 닫았다 (`login-form.tsx` `onSubmittingChange(true)` 주석).
 * - **계산된 포커스 링 색.** 클래스 문자열이 아니라 `box-shadow` 값이다.
 *
 * 세션 없이 시작한다 — 세션이 있으면 인증 화면이 목적지로 보낸다 (#1082).
 */
test.use({ storageState: { cookies: [], origins: [] } })

const PHONE = { width: 375, height: 812 } as const

const LOGIN_FAILED = '이메일 또는 비밀번호가 올바르지 않습니다.'

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

function socialButtons(page: Page) {
  return [
    page.getByRole('button', { name: messages.auth.socialLoginLabel('카카오') }),
    page.getByRole('button', { name: messages.auth.socialLoginLabel('네이버') }),
  ]
}

test.describe('로그인 — 요청이 도는 동안 (#1084 L2)', () => {
  test('직전 401 알림을 걷고 소셜 버튼을 잠근다 — 결과가 오면 되돌린다', async ({ page }) => {
    await page.setViewportSize(PHONE)

    let hold = false
    let release: (() => void) | undefined
    await page.route('**/api/bff/auth/login', async (route: Route) => {
      if (hold) await new Promise<void>((resolve) => (release = resolve))
      await route.fulfill(failure(401, 'AUTH_006', LOGIN_FAILED))
    })

    await page.goto('/login')
    await page.locator('#email').fill('demo@hondigagae.dev')
    await page.locator('#password').fill('wrong1234!')
    await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()
    await expect(page.getByText(LOGIN_FAILED)).toBeVisible()

    hold = true
    await page.locator('#password').fill('again1234!')
    await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()
    await expect(page.getByRole('button', { name: messages.auth.loginSubmitting })).toBeVisible()

    await expect(page.getByText(LOGIN_FAILED)).toHaveCount(0)
    for (const button of socialButtons(page)) await expect(button).toBeDisabled()

    release?.()
    await expect(page.getByText(LOGIN_FAILED)).toBeVisible()
    for (const button of socialButtons(page)) await expect(button).toBeEnabled()
  })
})

test.describe('포커스 링 (#1084 L5 · 덤)', () => {
  test('오류 상태 입력의 링은 테두리와 같은 빨강이다 — 초록이 섞이지 않는다', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/login')

    // 빈 제출 — 첫 오류 칸(이메일)으로 포커스가 간다
    await page.getByRole('button', { name: messages.auth.loginSubmit, exact: true }).click()
    const email = page.locator('#email')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')

    // --danger-500 #D54040 · --brand-500 #2E9B6B
    await expect(email).toHaveCSS('border-top-color', 'rgb(213, 64, 64)')
    await expect(email).toHaveCSS('box-shadow', /rgb\(213, 64, 64\) 0px 0px 0px 1px/)
    await expect(email).not.toHaveCSS('box-shadow', /rgb\(46, 155, 107\)/)
  })

  test('제출 실패 알림은 브라우저 기본 파랑이 아니라 토큰 링이다', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.route('**/api/bff/auth/login', (route) =>
      route.fulfill(failure(429, 'AUTH_015', '로그인 시도가 너무 많습니다.')),
    )
    await page.goto('/login')
    await page.locator('#email').fill('demo@hondigagae.dev')
    await page.locator('#password').fill('wrong1234!')
    await page.locator('#password').press('Enter')

    const alert = page.locator('[data-form-alert]')
    await expect(alert).toBeFocused()
    await expect(alert).toHaveCSS('outline-style', 'none')
    await expect(alert).toHaveCSS('box-shadow', /rgb\(46, 155, 107\) 0px 0px 0px 4px/)
  })
})

import { expect, type Page, test } from '@playwright/test'

import { messages } from '../src/lib/messages'
import { trackAppRouterMount, waitForAppRouterMounted } from './helpers/app-router'
import { chooseEmailSignup } from './helpers/signup'

/**
 * 회원가입 — 가입 방법 고르기 · 약관 시트 (#1284, 회원가입-세부명세 D14).
 *
 * 동의를 첫 화면이 아니라 **개인정보가 서버로 처음 나가기 직전** 에 받는다. 이 스펙은 그 문을 잠근다:
 * 시트에 동의하기 전에는 코드 발송 · 소셜 인가 요청이 나가지 않는다.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.beforeEach(async ({ page }) => {
  await trackAppRouterMount(page)
})

async function open(page: Page): Promise<void> {
  await page.goto('/signup')
  await waitForAppRouterMounted(page)
}

test('소셜 버튼은 늘 눌리고, 누르면 그 제공자 하나만 든 약관 시트가 뜬다', async ({ page }) => {
  let authorized = false
  await page.route('**/api/bff/auth/*/authorize**', (route) => {
    authorized = true
    return route.abort()
  })
  await open(page)

  const kakao = page.getByRole('button', { name: messages.auth.socialLoginLabel('카카오') })
  await expect(kakao).toBeEnabled()
  await kakao.click()

  const sheet = page.getByRole('dialog', { name: messages.auth.consentSheetTitle })
  await expect(sheet).toBeVisible()
  // 다른 제공자를 함께 보이면 다른 이메일의 다른 가입이 된다 (#707 과 같은 판단)
  await expect(
    sheet.getByRole('button', { name: messages.auth.socialLoginLabel('네이버') }),
  ).toHaveCount(0)
  const inSheet = sheet.getByRole('button', { name: messages.auth.socialLoginLabel('카카오') })
  await expect(inSheet).toBeDisabled()

  expect(authorized).toBe(false)

  // 동의하면 그제서야 인가 요청이 나간다 — 라우트를 끊어 실제 제공자 화면으로는 가지 않는다
  await sheet.getByLabel(messages.auth.consentAllLabel).check()
  await expect(inSheet).toBeEnabled()
  await inSheet.click()
  await expect.poll(() => authorized).toBe(true)
})

test('이메일 1단계는 동의 전에 코드를 보내지 않고 시트를 띄운다', async ({ page }) => {
  let sent = 0
  await page.route('**/api/bff/auth/email/send-code', (route) => {
    sent += 1
    return route.continue()
  })
  await open(page)
  await chooseEmailSignup(page)
  await page.locator('#email').fill('sheet-1284@hondigagae.dev')
  await page.getByRole('button', { name: messages.auth.sendCode, exact: true }).click()

  const sheet = page.getByRole('dialog', { name: messages.auth.consentSheetTitle })
  const confirm = sheet.getByRole('button', { name: messages.auth.consentAndSendCode })
  await expect(confirm).toBeDisabled()
  expect(sent).toBe(0)

  await sheet.getByLabel(messages.auth.consentAllLabel).check()
  await confirm.click()
  await expect(page.locator('#code')).toBeFocused()
  expect(sent).toBe(1)
})

test('이메일 단계의 ← 는 방법 고르기로 돌아가고 포커스를 "이메일로 가입하기" 에 돌려준다', async ({
  page,
}) => {
  await open(page)
  await chooseEmailSignup(page)
  await page.getByRole('button', { name: messages.auth.signupBackToMethod }).click()

  await expect(page.getByRole('button', { name: messages.auth.signupWithEmail })).toBeFocused()
})

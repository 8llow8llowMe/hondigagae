import { expect, type Page, test } from '@playwright/test'

import { MOCK_EMAIL_CODE } from '../src/lib/api/mock/auth-data'
import { messages } from '../src/lib/messages'
import { trackAppRouterMount, waitForAppRouterMounted } from './helpers/app-router'
import { chooseEmailSignup, sendSignupCodeWithConsent } from './helpers/signup'

/**
 * 회원가입 3단계 — **서버가 동의를 거부하면 약관 시트가 다시 뜬다** (#1295, 회원가입-세부명세 D15).
 *
 * 동의는 1단계 시트에서 이미 받았지만, 서버는 가입 요청에서 한 번 더 본다(`MEMBER_115/116/117` ·
 * `MEMBER_010/011`). 거부되면 `SignupForm` 이 같은 시트를 `signup` 목적으로 다시 띄워 "동의하고
 * 가입하기" 로 같은 제출을 다시 낸다. 이 흐름은 #1284 의 e2e 가 다루지 않았다.
 *
 * 함께 잠그는 접근성 둘:
 * - **N2** 이 시트는 제출 응답이 열어, 열린 순간의 활성 요소가 `BODY` 다(제출 중 `가입하기` 가
 *   `disabled`). Esc 로 닫으면 `BODY` 가 아니라 `가입하기` 로 돌아가야 한다.
 * - **N3** `aria-modal="true"` 시트에서 Tab 이 뒤쪽 페이지(상단바 `←`)로 빠지지 않는다.
 *
 * 응답은 `page.route` 로 400 `MEMBER_010` 에 고정한다 — 목 저장소는 동의 3종이 다 켜진 가입을
 * 통과시키므로 이 거부를 재현할 수 없다. 문구는 목(`auth-data.ts`)이 소셜 최초 연동에서 내는 것과 같다.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.beforeEach(async ({ page }) => {
  await trackAppRouterMount(page)
})

/**
 * `SIGNUP_STEP_STATUS_ID`(`signup-parts.tsx`). 컴포넌트 모듈은 `next/link` 를 끌고 와 여기서 import
 * 하지 않는다 — 값은 `signup-parts.test.ts` 가 같은 문자열로 잠근다.
 */
const SIGNUP_STEP_STATUS_ID = 'signup-step-status'

const REJECTED_MESSAGE = '이용약관과 개인정보 처리방침에 동의해야 가입할 수 있습니다.'

/** 백엔드 공통 래퍼의 실패 봉투 — `src/lib/api/response.ts` 가 판별한다 */
const REJECTED = {
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    dataHeader: { success: false, resultCode: 'MEMBER_010', resultMessage: REJECTED_MESSAGE },
    dataBody: null,
  }),
}

const sheetOf = (page: Page) => page.getByRole('dialog', { name: messages.auth.consentSheetTitle })

/** `가입하기` 는 시트의 `동의하고 가입하기` 의 부분 문자열이라 `exact` 로 고른다 */
const submitOf = (page: Page) =>
  page.getByRole('button', { name: messages.auth.signupSubmit, exact: true })

/** 포커스가 지금 약관 시트(포털로 `body` 끝에 붙는다) 안에 있는가 */
function focusInSheet(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.activeElement?.closest('[role="dialog"][aria-modal="true"]') != null,
  )
}

/**
 * 가입 요청을 거부로 고정하고 3단계에서 `가입하기` 까지 누른다. 시트가 다시 뜬 상태로 돌아온다.
 * 돌려주는 함수는 지금까지 나간 가입 요청 수다.
 */
async function rejectAtProfileStep(page: Page): Promise<() => number> {
  let signups = 0
  await page.route('**/api/bff/members/signup', (route) => {
    signups += 1
    return route.fulfill(REJECTED)
  })

  await page.goto('/signup')
  await waitForAppRouterMounted(page)
  await chooseEmailSignup(page)
  await page.locator('#email').fill('consent-rejected-1295@hondigagae.dev')
  await sendSignupCodeWithConsent(page)
  await expect(page.locator('#code')).toBeFocused()
  await page.keyboard.insertText(MOCK_EMAIL_CODE)
  await page.getByRole('button', { name: messages.auth.verifyCode, exact: true }).click()
  await expect(page.locator('#password')).toBeFocused()

  await page.locator('#password').fill('abcd123!')
  await page.locator('#name').fill('홍길동')
  await page.locator('#nickname').fill('길동')
  await submitOf(page).click()

  await expect(sheetOf(page)).toBeVisible()
  expect(signups).toBe(1)
  return () => signups
}

test('서버가 동의를 거부하면 시트가 다시 뜨고, "동의하고 가입하기" 가 같은 가입을 다시 낸다', async ({
  page,
}) => {
  const signups = await rejectAtProfileStep(page)
  const sheet = sheetOf(page)

  // 거부 사유가 체크박스 아래에 붙는다 — MEMBER_010 은 이용약관 · 개인정보 둘을 가리킨다
  await expect(sheet.getByText(REJECTED_MESSAGE).first()).toBeVisible()
  // 시트가 포커스를 갖는다 — 프로필 실패 포커스 effect 는 동의 오류가 있으면 비켜 선다
  expect(await focusInSheet(page)).toBe(true)

  // 동의 값은 그대로 켜져 있어 바로 다시 낼 수 있다
  const confirm = sheet.getByRole('button', { name: messages.auth.consentAndSignup })
  await expect(confirm).toBeEnabled()
  await confirm.click()

  await expect.poll(signups).toBe(2)
  // 다시 거부되면 같은 시트가 또 뜬다
  await expect(sheetOf(page)).toBeVisible()
})

test('N2: 다시 뜬 시트를 Esc 로 닫으면 BODY 가 아니라 가입하기로 돌아간다', async ({ page }) => {
  await rejectAtProfileStep(page)

  await page.keyboard.press('Escape')

  await expect(sheetOf(page)).toHaveCount(0)
  await expect(submitOf(page)).toBeFocused()
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
})

test('N3: 시트 안에서 Tab · Shift+Tab 이 시트 밖으로 나가지 않는다', async ({ page }) => {
  await rejectAtProfileStep(page)

  // 시트의 탭 정지는 전체 동의 · 세 항목 · 전문 보기 링크들 · 실행 버튼이다 — 한 바퀴를 넉넉히 넘게 돈다
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press('Tab')
    expect(await focusInSheet(page), `Tab ${index + 1}번째`).toBe(true)
  }
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press('Shift+Tab')
    expect(await focusInSheet(page), `Shift+Tab ${index + 1}번째`).toBe(true)
  }
})

test('N4: 각 단계의 첫 칸이 "3단계 중 N단계" 문구를 가리킨다', async ({ page }) => {
  await rejectAtProfileStep(page)
  await page.keyboard.press('Escape')

  const describedBy = await page.locator('#password').getAttribute('aria-describedby')
  expect(describedBy?.split(' ')).toContain(SIGNUP_STEP_STATUS_ID)
  await expect(page.locator(`#${SIGNUP_STEP_STATUS_ID}`)).toHaveText(messages.auth.stepOf(3, 3))
})

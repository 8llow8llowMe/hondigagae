import { expect, type Page } from '@playwright/test'

import { messages } from '../../src/lib/messages'

/**
 * 회원가입 흐름 헬퍼 (#1284, 회원가입-세부명세 D14).
 *
 * 가입은 이제 **가입 방법 고르기 → 이메일 단계** 로 들어가고, 첫 코드 발송 전에 **약관 시트**를
 * 거친다. 스펙마다 이 두 단계를 손으로 밟으면 흐름이 또 바뀔 때 일곱 군데가 함께 깨진다 — 한 곳에 둔다.
 */

/** 진입 화면에서 `이메일로 가입하기` 를 눌러 1단계로 간다. 1단계는 이메일 칸에 포커스를 둔다 */
export async function chooseEmailSignup(page: Page): Promise<void> {
  await page.getByRole('button', { name: messages.auth.signupWithEmail }).click()
  await expect(page.locator('#email')).toBeFocused()
}

/**
 * 1단계 `인증코드 받기` → 약관 시트에서 모두 동의 → `동의하고 인증코드 받기`.
 *
 * **이메일이 맞을 때만 시트가 뜬다** — 틀린 이메일은 시트 없이 칸 오류가 선다(`handleEmailSubmit`).
 * `sendCode`(`인증코드 받기`)는 시트 버튼(`동의하고 인증코드 받기`)의 부분 문자열이라 `exact` 로 고른다.
 */
export async function sendSignupCodeWithConsent(page: Page): Promise<void> {
  await page.getByRole('button', { name: messages.auth.sendCode, exact: true }).click()
  const sheet = page.getByRole('dialog', { name: messages.auth.consentSheetTitle })
  await sheet.getByLabel(messages.auth.consentAllLabel).check()
  await sheet.getByRole('button', { name: messages.auth.consentAndSendCode }).click()
}

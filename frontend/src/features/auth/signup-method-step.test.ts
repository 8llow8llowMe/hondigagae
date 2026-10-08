import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SIGNUP_WITH_EMAIL_ID, SignupMethodStep } from '@/features/auth/signup-method-step'
import { messages } from '@/lib/messages'

const markup = renderToStaticMarkup(
  createElement(SignupMethodStep, {
    returnTo: '/plans/1',
    onSelectSocial: () => {},
    onSelectEmail: () => {},
  }),
)

describe('SignupMethodStep — 가입 방법 고르기 (#1284 S1 · S2)', () => {
  it('환영 제목이 h1 이다', () => {
    expect(markup).toContain(`>${messages.auth.signupWelcomeTitle}</h1>`)
  })

  it('소셜 → "또는" → 이메일로 가입하기 → 로그인 입구 순서다', () => {
    const order = [
      messages.auth.socialLoginLabel('카카오'),
      messages.auth.socialLoginLabel('네이버'),
      `>${messages.auth.signupDivider}<`,
      messages.auth.signupWithEmail,
      messages.auth.haveAccountPrompt,
    ].map((needle) => markup.indexOf(needle))

    expect(order.every((index) => index > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  /* 예전 첫 화면은 동의 전 소셜 버튼을 흐려 두어 고장으로 읽혔다 (S2) */
  it('소셜 버튼이 잠겨 있지 않고 동의 안내도 없다', () => {
    expect(markup).not.toMatch(/<button[^>]*disabled=""/)
    expect(markup).not.toContain(messages.auth.socialConsentRequired)
  })

  /* 동의는 방법을 고른 뒤 시트가 받는다 (S3) */
  it('첫 화면에 체크박스도 이메일 칸도 없다', () => {
    expect(markup).not.toContain('type="checkbox"')
    expect(markup).not.toContain('id="email"')
  })

  it('이메일로 가입하기에 돌아올 때의 포커스 자리(id)가 있다', () => {
    expect(markup).toContain(`id="${SIGNUP_WITH_EMAIL_ID}"`)
  })

  it('로그인 입구가 returnTo 를 문다', () => {
    expect(markup).toContain('href="/login?returnTo=%2Fplans%2F1"')
  })
})

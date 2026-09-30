import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  SIGNUP_STEP_COUNT,
  SignupEmailSummary,
  SignupHeading,
  SignupLoginPrompt,
} from '@/features/auth/signup-parts'
import { messages } from '@/lib/messages'

describe('SignupHeading — 제목 바로 아래 단계 표시 (#1083)', () => {
  it('제목 다음에 단계 표시가 온다', () => {
    const markup = renderToStaticMarkup(createElement(SignupHeading, { step: 1 }))

    expect(markup).toContain(`>${messages.auth.signupTitle}</h1>`)
    expect(markup.indexOf('</h1>')).toBeLessThan(markup.indexOf(messages.auth.stepOf(1, 3)))
  })

  it('단계를 텍스트로 말한다 — 색·아이콘만으로 표현하지 않는다 (D6)', () => {
    for (const step of [1, 2, 3] as const) {
      const markup = renderToStaticMarkup(createElement(SignupHeading, { step }))

      expect(markup).toContain(messages.auth.stepOf(step, SIGNUP_STEP_COUNT))
    }
  })

  it('전체 단계 수는 3이다', () => {
    expect(SIGNUP_STEP_COUNT).toBe(3)
  })
})

describe('SignupEmailSummary — 이메일을 라벨과 함께 보인다 (#1083)', () => {
  it('라벨과 값을 dl 로 묶는다', () => {
    const markup = renderToStaticMarkup(
      createElement(SignupEmailSummary, { label: '받는 이메일', email: 'a@b.c' }),
    )

    expect(markup).toContain('<dl')
    expect(markup).toContain('<dt class="text-caption text-fg-muted">받는 이메일</dt>')
    expect(markup).toContain('a@b.c</dd>')
  })

  it('긴 이메일이 375 폭을 넘지 않게 끊는다', () => {
    const markup = renderToStaticMarkup(
      createElement(SignupEmailSummary, { label: '받는 이메일', email: 'a@b.c' }),
    )

    expect(markup).toContain('break-all')
  })
})

describe('SignupLoginPrompt — 이미 계정이 있나요? 로그인 (#1083)', () => {
  it('질문과 로그인 링크를 함께 그린다 — 링크 글자는 "로그인" 하나다', () => {
    const markup = renderToStaticMarkup(createElement(SignupLoginPrompt, { returnTo: '/' }))

    expect(markup).toContain(messages.auth.haveAccountPrompt)
    expect(markup).toMatch(new RegExp(`<a [^>]*>${messages.auth.haveAccountLink}</a>`))
    // 질문은 링크 밖이다 — 링크 이름이 문장이 되면 링크 목록에서 할 일이 안 읽힌다
    expect(markup.indexOf(messages.auth.haveAccountPrompt)).toBeLessThan(markup.indexOf('<a '))
  })

  /*
    로그인 → 회원가입 → 로그인 으로 돌아와도 처음 가려던 곳을 잃지 않는다. 로그인 화면의
    "회원가입" 링크와 같은 셰이프다.
  */
  it('returnTo 를 이어받는다', () => {
    const markup = renderToStaticMarkup(
      createElement(SignupLoginPrompt, { returnTo: '/places/12?tab=review' }),
    )

    expect(markup).toContain('href="/login?returnTo=%2Fplaces%2F12%3Ftab%3Dreview"')
  })

  it('가입 완료 표식(signedUp)이나 이메일을 싣지 않는다 — 그냥 로그인 입구다', () => {
    const markup = renderToStaticMarkup(createElement(SignupLoginPrompt, { returnTo: '/' }))

    expect(markup).not.toContain('signedUp')
    expect(markup).not.toContain('email=')
  })
})

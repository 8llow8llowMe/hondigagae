import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  SIGNUP_STEP_COUNT,
  SignupConsentAction,
  SignupEmailSummary,
  SignupLoginPrompt,
  SignupStepHeading,
} from '@/features/auth/signup-parts'
import { messages } from '@/lib/messages'

describe('SignupStepHeading — 진행 바 + 단계 질문 (#1284)', () => {
  const render = (step: 1 | 2 | 3, description?: string) =>
    renderToStaticMarkup(
      createElement(SignupStepHeading, { step, heading: '이메일을 알려주세요', description }),
    )

  it('단계 질문이 화면의 h1 이다 — "회원가입" 이 아니다', () => {
    const markup = render(1)

    expect(markup).toContain('>이메일을 알려주세요</h1>')
    expect(markup).not.toContain(messages.auth.signupTitle)
  })

  it('진행 바가 제목보다 먼저 서고, 장식이라 aria-hidden 이다', () => {
    const markup = render(1)

    expect(markup.indexOf('aria-hidden="true"')).toBeLessThan(markup.indexOf('<h1'))
  })

  /* 색·바만으로 표현하지 않는다 (D6) — 글자는 sr-only 로 제목 바로 뒤에 읽힌다 */
  it('단계를 sr-only 글자로 말한다', () => {
    for (const step of [1, 2, 3] as const) {
      const markup = render(step)

      expect(markup).toContain(
        `<p class="sr-only">${messages.auth.stepOf(step, SIGNUP_STEP_COUNT)}</p>`,
      )
      expect(markup.indexOf('</h1>')).toBeLessThan(markup.indexOf('sr-only'))
    }
  })

  it('바의 채움이 단계를 따른다', () => {
    expect(render(1)).toContain('w-1/3')
    expect(render(2)).toContain('w-2/3')
    expect(render(3)).toContain('w-full')
  })

  it('설명은 넘길 때만 그린다', () => {
    expect(render(1, '코드를 보내드려요.')).toContain('코드를 보내드려요.')
    expect(render(2)).not.toContain('text-body-2')
  })

  it('전체 단계 수는 3이다', () => {
    expect(SIGNUP_STEP_COUNT).toBe(3)
  })
})

describe('SignupConsentAction — 약관 시트의 실행 자리 (#1284)', () => {
  const render = (complete: boolean) =>
    renderToStaticMarkup(
      createElement(SignupConsentAction, {
        complete,
        label: messages.auth.consentAndSendCode,
        requiredMessage: messages.auth.emailConsentRequired,
        onConfirm: () => {},
      }),
    )

  /* 버튼만 흐리게 두면 고장으로 읽는다 — 소셜 버튼의 `socialConsentRequired` 와 같은 판단 */
  it('동의 전에는 버튼을 잠그고 이유를 글자로 말한다', () => {
    const markup = render(false)

    expect(markup).toMatch(/<button[^>]*disabled=""/)
    expect(markup).toContain(messages.auth.emailConsentRequired)
  })

  it('셋 다 켜지면 버튼이 눌리고 안내가 사라진다', () => {
    const markup = render(true)

    expect(markup).not.toMatch(/<button[^>]*disabled=""/)
    expect(markup).not.toContain(messages.auth.emailConsentRequired)
    expect(markup).toContain(messages.auth.consentAndSendCode)
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

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { LoginEmailHelpBody } from '@/features/auth/login-email-help'
import { messages } from '@/lib/messages'

describe('LoginEmailHelpBody — 이메일 찾기 안내 (#1283 F1)', () => {
  const markup = renderToStaticMarkup(createElement(LoginEmailHelpBody))

  it('결론("이메일이 아이디") 을 먼저, 두 갈래(소셜 · 이메일 가입)를 그 아래 둔다', () => {
    const id = markup.indexOf(messages.auth.emailHelpId)
    const social = markup.indexOf(messages.auth.emailHelpSocial)
    const mailbox = markup.indexOf(messages.auth.emailHelpMailbox)

    expect(id).toBeGreaterThan(-1)
    expect(social).toBeGreaterThan(id)
    expect(mailbox).toBeGreaterThan(social)
  })

  /*
    계정 열거 방지 — 이 시트는 서버를 부르지 않고 입력도 받지 않는다. 입력 칸이 생기면 "가입
    여부를 알려 주는 화면" 이 되는 길이 열린다.
  */
  it('입력 칸이 없다', () => {
    expect(markup).not.toContain('<input')
  })
})

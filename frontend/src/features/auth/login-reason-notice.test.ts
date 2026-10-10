import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { LoginReasonNotice } from '@/features/auth/login-reason-notice'
import { messages } from '@/lib/messages'

function render(returnTo: string, screen: 'login' | 'signup') {
  return renderToStaticMarkup(createElement(LoginReasonNotice, { returnTo, screen }))
}

describe('LoginReasonNotice (#1157)', () => {
  it('로그인 화면은 목적 + 로그인이 필요하다고 말한다', () => {
    const markup = render('/ai-plans/new', 'login')

    expect(markup).toContain(
      messages.auth.loginReason.replace('{purpose}', messages.auth.purposeAiPlan),
    )
    expect(markup).toContain('role="status"')
  })

  it('회원가입 화면은 계정이 필요하다고 말한다', () => {
    expect(render('/ai-plans/new', 'signup')).toContain(
      messages.auth.signupReason.replace('{purpose}', messages.auth.purposeAiPlan),
    )
  })

  it('홈으로 돌아가는 진입이면 아무것도 그리지 않는다', () => {
    expect(render('/', 'login')).toBe('')
  })
})

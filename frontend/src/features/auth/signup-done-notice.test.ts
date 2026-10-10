import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SignupDoneNotice } from '@/features/auth/signup-done-notice'
import { messages } from '@/lib/messages'

describe('SignupDoneNotice', () => {
  it('signedUp=1 이면 가입 완료 안내를 role=status 로 렌더한다', () => {
    const markup = renderToStaticMarkup(createElement(SignupDoneNotice, { signedUp: '1' }))

    expect(markup).toContain(messages.auth.signupDone)
    expect(markup).toContain('role="status"')
  })

  it('signedUp 이 없으면 아무것도 렌더하지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(SignupDoneNotice, { signedUp: undefined }))

    expect(markup).toBe('')
    expect(markup).not.toContain(messages.auth.signupDone)
  })

  it('signedUp 이 "1" 이 아닌 값이면 렌더하지 않는다 — 409 로그인 링크와 같은 email 파라미터로 오판하지 않는다', () => {
    const markup = renderToStaticMarkup(createElement(SignupDoneNotice, { signedUp: '0' }))

    expect(markup).not.toContain(messages.auth.signupDone)
  })
})

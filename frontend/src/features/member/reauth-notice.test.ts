import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ReauthNotice } from '@/features/member/reauth-notice'
import { messages } from '@/lib/messages'

function render(reauth: string | undefined) {
  return renderToStaticMarkup(createElement(ReauthNotice, { reauth }))
}

describe('ReauthNotice — 세션이 끊긴 이유를 로그인 화면에서 알린다', () => {
  it('비밀번호 변경 후에는 재로그인 안내를 낸다', () => {
    const markup = render('password-changed')

    expect(markup).toContain(messages.member.passwordChangedNotice)
    expect(markup).toContain('role="status"')
  })

  it('소셜 전용 전환 후 안내를 낸다', () => {
    expect(render('password-removed')).toContain(messages.member.removePasswordDone)
  })

  it('탈퇴 후 안내를 낸다', () => {
    expect(render('withdrawn')).toContain(messages.member.withdrawDone)
  })

  it('값이 없으면 아무것도 렌더하지 않는다', () => {
    expect(render(undefined)).toBe('')
  })

  /**
   * 쿼리는 사용자가 조작할 수 있다. **모르는 값은 조용히 무시한다** — 그러지 않으면
   * 링크를 만든 누구나 우리 로그인 화면에 임의 문구를 띄울 수 있다.
   */
  it('모르는 값은 렌더하지 않는다', () => {
    expect(render('계정이 정지되었습니다')).toBe('')
    expect(render('__proto__')).toBe('')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { FormFailure } from '@/features/auth/form-failure'
import { messages } from '@/lib/messages'

function render(message: string | null, errorStatus: number | null) {
  return renderToStaticMarkup(
    createElement(FormFailure, { message, errorStatus, onRetry: () => undefined }),
  )
}

/**
 * 폼 전체 실패 자리 — 이슈 #1079. 판정 자체는 `form-failure-display.test.ts` 가 본다.
 * 여기서는 **두 표시가 동시에 서지 않는다**와 포커스 대상 배선을 잠근다.
 */
describe('FormFailure', () => {
  it('5xx 면 일시 장애 하나만 선다 — 서버 문구 알림이 함께 서지 않는다', () => {
    const markup = render('서비스를 일시적으로 사용할 수 없습니다.', 503)

    expect(markup).toContain(messages.common.temporaryErrorTitle)
    expect(markup).toContain(messages.common.temporaryErrorDescription)
    expect(markup).not.toContain('서비스를 일시적으로 사용할 수 없습니다.')
    expect(markup).not.toContain('data-form-alert')
    // 재시도 수단도 하나다
    expect(markup.match(/<button/g)).toHaveLength(1)
  })

  it('일시 장애는 제출 실패 뒤 포커스 대상이고 role=alert 로 알린다 — FormAlert 가 하던 일이다', () => {
    const markup = render(null, 0)

    expect(markup).toContain('data-form-temporary-error=""')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('role="alert"')
  })

  it('일시 장애는 폼 안에서 자기 여백을 갖지 않는다 — 폼을 밀지 않는다', () => {
    const markup = render(null, 500)

    expect(markup).not.toContain('py-12')
  })

  it('429 는 서버 문구 알림이고 재시도 버튼이 없다', () => {
    const markup = render('로그인 시도가 너무 많습니다.', 429)

    expect(markup).toContain('data-form-alert')
    expect(markup).toContain('로그인 시도가 너무 많습니다.')
    expect(markup).not.toContain(messages.common.temporaryErrorTitle)
    expect(markup).not.toContain('<button')
  })

  it('보여 줄 실패가 없으면 아무것도 그리지 않는다', () => {
    expect(render(null, null)).toBe('')
  })
})

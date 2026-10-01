import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { FormFailure } from '@/components/form-failure'
import { messages } from '@/lib/messages'

function render(
  message: string | null,
  errorStatus: number | null,
  submitting = false,
  announce: 'live' | 'focus' = 'focus',
) {
  return renderToStaticMarkup(
    createElement(FormFailure, {
      message,
      errorStatus,
      submitting,
      announce,
      onRetry: () => undefined,
    }),
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

  it('일시 장애는 제출 실패 뒤 포커스 대상이다 — FormAlert 가 하던 일이다', () => {
    const markup = render(null, 0)

    expect(markup).toContain('data-form-temporary-error=""')
    expect(markup).toContain('tabindex="-1"')
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

/*
  #1102 — 포커스를 받는 표시가 `role="alert"` 이기도 해서 알림 낭독과 포커스 낭독이 겹쳤다.
  어느 쪽으로 읽힐지는 호출부가 포커스 effect 와 같은 판정(`submitFailureAnnounce`)으로 넘긴다.
*/
describe('FormFailure — 낭독 경로는 하나다 (#1102)', () => {
  it.each([
    { name: '일시 장애', message: null, status: 503 },
    { name: '알림', message: '로그인 시도가 너무 많습니다.', status: 429 },
  ])('$name: focus 면 role 이 없다 — 포커스가 읽는다', ({ message, status }) => {
    const markup = render(message, status, false, 'focus')

    expect(markup).not.toContain('role="alert"')
    expect(markup).not.toContain('aria-live')
    expect(markup).toContain('tabindex="-1"')
  })

  it.each([
    { name: '일시 장애', message: null, status: 503 },
    {
      name: '알림 — 로그인 401 · 되돌림 안내처럼 포커스가 다른 칸으로 갈 때',
      message: '틀렸어요',
      status: 401,
    },
  ])('$name: live 면 role=alert 하나다', ({ message, status }) => {
    const markup = render(message, status, false, 'live')

    expect(markup.match(/role="alert"/g)).toHaveLength(1)
  })
})

/*
  #1101 — 반려견 폼은 제목을 가진 카드(`Surface lead title=...`) 안이라 일시 장애 제목을 한 단
  내린다 (#456①). 인증 폼은 화면 `h1` 바로 아래라 기본값 `h2` 그대로다.
*/
describe('FormFailure — 일시 장애 제목 레벨 (#1101)', () => {
  function renderWithHeading(headingLevel?: 2 | 3) {
    return renderToStaticMarkup(
      createElement(FormFailure, {
        message: null,
        errorStatus: 503,
        submitting: false,
        announce: 'focus',
        onRetry: () => undefined,
        ...(headingLevel === undefined ? {} : { headingLevel }),
      }),
    )
  }

  it('기본값은 h2 다 — 인증 폼의 기존 동작', () => {
    const markup = renderWithHeading()

    expect(markup).toContain(`>${messages.common.temporaryErrorTitle}</h2>`)
    expect(markup).not.toContain('<h3')
  })

  it('headingLevel 3 이면 h3 로 내린다', () => {
    const markup = renderWithHeading(3)

    expect(markup).toContain(`>${messages.common.temporaryErrorTitle}</h3>`)
    expect(markup).not.toContain('<h2')
  })
})

/*
  #1084 L2 — 다시 낸 요청이 도는 동안 직전 401 알림이 남아, 버튼은 "로그인 중" 인데 화면은
  "실패했다" 를 함께 말했다. 새 시도가 시작되면 직전 실패는 낡은 정보다.
*/
describe('FormFailure — 요청이 도는 동안에는 직전 실패를 걷는다 (#1084)', () => {
  it.each([
    { name: '401 알림', message: '이메일 또는 비밀번호가 올바르지 않습니다.', status: 401 },
    { name: '429 알림', message: '로그인 시도가 너무 많습니다.', status: 429 },
    { name: '5xx 일시 장애', message: null, status: 503 },
    { name: '무응답 일시 장애', message: null, status: 0 },
  ])('$name', ({ message, status }) => {
    expect(render(message, status)).not.toBe('')
    expect(render(message, status, true)).toBe('')
  })
})

/*
  #1078 이 남긴 덤 — 두 포커스 대상이 브라우저 기본 테두리(파랑)로 그려졌다. 토큰 링으로 바꾼다.
  채움만 있는(또는 아무것도 없는) 상자라 offset 을 둔다 (DESIGN.md §2-4 포커스 링 표).
*/
describe('FormFailure — 포커스 테두리는 토큰 링이다 (#1084)', () => {
  it.each([
    { name: '알림', markup: () => render('잠겼습니다.', 429) },
    { name: '일시 장애', markup: () => render(null, 500) },
  ])('$name', ({ markup }) => {
    const html = markup()

    expect(html).toContain('focus-visible:ring-brand-500')
    expect(html).toContain('focus-visible:ring-offset-2')
    expect(html).toContain('focus-visible:outline-none')
  })
})

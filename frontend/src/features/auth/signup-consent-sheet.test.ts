import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SignupConsentSheet } from '@/features/auth/signup-consent-sheet'
import { NO_SIGNUP_CONSENT } from '@/lib/auth/signup-consent'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { messages } from '@/lib/messages'

/*
  #1295 사소함 — 실행 버튼이 시트의 스크롤 영역 안에 있어, 낮은 기기에서 동의 네 줄에 밀려 화면 밖으로
  나갈 수 있었다. `BottomSheet` 의 `footer`(하단 고정)로 옮긴다.

  node 에는 `document` 가 없어 `toBody` 가 포털 대신 제자리에 그린다 — 마크업에서 자리를 잴 수 있다.
  Tab 가두기(N3)와 닫힐 때 복귀(N2)는 effect 의 일이라 `e2e/signup-consent-rejected.spec.ts` 가 본다.
*/
const ACTION_MARK = 'data-test-consent-action'

function render() {
  return renderToStaticMarkup(
    createElement(SignupConsentSheet, {
      open: true,
      onClose: () => undefined,
      consent: NO_SIGNUP_CONSENT,
      errors: NO_FORM_ERRORS,
      onConsentChange: () => undefined,
      onConsentAllChange: () => undefined,
      action: createElement('button', { type: 'button', [ACTION_MARK]: '' }, '실행'),
    }),
  )
}

describe('SignupConsentSheet — 실행 자리 (#1295)', () => {
  it('실행 버튼은 스크롤 영역이 아니라 하단 고정 footer 안에 선다', () => {
    const markup = render()
    const scrollStart = markup.indexOf('overflow-y-auto')
    const footerStart = markup.indexOf('data-sheet-footer')
    const action = markup.indexOf(ACTION_MARK)

    expect(scrollStart).toBeGreaterThan(-1)
    expect(footerStart).toBeGreaterThan(scrollStart)
    // 스크롤 영역(본문)에는 없다 — 동의 항목 사이의 구분선(`border-t`)으로 찾으면 본문 안에서도 맞는다
    expect(markup.slice(scrollStart, footerStart)).not.toContain(ACTION_MARK)
    expect(action).toBeGreaterThan(footerStart)
  })

  it('동의 항목은 스크롤 영역 안에 남는다', () => {
    const markup = render()
    const scrollStart = markup.indexOf('overflow-y-auto')
    const footerStart = markup.indexOf('data-sheet-footer')
    const consentAll = markup.indexOf(messages.auth.consentAllLabel)

    expect(consentAll).toBeGreaterThan(scrollStart)
    expect(consentAll).toBeLessThan(footerStart)
  })

  it('시트는 모달 대화상자다', () => {
    expect(render()).toMatch(/<div[^>]*role="dialog"[^>]*aria-modal="true"/)
  })
})

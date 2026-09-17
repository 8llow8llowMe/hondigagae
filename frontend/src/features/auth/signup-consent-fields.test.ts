import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { SignupConsentFields } from '@/features/auth/signup-consent-fields'
import { NO_SIGNUP_CONSENT } from '@/lib/auth/signup-consent'
import { NO_FORM_ERRORS } from '@/lib/form/field-errors'
import { LEGAL_HREF } from '@/lib/legal/links'
import { messages } from '@/lib/messages'

const noop = () => undefined

function render(props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(SignupConsentFields, {
      consent: NO_SIGNUP_CONSENT,
      errors: NO_FORM_ERRORS,
      onConsentChange: noop,
      ...props,
    }),
  )
}

describe('SignupConsentFields — 가입 동의 3종 (#688)', () => {
  it('세 항목을 모두 렌더한다 — 하나라도 빠지면 가입이 400 으로 막힌다', () => {
    const markup = render()

    expect(markup).toContain('id="termsAgreed"')
    expect(markup).toContain('id="privacyAgreed"')
    expect(markup).toContain('id="ageOver14Confirmed"')
    expect(markup).toContain(messages.auth.termsConsentLabel)
    expect(markup).toContain(messages.auth.privacyConsentLabel)
    expect(markup).toContain(messages.auth.ageConsentLabel)
  })

  it('그룹 라벨을 fieldset/legend 로 만든다 — 그룹은 label htmlFor 로 가리킬 수 없다', () => {
    const markup = render()

    expect(markup).toContain('<fieldset')
    expect(markup).toContain('<legend')
    expect(markup).toContain(messages.auth.consentHeading)
  })

  it('약관·처리방침에는 본문 링크를 단다 — 읽지 않고 동의하게 두지 않는다', () => {
    const markup = render()

    expect(markup).toContain(`href="${LEGAL_HREF.terms}"`)
    expect(markup).toContain(`href="${LEGAL_HREF.privacy}"`)
    expect(markup).toContain(messages.auth.consentDocumentLinkLabel(messages.legal.termsTitle))
    expect(markup).toContain(messages.auth.consentDocumentLinkLabel(messages.legal.privacyTitle))
  })

  /*
    만 14세 확인은 **읽을 문서가 없는 자기신고**다 (보호법 제22조의2). 링크를 달면
    존재하지 않는 페이지로 보내거나, 관계없는 문서를 "이것에 동의한다" 로 묶는다.
  */
  it('만 14세 항목에는 문서 링크가 없다 — 링크는 정확히 두 개다', () => {
    const markup = render()

    expect(markup.match(/<a /g) ?? []).toHaveLength(2)
  })

  it('새 창으로 연다 — 같은 탭으로 나가면 입력한 값과 단계가 사라진다', () => {
    const markup = render()

    expect(markup).toContain('target="_blank"')
  })

  it('체크 상태를 그대로 반영한다', () => {
    const markup = render({
      consent: { termsAgreed: true, privacyAgreed: false, ageOver14Confirmed: false },
    })

    expect(markup).toContain('checked=""')
  })

  it('항목별 오류를 그 체크박스 아래에 그리고 aria-invalid 를 켠다', () => {
    const markup = render({
      errors: { fields: { ageOver14Confirmed: '만 14세 이상만 가입할 수 있습니다.' }, form: null },
    })

    expect(markup).toContain('만 14세 이상만 가입할 수 있습니다.')
    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('id="ageOver14Confirmed-error"')
  })

  it('오류가 없으면 aria-invalid 를 켜지 않는다', () => {
    expect(render()).not.toContain('aria-invalid')
  })
})

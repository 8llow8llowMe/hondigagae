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
      onConsentAllChange: noop,
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

/*
  전체 동의 (#1083). **체크 상태는 셋에서 파생한다** — 따로 들지 않으므로 "하나라도 풀리면
  전체도 풀림" 이 렌더 결과로 드러난다. 체크박스 넷의 `checked` 를 id 로 짚어 센다.
*/
function isChecked(markup: string, id: string): boolean {
  const tag = markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0]
  if (tag === undefined) throw new Error(`#${id} 가 없다`)
  return tag.includes('checked=""')
}

const ALL = { termsAgreed: true, privacyAgreed: true, ageOver14Confirmed: true }

describe('SignupConsentFields — 전체 동의 (#1083)', () => {
  it('"모두 동의해요" 체크박스가 가입 동의 그룹 안, 세 항목보다 먼저 선다', () => {
    const markup = render()

    expect(markup).toContain('id="consentAll"')
    expect(markup).toContain(messages.auth.consentAllLabel)
    // 그룹 이름(legend) 안에 들어야 "가입 동의, 모두 동의해요" 로 함께 읽힌다
    expect(markup.indexOf('id="consentAll"')).toBeGreaterThan(markup.indexOf('<fieldset'))
    expect(markup.indexOf('id="consentAll"')).toBeLessThan(markup.indexOf('</fieldset>'))
    expect(markup.indexOf('id="consentAll"')).toBeLessThan(markup.indexOf('id="termsAgreed"'))
  })

  it('셋 다 켜져 있으면 전체 동의도 켜져 있다', () => {
    expect(isChecked(render({ consent: ALL }), 'consentAll')).toBe(true)
  })

  it('하나라도 꺼져 있으면 전체 동의도 꺼져 있다', () => {
    for (const key of Object.keys(ALL)) {
      const markup = render({ consent: { ...ALL, [key]: false } })

      expect(isChecked(markup, 'consentAll')).toBe(false)
      expect(isChecked(markup, key)).toBe(false)
    }
  })

  it('아무것도 동의하지 않았으면 전체 동의도 꺼져 있다', () => {
    expect(isChecked(render(), 'consentAll')).toBe(false)
  })

  it('aria-controls 로 한꺼번에 바꾸는 세 항목을 가리킨다', () => {
    expect(render()).toContain('aria-controls="termsAgreed privacyAgreed ageOver14Confirmed"')
  })

  it('비활성이면 전체 동의도 함께 잠긴다', () => {
    const markup = render({ disabled: true })

    expect(markup.match(/<input[^>]*disabled=""/g) ?? []).toHaveLength(4)
  })
})

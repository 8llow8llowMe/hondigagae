import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { VerificationCodeInput } from '@/features/auth/verification-code-input'

function render(props: { value?: string; invalid?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(VerificationCodeInput, {
      id: 'code',
      value: props.value ?? '',
      onValueChange: () => undefined,
      invalid: props.invalid ?? false,
    }),
  )
}

describe('VerificationCodeInput (#1078)', () => {
  it('모바일 키보드가 대문자로 시작하고 자동 고침 · 맞춤법 밑줄을 끈다', () => {
    const markup = render()

    expect(markup).toContain('autoCapitalize="characters"')
    expect(markup).toContain('autoCorrect="off"')
    expect(markup).toContain('spellCheck="false"')
  })

  it('영숫자 코드라 텍스트 키보드 + 일회용 코드 자동완성이다 (D6)', () => {
    const markup = render()

    expect(markup).toContain('inputMode="text"')
    expect(markup).toContain('autoComplete="one-time-code"')
  })

  /*
    브라우저는 붙여넣은 글자를 `maxlength` 로 **먼저** 자른다. `' a3k7mp2x'` 를 붙여넣으면
    공백을 지우기 전에 끝 글자가 잘려 7자짜리 틀린 코드가 된다 — 길이는 정규화가 자른다.
  */
  it('네이티브 maxlength 를 걸지 않는다 — 공백 섞인 붙여넣기가 잘린다', () => {
    expect(render()).not.toContain('maxLength')
  })

  it('오류면 aria-invalid 와 오류 문구 연결을 단다 — Input 배선 그대로', () => {
    const markup = render({ invalid: true })

    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain('aria-describedby="code-error"')
  })

  it('받은 값을 그대로 그린다 — 정규화는 입력 이벤트에서 한다', () => {
    expect(render({ value: 'A3K7' })).toContain('value="A3K7"')
  })
})

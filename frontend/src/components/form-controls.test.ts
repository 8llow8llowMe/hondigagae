import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Field, fieldErrorId } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { FormNotice } from '@/components/form-notice'
import { Input } from '@/components/input'
import { Textarea } from '@/components/textarea'
import { FORM_ALERT_SELECTOR } from '@/lib/form/submit-failure-focus'

describe('Field', () => {
  it('label 을 입력 id 에 연결한다', () => {
    const markup = renderToStaticMarkup(
      createElement(Field, {
        id: 'email',
        label: '이메일',
        children: createElement(Input, { id: 'email', value: '', onValueChange: () => undefined }),
      }),
    )

    expect(markup).toContain('for="email"')
    expect(markup).toContain('id="email"')
    expect(markup).toContain('이메일')
  })

  it('오류가 있으면 메시지를 오류 id 로 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(Field, {
        id: 'email',
        label: '이메일',
        error: '이메일 형식이 올바르지 않습니다.',
        children: createElement(Input, { id: 'email', value: '', onValueChange: () => undefined }),
      }),
    )

    expect(markup).toContain(`id="${fieldErrorId('email')}"`)
    expect(markup).toContain('이메일 형식이 올바르지 않습니다.')
  })

  it('오류가 없으면 오류 요소를 렌더하지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Field, {
        id: 'email',
        label: '이메일',
        children: createElement(Input, { id: 'email', value: '', onValueChange: () => undefined }),
      }),
    )

    expect(markup).not.toContain(fieldErrorId('email'))
  })
})

describe('Input', () => {
  it('오류 상태면 aria-invalid 와 aria-describedby 를 배선한다', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, {
        id: 'password',
        value: '',
        onValueChange: () => undefined,
        invalid: true,
      }),
    )

    expect(markup).toContain('aria-invalid="true"')
    expect(markup).toContain(`aria-describedby="${fieldErrorId('password')}"`)
  })

  it('정상 상태면 aria-invalid 를 붙이지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, { id: 'password', value: '', onValueChange: () => undefined }),
    )

    expect(markup).not.toContain('aria-invalid')
    expect(markup).not.toContain('aria-describedby')
  })

  /*
    #1084 L5 — 오류 상태에 포커스하면 빨간 테두리에 초록 링 1px 이 붙어 두 색이 다퉜다.
    링 색은 테두리를 따른다. `PasswordInput` · `VerificationCodeInput` 이 이 칸을 그대로 쓴다.
  */
  it('오류 상태면 포커스 링이 테두리와 같은 빨강이다 — 초록 링이 붙지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, {
        id: 'email',
        value: '',
        onValueChange: () => undefined,
        invalid: true,
      }),
    )

    expect(markup).toContain('border-danger-500')
    expect(markup).toContain('focus-visible:ring-danger-500')
    expect(markup).not.toContain('ring-brand-500')
  })

  it('정상 상태의 포커스 링은 그대로 초록이다', () => {
    const markup = renderToStaticMarkup(
      createElement(Input, { id: 'email', value: '', onValueChange: () => undefined }),
    )

    expect(markup).toContain('focus-visible:ring-brand-500')
    expect(markup).not.toContain('ring-danger-500')
  })
})

describe('Textarea — 오류 상태 포커스 링 (#1084)', () => {
  it('Textarea 도 오류면 빨간 링이다', () => {
    const markup = renderToStaticMarkup(
      createElement(Textarea, {
        id: 'memo',
        value: '',
        onValueChange: () => undefined,
        invalid: true,
      }),
    )

    expect(markup).toContain('focus-visible:ring-danger-500')
    expect(markup).not.toContain('ring-brand-500')
  })
})

describe('FormAlert', () => {
  it('메시지가 있으면 role=alert 로 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(FormAlert, { message: '이메일 또는 비밀번호가 올바르지 않습니다.' }),
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('이메일 또는 비밀번호가 올바르지 않습니다.')
  })

  it('메시지가 없으면 아무것도 렌더하지 않는다', () => {
    expect(renderToStaticMarkup(createElement(FormAlert, { message: null }))).toBe('')
  })

  /*
    제출 실패 뒤 포커스 대상이다 (#1078). 탭 순서에는 끼지 않고(-1) 프로그램으로만 받는다.
    `focusSubmitFailure` 는 `role` 이 아니라 이 속성으로 찾는다 — 둘이 어긋나면 포커스가 BODY 로 샌다.
  */
  it('프로그램 포커스를 받는다 — tabindex=-1 과 data-form-alert', () => {
    const markup = renderToStaticMarkup(createElement(FormAlert, { message: '잠겼습니다.' }))

    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('data-form-alert=""')
    expect(FORM_ALERT_SELECTOR).toBe('[data-form-alert]')
  })

  /*
    #1102 — 포커스를 받는 알림이 `role="alert"` 이기도 하면 알림 낭독과 포커스 낭독이 겹친다.
    `announce="focus"` 는 역할을 떼고 포커스 하나로 읽힌다. 기본값은 지금 그대로다 — 인증 밖
    30여 곳은 포커스를 옮기지 않으므로 알림이 유일한 낭독 경로다.
  */
  it('announce 기본값은 live — role=alert 그대로다', () => {
    const markup = renderToStaticMarkup(createElement(FormAlert, { message: '잠겼습니다.' }))

    expect(markup).toContain('role="alert"')
  })

  it('announce=focus 면 role 을 떼고 포커스 대상 배선은 남긴다', () => {
    const markup = renderToStaticMarkup(
      createElement(FormAlert, { message: '잠겼습니다.', announce: 'focus' }),
    )

    expect(markup).not.toContain('role=')
    expect(markup).not.toContain('aria-live')
    expect(markup).toContain('tabindex="-1"')
    expect(markup).toContain('data-form-alert=""')
    expect(markup).toContain('잠겼습니다.')
  })

  // #1084 — 예전에는 브라우저 기본 테두리(`rgb(0,95,204)` 파랑)로 그려졌다
  it('포커스 테두리는 토큰 링이다 — 채움만 있는 상자라 offset 을 둔다', () => {
    const markup = renderToStaticMarkup(createElement(FormAlert, { message: '잠겼습니다.' }))

    expect(markup).toContain('focus-visible:ring-brand-500')
    expect(markup).toContain('focus-visible:ring-offset-2')
    expect(markup).toContain('focus-visible:outline-none')
  })
})

describe('FormNotice', () => {
  it('메시지가 있으면 role=status 로 렌더한다', () => {
    const markup = renderToStaticMarkup(
      createElement(FormNotice, { message: '메일로 인증코드를 보냈어요.' }),
    )

    expect(markup).toContain('role="status"')
    expect(markup).toContain('메일로 인증코드를 보냈어요.')
  })

  it('메시지가 없으면 아무것도 렌더하지 않는다', () => {
    expect(renderToStaticMarkup(createElement(FormNotice, { message: null }))).toBe('')
  })
})

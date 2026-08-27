import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Field, fieldErrorId } from '@/components/field'
import { FormAlert } from '@/components/form-alert'
import { Input } from '@/components/input'

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
})

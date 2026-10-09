import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { AmountInput } from '@/components/amount-input'
import { DateField } from '@/components/date-field'
import { Field, fieldDescription, fieldErrorId, fieldHintId } from '@/components/field'
import { Input } from '@/components/input'
import { PasswordInput } from '@/components/password-input'
import { Textarea } from '@/components/textarea'

/*
  #1100 — `Field` 의 `hint` 가 입력란의 `aria-describedby` 에 이어지지 않아, 스크린리더가 칸에
  들어가도 안내(가입 3단계 비밀번호 규칙 등)를 읽지 못했다.

  규칙: **화면에 실제로 보이는 설명만 잇는다.** 오류가 hint 자리를 대신하면(#1080) 오류 id 하나만,
  둘 다 없으면 속성 자체를 걸지 않는다 — 없는 id 를 가리키면 안 된다.
*/

const HINT = '8~20자, 영문 · 숫자 · 특수문자 각 1자 이상'
const ERROR = '비밀번호 규칙에 맞지 않습니다.'

function describedByOf(markup: string, id: string): string | null {
  const tag = new RegExp(`<(?:input|textarea)[^>]*\\bid="${id}"[^>]*>`).exec(markup)?.[0]
  if (tag === undefined) throw new Error(`id="${id}" 인 입력 요소가 없다`)
  return /aria-describedby="([^"]*)"/.exec(tag)?.[1] ?? null
}

/** `aria-describedby` 가 가리키는 id 가 전부 마크업에 실제로 있는지 */
function expectDescribedByResolves(markup: string, id: string) {
  const describedBy = describedByOf(markup, id)
  for (const target of (describedBy ?? '').split(' ').filter(Boolean)) {
    expect(markup).toContain(`id="${target}"`)
  }
}

function renderField(props: { error?: string; hint?: string }, child: ReactElement): string {
  return renderToStaticMarkup(
    createElement(Field, { id: 'password', label: '비밀번호', ...props, children: child }),
  )
}

const input = (invalid: boolean) =>
  createElement(Input, { id: 'password', value: '', onValueChange: () => undefined, invalid })

describe('fieldHintId', () => {
  it('오류 id 와 같은 자리에서 같은 꼴로 만든다', () => {
    expect(fieldHintId('password')).toBe('password-hint')
    expect(fieldHintId('password')).not.toBe(fieldErrorId('password'))
  })
})

describe('fieldDescription', () => {
  it('hint 만 있으면 hint 를 보이고 hint id 를 잇는다', () => {
    expect(fieldDescription({ id: 'password', hint: HINT, error: undefined })).toEqual({
      hintShown: true,
      errorShown: false,
      describedBy: 'password-hint',
    })
  })

  it('오류가 있으면 오류가 hint 자리를 대신하고 오류 id 만 잇는다', () => {
    expect(fieldDescription({ id: 'password', hint: HINT, error: ERROR })).toEqual({
      hintShown: false,
      errorShown: true,
      describedBy: 'password-error',
    })
  })

  it('오류만 있으면 오류 id 를 잇는다', () => {
    expect(fieldDescription({ id: 'password', hint: undefined, error: ERROR })).toEqual({
      hintShown: false,
      errorShown: true,
      describedBy: 'password-error',
    })
  })

  it('둘 다 없으면 아무것도 잇지 않는다', () => {
    expect(fieldDescription({ id: 'password', hint: undefined, error: undefined })).toEqual({
      hintShown: false,
      errorShown: false,
      describedBy: undefined,
    })
  })
})

describe('fieldDescription — 칸 바깥 문단을 덧붙인다 (#1295)', () => {
  /*
    가입 단계의 첫 칸이 "3단계 중 N단계"(sr-only)를 가리킨다. 단계 전환 때 포커스가 곧장 그 칸으로
    가서, 칸이 이 문단을 참조하지 않으면 단계가 낭독되지 않는다 (회원가입-세부명세 D15).
  */
  it('자기 설명 뒤에 덧붙인다 — 안내 · 오류가 먼저 읽힌다', () => {
    expect(
      fieldDescription({ id: 'password', hint: HINT, error: undefined, extra: 'step' }).describedBy,
    ).toBe('password-hint step')
    expect(
      fieldDescription({ id: 'password', hint: HINT, error: ERROR, extra: 'step' }).describedBy,
    ).toBe('password-error step')
  })

  it('자기 설명이 없으면 덧붙인 것 하나다', () => {
    expect(
      fieldDescription({ id: 'email', hint: undefined, error: undefined, extra: 'step' })
        .describedBy,
    ).toBe('step')
  })

  it('덧붙일 것이 없으면 예전 그대로다', () => {
    expect(
      fieldDescription({ id: 'email', hint: undefined, error: undefined, extra: undefined })
        .describedBy,
    ).toBeUndefined()
  })

  it('Field 의 extraDescribedBy 가 입력란까지 내려간다', () => {
    const markup = renderToStaticMarkup(
      createElement(Field, {
        id: 'password',
        label: '비밀번호',
        hint: HINT,
        extraDescribedBy: 'signup-step-status',
        children: input(false),
      }),
    )

    expect(describedByOf(markup, 'password')).toBe(`${fieldHintId('password')} signup-step-status`)
  })
})

describe('Field · Input — aria-describedby (#1100)', () => {
  it('정상 상태면 hint 를 hint id 로 렌더하고 입력란이 그것을 가리킨다', () => {
    const markup = renderField({ hint: HINT }, input(false))

    expect(markup).toContain(`id="${fieldHintId('password')}"`)
    expect(describedByOf(markup, 'password')).toBe(fieldHintId('password'))
    expectDescribedByResolves(markup, 'password')
  })

  it('오류 상태면 오류 id 만 가리킨다 — 감춰진 hint 를 겹쳐 읽히지 않는다', () => {
    const markup = renderField({ hint: HINT, error: ERROR }, input(true))

    expect(describedByOf(markup, 'password')).toBe(fieldErrorId('password'))
    expect(markup).not.toContain(fieldHintId('password'))
    expect(markup).not.toContain(HINT)
    expectDescribedByResolves(markup, 'password')
  })

  it('hint 가 없으면 aria-describedby 를 걸지 않는다', () => {
    const markup = renderField({}, input(false))

    expect(markup).not.toContain('aria-describedby')
  })

  it('hint 없이 오류만 있으면 오류 id 를 가리킨다', () => {
    const markup = renderField({ error: ERROR }, input(true))

    expect(describedByOf(markup, 'password')).toBe(fieldErrorId('password'))
  })

  it('Field 와 id 가 다른 입력은 Field 의 설명을 가져가지 않는다', () => {
    const markup = renderField(
      { hint: HINT },
      createElement(Input, { id: 'other', value: '', onValueChange: () => undefined }),
    )

    expect(describedByOf(markup, 'other')).toBeNull()
  })

  it('Field 밖의 Input 은 지금처럼 invalid 일 때 오류 id 를 가리킨다', () => {
    const markup = renderToStaticMarkup(input(true))

    expect(describedByOf(markup, 'password')).toBe(fieldErrorId('password'))
  })
})

describe('같은 배선을 쓰는 입력 — Field 안에서 hint 를 가리킨다', () => {
  const cases: Array<[string, ReactElement]> = [
    [
      'PasswordInput',
      createElement(PasswordInput, { id: 'password', value: '', onValueChange: () => undefined }),
    ],
    [
      'AmountInput',
      createElement(AmountInput, { id: 'password', value: '', onValueChange: () => undefined }),
    ],
    [
      'Textarea',
      createElement(Textarea, { id: 'password', value: '', onValueChange: () => undefined }),
    ],
    [
      'DateField',
      createElement(DateField, {
        id: 'password',
        value: '',
        onValueChange: () => undefined,
        label: '여행 시작일',
        placeholder: '날짜 선택',
        today: '2026-10-01',
      }),
    ],
  ]

  it.each(cases)('%s — 정상 상태면 hint id', (_name, child) => {
    const markup = renderField({ hint: HINT }, child)

    expect(describedByOf(markup, 'password')).toBe(fieldHintId('password'))
    expectDescribedByResolves(markup, 'password')
  })

  it.each(cases)('%s — 오류 상태면 오류 id 만', (_name, child) => {
    const markup = renderField({ hint: HINT, error: ERROR }, child)

    expect(describedByOf(markup, 'password')).toBe(fieldErrorId('password'))
    expectDescribedByResolves(markup, 'password')
  })
})

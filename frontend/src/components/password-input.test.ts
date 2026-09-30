import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { fieldErrorId } from '@/components/field'
import { PasswordInput, type PasswordInputProps, passwordReveal } from '@/components/password-input'
import { messages } from '@/lib/messages'

/**
 * `PasswordInput` 의 마크업 계약 — 이슈 #1080.
 *
 * node 환경에는 클릭이 없어 **처음 그린 상태(가려짐)** 만 렌더로 본다 (`testing-guide.md` §1).
 * 누른 뒤의 상태는 `passwordReveal` 이 정하고, 그 두 갈래를 아래에서 순수 함수로 본다.
 */
function render(props: Partial<PasswordInputProps> = {}) {
  return renderToStaticMarkup(
    createElement(PasswordInput, {
      id: 'password',
      value: '',
      onValueChange: () => undefined,
      ...props,
    }),
  )
}

describe('PasswordInput — 처음 그린 상태', () => {
  it('가려진 채로 시작한다 — 어깨너머로 보이지 않게', () => {
    const html = render()

    expect(html).toContain('type="password"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain(`aria-label="${messages.auth.passwordShow}"`)
  })

  it('토글이 자기가 여닫는 입력란을 가리킨다 — 아이콘은 입력란 안에 시각적으로만 붙어 있다', () => {
    expect(render({ id: 'newPassword' })).toContain('aria-controls="newPassword"')
  })

  it('토글은 submit 버튼이 아니다 — 폼 안에서 눌러도 제출되지 않는다', () => {
    expect(render()).toContain('type="button"')
  })

  it('입력란 안에 버튼 자리를 비운다 — 값이 눈 아이콘 밑으로 들어가지 않는다', () => {
    expect(render()).toContain('pr-12')
  })

  it('값 · 자동완성 힌트는 그대로 넘긴다', () => {
    const html = render({ value: 'abc!1234', autoComplete: 'new-password' })

    expect(html).toContain('value="abc!1234"')
    expect(html).toContain('autoComplete="new-password"')
  })

  it('오류 배선은 Input 의 것을 그대로 쓴다', () => {
    const html = render({ invalid: true })

    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain(`aria-describedby="${fieldErrorId('password')}"`)
  })

  /*
    한 화면에 비밀번호 칸이 둘이면(마이페이지 변경 폼) 버튼 이름이 둘 다 "비밀번호 표시" 가 되어
    버튼 목록으로 훑는 스크린리더 사용자에게 어느 칸인지 들리지 않는다.
  */
  it('버튼 이름을 바꿀 수 있다 — 비밀번호 칸이 둘인 화면', () => {
    const html = render({
      revealLabels: {
        show: messages.member.currentPasswordShow,
        hide: messages.member.currentPasswordHide,
      },
    })

    expect(html).toContain(`aria-label="${messages.member.currentPasswordShow}"`)
    expect(html).not.toContain(`aria-label="${messages.auth.passwordShow}"`)
  })
})

describe('passwordReveal — 누른 뒤의 상태', () => {
  const labels = { show: messages.auth.passwordShow, hide: messages.auth.passwordHide }

  it('가려짐 → password 입력, 버튼은 "표시"', () => {
    expect(passwordReveal(false, labels)).toEqual({
      type: 'password',
      toggleLabel: messages.auth.passwordShow,
    })
  })

  /*
    **아이콘 버튼의 이름은 `aria-label` 뿐이다** — 눈 아이콘이 `aria-hidden` 이다. `Button` 의
    `iconOnly` 유니온이 이름이 있는 것은 타입으로 강제하지만, 이름이 상태를 따라 바뀌는 것은 못 본다.
  */
  it('보임 → text 입력, 버튼은 "숨기기"', () => {
    expect(passwordReveal(true, labels)).toEqual({
      type: 'text',
      toggleLabel: messages.auth.passwordHide,
    })
  })
})

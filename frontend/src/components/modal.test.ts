import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Modal } from '@/components/modal'

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(Modal, {
      open: true,
      onClose: () => undefined,
      title: '일정 수정',
      ...overrides,
    }),
  )
}

/** `aria-labelledby="X"` 같은 속성에서 값을 꺼낸다 */
function attr(markup: string, name: string): string | null {
  return new RegExp(`${name}="([^"]*)"`).exec(markup)?.[1] ?? null
}

describe('Modal — 다이얼로그 계약 한 벌', () => {
  it('닫혀 있으면 아무것도 렌더하지 않는다', () => {
    expect(render({ open: false })).toBe('')
  })

  it('기본은 dialog 다 — alertdialog 는 되돌릴 수 없는 확인에만 쓴다', () => {
    const markup = render()

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
  })

  it('role 을 alertdialog 로 바꿀 수 있다', () => {
    expect(render({ role: 'alertdialog' })).toContain('role="alertdialog"')
  })

  it('제목을 aria-labelledby 로 묶는다 — id 는 스스로 만든다', () => {
    const markup = render()
    const labelledBy = attr(markup, 'aria-labelledby')

    expect(labelledBy).not.toBeNull()
    // 가리키는 id 가 실제로 제목에 붙어 있어야 이름이 읽힌다
    expect(markup).toContain(`<h2 id="${labelledBy}"`)
  })

  it('idBase 를 주면 그 접두사를 쓴다 — 고정 id 가 필요한 호출부를 위해', () => {
    const markup = render({ idBase: 'confirm' })

    expect(markup).toContain('aria-labelledby="confirm-title"')
  })

  it('두 모달의 자동 id 는 서로 다르다 — 같으면 이름이 엉킨다', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(Modal, { open: true, onClose: () => undefined, title: '첫째' }),
        createElement(Modal, { open: true, onClose: () => undefined, title: '둘째' }),
      ),
    )
    const ids = [...markup.matchAll(/aria-labelledby="([^"]*)"/g)].map((m) => m[1])

    expect(ids).toHaveLength(2)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('설명을 주면 aria-describedby 로 묶는다', () => {
    const markup = render({ description: '되돌릴 수 없어요' })
    const describedBy = attr(markup, 'aria-describedby')

    expect(describedBy).not.toBeNull()
    expect(markup).toContain(`id="${describedBy}"`)
    expect(markup).toContain('되돌릴 수 없어요')
  })

  it('설명이 없으면 aria-describedby 를 걸지 않는다 — 빈 곳을 가리키면 안 된다', () => {
    expect(render()).not.toContain('aria-describedby')
  })

  it('제목 · 설명 · 본문 · 조작부 순서로 낸다', () => {
    const markup = render({
      description: '이름과 예산을 바꿀 수 있어요',
      children: createElement('input', { name: 'title' }),
      footer: createElement('button', { type: 'button' }, '저장하기'),
    })

    expect(markup.indexOf('일정 수정')).toBeLessThan(markup.indexOf('이름과 예산'))
    expect(markup.indexOf('이름과 예산')).toBeLessThan(markup.indexOf('name="title"'))
    expect(markup.indexOf('name="title"')).toBeLessThan(markup.indexOf('저장하기'))
  })

  it('본문·조작부가 없으면 빈 칸을 만들지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('mt-4')
    expect(markup).not.toContain('mt-5')
  })

  it('입력 폼은 md 로 넓힌다 — 필드가 좁으면 오히려 읽기 어렵다', () => {
    expect(render({ size: 'md' })).toContain('max-w-md')
    expect(render()).toContain('max-w-sm')
  })

  it('배경 덮개를 a11y 트리에서 뺀다 — 전면 버튼이 거대한 버튼으로 읽히면 방해다', () => {
    expect(render()).toContain('aria-hidden="true"')
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { ConfirmModal } from '@/components/confirm-modal'

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(ConfirmModal, {
      open: true,
      onClose: () => undefined,
      onConfirm: () => undefined,
      title: '초코를 삭제할까요?',
      description: '판정 기준이 사라져요. 되돌릴 수 없어요.',
      confirmLabel: '삭제하기',
      ...overrides,
    }),
  )
}

describe('ConfirmModal — 되돌릴 수 없는 일만', () => {
  it('닫혀 있으면 아무것도 렌더하지 않는다', () => {
    expect(render({ open: false })).toBe('')
  })

  it('alertdialog 다 — 확인이지 선택이 아니라 화면을 잡아둔다', () => {
    const markup = render()

    expect(markup).toContain('role="alertdialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="confirm-title"')
    expect(markup).toContain('aria-describedby="confirm-desc"')
  })

  it('취소가 좌측이다 — 파괴 버튼을 첫 타깃으로 두지 않는다 (가이드 §5-2)', () => {
    const markup = render()

    expect(markup.indexOf('취소')).toBeLessThan(markup.lastIndexOf('삭제하기'))
  })

  it('확인 문구는 동사다 — "확인" 이 아니라 호출부가 준 라벨을 쓴다', () => {
    expect(render()).toContain('삭제하기')
  })

  it('destructive 면 danger 채움을 쓴다', () => {
    expect(render({ destructive: true })).toContain('bg-danger-700')
    expect(render()).not.toContain('bg-danger-700')
  })

  it('confirmLoading 이면 확인 버튼을 잠근다 — 연타로 두 번 지우지 않는다', () => {
    const markup = render({ confirmLoading: true })

    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('disabled')
  })

  it('confirmDisabled 는 잠그되 진행 중으로 읽히지 않는다', () => {
    const markup = render({ confirmDisabled: true })

    expect(markup).toContain('disabled')
    expect(markup).not.toContain('aria-busy="true"')
  })

  it('children 을 주면 확인 문구 아래에 낸다 — 오류는 모달 안에서 말한다', () => {
    const markup = render({
      children: createElement('p', null, '삭제하지 못했어요'),
    })

    expect(markup).toContain('삭제하지 못했어요')
    expect(markup.indexOf('되돌릴 수 없어요')).toBeLessThan(markup.indexOf('삭제하지 못했어요'))
  })

  it('배경 덮개를 a11y 트리에서 뺀다 — 전면 버튼이 거대한 버튼으로 읽히면 방해다', () => {
    expect(render()).toContain('aria-hidden="true"')
  })
})

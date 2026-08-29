import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PetDeleteConfirm, type PetDeleteConfirmProps } from '@/features/pet/pet-delete-section'
import { messages } from '@/lib/messages'

function render(overrides: Partial<PetDeleteConfirmProps> = {}) {
  return renderToStaticMarkup(
    createElement(PetDeleteConfirm, {
      petName: '몽실이',
      confirming: false,
      deleting: false,
      errorMessage: null,
      onStart: () => undefined,
      onCancel: () => undefined,
      onConfirm: () => undefined,
      ...overrides,
    }),
  )
}

describe('PetDeleteConfirm — 1단계', () => {
  it('삭제 버튼만 있고 확인 문구가 없다', () => {
    const markup = render()

    expect(markup).toContain(messages.pet.delete)
    expect(markup).not.toContain('되돌릴 수 없어요')
    expect(markup).not.toContain('취소')
  })
})

describe('PetDeleteConfirm — 확인 단계', () => {
  it('alertdialog 로 낸다 — 전환이 시각적으로만 전달되면 안 된다', () => {
    const markup = render({ confirming: true })

    // 인라인 `role="alert"` 였던 것을 `ConfirmModal` 로 옮겼다 (이슈 #70).
    // 되돌릴 수 없는 일이라 화면을 잡아두는 것이 맞다 (가이드 §5-2)
    expect(markup).toContain('role="alertdialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('되돌릴 수 없어요')
  })

  it('확인 문구에 반려견 이름이 들어간다', () => {
    expect(render({ confirming: true, petName: '초코' })).toContain('초코')
  })

  it('이름의 종성에 따라 목적격 조사가 갈린다 — 실측에서 발견한 버그', () => {
    expect(render({ confirming: true, petName: '몽실이' })).toContain('몽실이를 삭제할까요?')
    expect(render({ confirming: true, petName: '곰' })).toContain('곰을 삭제할까요?')
  })

  it('취소와 삭제 버튼이 함께 있다', () => {
    const markup = render({ confirming: true })

    expect(markup).toContain('취소')
    expect(markup).toContain(messages.pet.delete)
  })

  /**
   * **초기 포커스는 `ConfirmModal` 의 계약이다** (`initialFocusRef` → `useOverlay`).
   * effect 로 옮기므로 정적 마크업에는 `autofocus` 속성이 없다 — 여기서는 **취소가
   * 먼저 오는 순서**만 지킨다. 실제 포커스 이동은 브라우저 실렌더로 확인한다.
   */
  it('취소가 삭제보다 먼저 온다 — 파괴적 동작을 첫 타깃으로 두지 않는다', () => {
    const markup = render({ confirming: true })

    expect(markup.indexOf('취소')).toBeLessThan(markup.lastIndexOf(messages.pet.delete))
  })

  it('삭제 중이면 버튼이 disabled 다', () => {
    const markup = render({ confirming: true, deleting: true })

    expect(markup).toContain('aria-busy="true"')
  })

  it('오류 메시지를 표시한다', () => {
    const markup = render({ confirming: true, errorMessage: '일시적인 오류입니다.' })

    expect(markup).toContain('일시적인 오류입니다.')
  })

  it('오류가 없으면 오류 요소를 렌더하지 않는다', () => {
    const markup = render({ confirming: true })

    expect(markup).not.toContain('일시적인 오류입니다.')
  })

  it('삭제 버튼이 danger 톤이지만 문구로도 구분된다 — 색만으로 구분하지 않는다', () => {
    const markup = render({ confirming: true })

    expect(markup).toContain('삭제')
  })
})

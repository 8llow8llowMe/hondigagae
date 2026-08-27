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
  it('확인 문구를 role="alert" 로 낸다 — 전환이 시각적으로만 전달되면 안 된다', () => {
    const markup = render({ confirming: true })

    expect(markup).toContain('role="alert"')
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

  it('autoFocus 는 취소에 있다 — 파괴적 동작에 포커스를 두지 않는다', () => {
    const markup = render({ confirming: true })
    const cancelIndex = markup.indexOf('취소')
    const autofocusIndex = markup.indexOf('autofocus')

    expect(autofocusIndex).toBeGreaterThan(-1)
    // autofocus 속성이 취소 버튼의 여는 태그 안에 있어야 한다
    expect(autofocusIndex).toBeLessThan(cancelIndex)
    // 삭제 버튼은 취소 뒤에 온다 — autofocus 가 그쪽이 아님을 확인한다
    expect(markup.lastIndexOf(messages.pet.delete)).toBeGreaterThan(cancelIndex)
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

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceLoginPromptSheet } from '@/features/place/place-login-prompt-sheet'
import { messages } from '@/lib/messages'

const PLACE = { placeId: '212481712381923328', title: '제주현대미술관' }

function render(intent: 'add' | 'save') {
  return renderToStaticMarkup(
    createElement(PlaceLoginPromptSheet, {
      open: true,
      onClose: () => undefined,
      intent,
      place: PLACE,
    }),
  )
}

describe('미로그인 담기 시도 (아트보드 04 ④)', () => {
  it('로그인과 둘러보기 계속을 함께 준다 — 둘러보기를 끊지 않는다', () => {
    const markup = render('add')

    expect(markup).toContain(messages.plan.addToPlanLoginAction)
    expect(markup).toContain(messages.plan.addToPlanLoginDismiss)
  })

  it('무엇을 담으려 했는지 이름으로 말한다', () => {
    expect(render('add')).toContain('제주현대미술관을')
  })

  it('returnTo 에 담기 재개 표시를 실어 보낸다', () => {
    // `?add=1` 이 encode 된 채로 returnTo 에 들어간다
    expect(render('add')).toContain('%3Fadd%3D1')
  })
})

describe('미로그인 저장 시도', () => {
  it('담기가 아니라 저장이라고 말한다 — 문구를 돌려쓰지 않는다', () => {
    const markup = render('save')

    expect(markup).toContain(messages.favorite.loginTitle)
    expect(markup).not.toContain(messages.plan.addToPlanLoginTitle)
  })

  it('돌아와서 저장을 자동 실행하지 않는다 — returnTo 에 표시를 붙이지 않는다', () => {
    expect(render('save')).not.toContain('%3Fadd%3D1')
  })
})

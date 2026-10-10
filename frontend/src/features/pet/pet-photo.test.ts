import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PET_AVATAR_DEFAULT } from '@/components/pet-avatar'
import { PetPhoto } from '@/features/pet/pet-photo'

function render(url: string | null) {
  return renderToStaticMarkup(createElement(PetPhoto, { url }))
}

describe('PetPhoto', () => {
  /*
    **이니셜이 아니라 기본 그림이다** (#1022 · #1047) — 크기와 상관없이 `PetAvatar` 와 같다.
    SVG 라 `next/image` 가 최적화 경로로 감싸지 않고 그대로 싣는다.
  */
  it('사진이 없으면 기본 그림으로 떨어진다 — 빈 원형을 남기지 않는다', () => {
    expect(render(null)).toContain(PET_AVATAR_DEFAULT.src)
  })

  it('빈 문자열도 없는 것으로 본다', () => {
    expect(render('')).toContain(PET_AVATAR_DEFAULT.src)
  })

  it('사진이 있으면 그린다', () => {
    const markup = render('https://storage.example.com/pets/1.jpg')

    expect(markup).toContain('https://storage.example.com/pets/1.jpg')
    expect(markup).not.toContain(PET_AVATAR_DEFAULT.src)
  })

  it('alt 를 비운다 — 이름이 항상 옆에 글자로 있어 두 번 읽힌다', () => {
    expect(render(null)).toContain('alt=""')
    expect(render('https://storage.example.com/pets/1.jpg')).toContain('alt=""')
  })

  it('사진과 폴백이 같은 크기다 — 레이아웃이 흔들리면 목록을 훑을 수 없다', () => {
    expect(render(null)).toContain('size-12')
    expect(render('https://storage.example.com/pets/1.jpg')).toContain('size-12')
  })
})

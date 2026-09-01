import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PetPhoto } from '@/features/pet/pet-photo'

function render(url: string | null) {
  return renderToStaticMarkup(createElement(PetPhoto, { name: '몽실이', url }))
}

describe('PetPhoto', () => {
  it('사진이 없으면 이름 첫 글자로 떨어진다 — 빈 원형을 남기지 않는다', () => {
    const markup = render(null)

    expect(markup).toContain('몽')
    expect(markup).not.toContain('<img')
  })

  it('빈 문자열도 없는 것으로 본다', () => {
    expect(render('')).not.toContain('<img')
  })

  it('사진이 있으면 그린다', () => {
    const markup = render('https://storage.example.com/pets/1.jpg')

    expect(markup).toContain('<img')
    expect(markup).toContain('https://storage.example.com/pets/1.jpg')
  })

  it('alt 를 비운다 — 이름이 항상 옆에 글자로 있어 두 번 읽힌다', () => {
    expect(render('https://storage.example.com/pets/1.jpg')).toContain('alt=""')
  })

  it('사진과 폴백이 같은 크기다 — 레이아웃이 흔들리면 목록을 훑을 수 없다', () => {
    expect(render(null)).toContain('size-12')
    expect(render('https://storage.example.com/pets/1.jpg')).toContain('size-12')
  })
})

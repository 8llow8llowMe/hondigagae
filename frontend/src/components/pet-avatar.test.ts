import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PET_AVATAR_DEFAULT, PetAvatar, type PetAvatarSize } from '@/components/pet-avatar'

function render(size: PetAvatarSize, url: string | null = null) {
  return renderToStaticMarkup(createElement(PetAvatar, { name: '몽실이', url, size }))
}

describe('PetAvatar — 사진이 없을 때 (#1022)', () => {
  /*
    **40 이상은 기본 그림이다.** 홈 프로필 · 마이페이지 행처럼 원이 큰 자리에서 이니셜 한 글자는
    빈 자리처럼 읽혔다. 폴백 순서의 가운데 단계(견종 일러스트)를 한 장의 그림이 맡는다.
  */
  it.each(['xl', 'hero'] as const)('%s 는 기본 그림을 그린다', (size) => {
    const markup = render(size)

    expect(markup).toContain(PET_AVATAR_DEFAULT.src)
    expect(markup).not.toContain('몽')
  })

  /*
    **24~32 칩은 이니셜 그대로다.** 크림색 개가 회색 원 안에서 24 로 줄면 형체가 뭉개진다 —
    칩은 옆에 이름이 늘 붙어 있다.
  */
  it.each(['sm', 'md', 'lg'] as const)('%s 는 이니셜을 그린다', (size) => {
    const markup = render(size)

    expect(markup).toContain('몽')
    expect(markup).not.toContain(PET_AVATAR_DEFAULT.src)
  })

  it('기본 그림도 스크린리더에 없다 — 이름이 옆에 글자로 있다', () => {
    const markup = render('hero')

    expect(markup).toContain('alt=""')
    expect(markup).toContain('aria-hidden="true"')
  })
})

describe('PetAvatar — 사진이 있을 때', () => {
  it('크기와 상관없이 사진을 그린다', () => {
    for (const size of ['sm', 'hero'] as const) {
      const markup = render(size, 'https://storage.example.com/pets/1.jpg')

      expect(markup).toContain('https://storage.example.com/pets/1.jpg')
      expect(markup).not.toContain(PET_AVATAR_DEFAULT.src)
    }
  })
})

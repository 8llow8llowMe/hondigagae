import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PET_AVATAR_DEFAULT, PetAvatar, type PetAvatarSize } from '@/components/pet-avatar'

function render(size: PetAvatarSize, url: string | null = null) {
  return renderToStaticMarkup(createElement(PetAvatar, { url, size }))
}

describe('PetAvatar — 사진이 없을 때 (#1022 · #1047)', () => {
  /*
    **크기와 상관없이 기본 그림이다** (#1047). #1022 는 24~32 칩에 이니셜을 남겼는데, 같은 아이가
    한 화면에서 크기에 따라 그림과 글자 두 모양으로 보였다. 이름은 칩 옆에 늘 글자로 있다.
  */
  it.each(['sm', 'md', 'lg', 'xl', 'hero'] as const)('%s 는 기본 그림을 그린다', (size) => {
    const markup = render(size)

    expect(markup).toContain(PET_AVATAR_DEFAULT.src)
    expect(markup).not.toContain('<span')
  })

  it('선택되지 않은 기본 그림은 사진과 같이 흐리게 물러난다', () => {
    const markup = renderToStaticMarkup(createElement(PetAvatar, { size: 'sm', muted: true }))

    expect(markup).toContain(PET_AVATAR_DEFAULT.src)
    expect(markup).toContain('grayscale')
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

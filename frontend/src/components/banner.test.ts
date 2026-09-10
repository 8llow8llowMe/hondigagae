import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { Banner } from '@/components/banner'

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(Banner, {
      href: '/emergency',
      title: '주변 동물병원 찾기',
      description: '제주 24시간 병원은 3곳뿐이에요',
      ...overrides,
    }),
  )
}

describe('Banner — 상시 진입점 (아트보드 `홈·내비게이션`)', () => {
  it('내부 이동이라 Next 링크로 낸다 — raw <a> 는 전체 새로고침이다', () => {
    expect(render()).toContain('href="/emergency"')
  })

  it('우측 꺾쇠를 붙인다 — 눌러서 이동한다는 유일한 신호다', () => {
    expect(render()).toContain('<svg')
  })

  it('설명은 12/500 muted 다 — 본문(14)으로 올리면 제목과 무게가 비슷해진다', () => {
    const markup = render()

    expect(markup).toContain('text-caption')
    expect(markup).toContain('제주 24시간 병원은 3곳뿐이에요')
    expect(markup).not.toContain('text-body-2')
  })

  it('설명이 없으면 그 줄을 만들지 않는다', () => {
    const markup = renderToStaticMarkup(
      createElement(Banner, { href: '/emergency', title: '주변 동물병원 찾기' }),
    )

    expect(markup).toContain('주변 동물병원 찾기')
    expect(markup).not.toContain('text-caption')
  })

  it('자기 배경을 칠하지 않는다 — 각진 흰 면이 감싸는 카드의 모서리를 덮는다 (#428)', () => {
    /*
      3a 에서 실제로 났다. `Surface`(radius 12) 안의 배너가 `bg-bg` 로 각진 흰 면을
      그려 카드가 사각으로 보였다. `overflow-hidden` 으로 풀 수 없다 — 같은 카드 안
      `ProfileCard` 의 팝오버가 `absolute`(portal 아님)라 함께 잘린다.
    */
    const classes = render()
      .split('class="')
      .slice(1)
      .flatMap((chunk) => chunk.split('"')[0]?.split(/\s+/) ?? [])

    expect(classes.filter((name) => /^bg-/.test(name))).toEqual([])
  })

  it('배경을 붉게 칠하지 않는다 — 상시 진입점이지 경보가 아니다', () => {
    const markup = render({ leading: createElement('svg') })

    // `bg-bg` 를 기대하던 줄을 걷었다 — 배너는 자기 면을 갖지 않는다 (#428, 위 테스트)
    expect(markup).not.toContain('bg-danger')
    // 아이콘에만 danger 색을 쓴다
    expect(markup).toContain('text-danger-500')
  })

  it('위아래 테두리를 스스로 긋지 않는다 — 묶음 경계는 8px Band 가 맡는다', () => {
    expect(render()).not.toContain('border-y')
  })

  /*
    #386 — 좁아지는 것은 **오른쪽만**이다. 왼쪽이 함께 24 로 내려가면 헤더 로고(40)와
    레일 첫 글자가 같은 컨테이너 경계에서 16px 갈라진다.
  */
  it('레일 인셋은 1024 이상에서 오른쪽만 좁다 — 왼쪽은 본문을 따른다', () => {
    const rail = render({ inset: 'rail' })

    expect(rail).toContain('lg:pr-6')
    expect(rail).not.toContain('lg:px-6')
    expect(rail).not.toContain('lg:pl-')
    expect(render()).not.toContain('lg:pr-6')
  })
})
